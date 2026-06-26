const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Blockchain } = require("../src/core/blockchain");
const { P2PServer } = require("../src/network/p2p");
const { Wallet } = require("../src/core/wallet");

function createTempWallet(name) {
    const filePath = path.join(__dirname, `${name}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    const wallet = Wallet.loadOrCreate(filePath);

    return {
        wallet,
        cleanup() {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

test("three nodes propagate a pending transaction and confirm it in a mined block", () => {
    const senderTemp = createTempWallet("tmp-net-sender");
    const receiverTemp = createTempWallet("tmp-net-receiver");

    try {
        const node1 = new Blockchain();
        const node2 = new Blockchain();
        const node3 = new Blockchain();

        const p2p1 = new P2PServer(node1);
        const p2p2 = new P2PServer(node2);
        const p2p3 = new P2PServer(node3);

        node1.minePendingTransactions(senderTemp.wallet.address);

        p2p2.handleChain(clone(node1.chain));
        p2p3.handleChain(clone(node1.chain));

        const transaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            11,
            node1,
            2
        );
        node1.addTransaction(transaction);

        p2p2.handleIncomingTransaction(clone(transaction));
        p2p3.handleIncomingTransaction(clone(transaction));

        assert.equal(node2.pendingTransactions.length, 1);
        assert.equal(node3.pendingTransactions.length, 1);
        assert.equal(node2.pendingTransactions[0].txId, transaction.txId);
        assert.equal(node3.pendingTransactions[0].txId, transaction.txId);

        node1.minePendingTransactions(senderTemp.wallet.address);
        const minedBlock = clone(node1.getLastBlock());

        p2p2.handleNewBlock(minedBlock);
        p2p3.handleNewBlock(minedBlock);

        assert.equal(node2.pendingTransactions.length, 0);
        assert.equal(node3.pendingTransactions.length, 0);
        assert.equal(node2.getBalance(receiverTemp.wallet.address, false), 11);
        assert.equal(node3.getBalance(receiverTemp.wallet.address, false), 11);
        assert.equal(node2.chain.length, node1.chain.length);
        assert.equal(node3.chain.length, node1.chain.length);
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("a node replaces its local chain when a peer presents a heavier valid chain", () => {
    const minerATemp = createTempWallet("tmp-net-miner-a");
    const minerBTemp = createTempWallet("tmp-net-miner-b");

    try {
        const nodeA = new Blockchain();
        const nodeB = new Blockchain();
        const p2pA = new P2PServer(nodeA);
        const p2pB = new P2PServer(nodeB);

        nodeA.minePendingTransactions(minerATemp.wallet.address);
        p2pB.handleChain(clone(nodeA.chain));

        nodeA.minePendingTransactions(minerATemp.wallet.address);
        nodeA.minePendingTransactions(minerATemp.wallet.address);

        nodeB.minePendingTransactions(minerBTemp.wallet.address);

        const chainWorkBefore = nodeB.getChainWork();
        p2pB.handleChain(clone(nodeA.chain));

        assert.equal(nodeB.chain.length, nodeA.chain.length);
        assert.equal(nodeB.getLastBlock().hash, nodeA.getLastBlock().hash);
        assert.ok(nodeB.getChainWork() > chainWorkBefore);
    } finally {
        minerATemp.cleanup();
        minerBTemp.cleanup();
    }
});
