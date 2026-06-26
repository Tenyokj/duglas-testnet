const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Block, Blockchain } = require("../src/core/blockchain");
const { Transaction } = require("../src/core/transaction");
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

test("stats reflect mined supply, fees and pending state", () => {
    const senderTemp = createTempWallet("tmp-test-sender");
    const receiverTemp = createTempWallet("tmp-test-receiver");

    try {
        const blockchain = new Blockchain();
        const sender = senderTemp.wallet;
        const receiver = receiverTemp.wallet;

        blockchain.minePendingTransactions(sender.address);

        const tx = sender.createTransaction(receiver.address, 10, blockchain, 2);
        blockchain.addTransaction(tx);

        let stats = blockchain.getStats();
        assert.equal(stats.totalSupply, 50);
        assert.equal(stats.pendingTransactionCount, 1);
        assert.equal(stats.pendingFees, 2);

        blockchain.minePendingTransactions(sender.address);

        stats = blockchain.getStats();
        assert.equal(stats.totalSupply, 102);
        assert.equal(stats.totalFeesCollected, 2);
        assert.equal(stats.confirmedTransactionCount, 1);
        assert.equal(blockchain.getBalance(receiver.address, false), 10);
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("network identity is stable and derived from genesis", () => {
    const blockchain = new Blockchain();
    const identity = blockchain.getNetworkIdentity();

    assert.equal(identity.networkName, "Duglas Testnet");
    assert.equal(identity.symbol, "DUG");
    assert.equal(identity.decimals, 4);
    assert.equal(identity.chainId, 180322);
    assert.equal(identity.protocolVersion, 1);
    assert.equal(identity.blockVersion, 1);
    assert.equal(identity.consensus, "pow-sha256");
    assert.equal(identity.addressFormat, "evm-like-0x");
    assert.equal(identity.genesisId, blockchain.chain[0].hash);
});

test("app registry exposes supported app-layer modules", () => {
    const blockchain = new Blockchain();
    const apps = blockchain.getAppDefinitions();
    const todo = apps.find(app => app.name === "todo");
    const notes = apps.find(app => app.name === "notes");
    const profile = apps.find(app => app.name === "profile");
    const registry = apps.find(app => app.name === "registry");

    assert.equal(Array.isArray(apps), true);
    assert.equal(Boolean(todo), true);
    assert.equal(Boolean(notes), true);
    assert.equal(Boolean(profile), true);
    assert.equal(Boolean(registry), true);
    assert.match(todo.description, /task items/i);
    assert.match(notes.description, /text notes/i);
    assert.match(profile.description, /profile state/i);
    assert.match(registry.description, /global name registry/i);
    assert.equal(todo.prefix, "todo");
    assert.equal(notes.prefix, "note");
    assert.equal(profile.prefix, "profile");
    assert.equal(registry.prefix, "registry");
});

test("action policy registry exposes supported formal actions", () => {
    const blockchain = new Blockchain();
    const policies = blockchain.getActionPolicies();
    const kvSet = policies.find(policy => policy.app === "kv" && policy.action === "set");
    const profileDelete = policies.find(policy => policy.app === "profile" && policy.action === "delete");
    const counterAdd = policies.find(policy => policy.app === "counter" && policy.action === "add");

    assert.equal(Array.isArray(policies), true);
    assert.equal(Boolean(kvSet), true);
    assert.equal(Boolean(profileDelete), true);
    assert.equal(Boolean(counterAdd), true);
    assert.equal(kvSet.operation, "kv:set");
    assert.equal(kvSet.params[0].name, "key");
    assert.equal(kvSet.params[0].required, true);
    assert.equal(profileDelete.params.length, 0);
    assert.equal(counterAdd.params.some(param => param.name === "delta"), true);
});

test("block selection respects fees without breaking nonce order", () => {
    const walletATemp = createTempWallet("tmp-test-a");
    const walletBTemp = createTempWallet("tmp-test-b");
    const receiver1Temp = createTempWallet("tmp-test-r1");
    const receiver2Temp = createTempWallet("tmp-test-r2");
    const receiver3Temp = createTempWallet("tmp-test-r3");

    try {
        const blockchain = new Blockchain();
        blockchain.maxTransactionsPerBlock = 2;

        blockchain.minePendingTransactions(walletATemp.wallet.address);
        blockchain.minePendingTransactions(walletBTemp.wallet.address);

        const txA1 = walletATemp.wallet.createTransaction(
            receiver1Temp.wallet.address,
            5,
            blockchain,
            1
        );
        blockchain.addTransaction(txA1);

        const txA2 = walletATemp.wallet.createTransaction(
            receiver2Temp.wallet.address,
            5,
            blockchain,
            10
        );
        blockchain.addTransaction(txA2);

        const txB1 = walletBTemp.wallet.createTransaction(
            receiver3Temp.wallet.address,
            5,
            blockchain,
            5
        );
        blockchain.addTransaction(txB1);

        const selected = blockchain.getTransactionsForNextBlock();
        assert.deepEqual(
            selected.map(tx => tx.fee),
            [5, 1]
        );

        blockchain.minePendingTransactions(walletATemp.wallet.address);

        assert.deepEqual(
            blockchain.pendingTransactions.map(tx => tx.fee),
            [10]
        );
    } finally {
        walletATemp.cleanup();
        walletBTemp.cleanup();
        receiver1Temp.cleanup();
        receiver2Temp.cleanup();
        receiver3Temp.cleanup();
    }
});

test("halving reduces the base block reward on schedule", () => {
    const minerTemp = createTempWallet("tmp-test-halving");

    try {
        const blockchain = new Blockchain();
        blockchain.halvingInterval = 3;

        const rewards = [];
        for (let i = 0; i < 6; i++) {
            blockchain.minePendingTransactions(minerTemp.wallet.address);
            const rewardTransaction = blockchain.getLastBlock().transactions.find(
                transaction => transaction.from === null
            );
            rewards.push(rewardTransaction.amount);
        }

        assert.deepEqual(rewards, [50, 50, 50, 25, 25, 25]);
        assert.equal(blockchain.getCurrentMiningReward(), 12.5);
    } finally {
        minerTemp.cleanup();
    }
});

test("new blocks include a modern header with height, version and merkle root", () => {
    const minerTemp = createTempWallet("tmp-test-header");
    const receiverTemp = createTempWallet("tmp-test-header-receiver");

    try {
        const blockchain = new Blockchain();

        blockchain.minePendingTransactions(minerTemp.wallet.address);

        const transaction = minerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            3,
            blockchain,
            1
        );
        blockchain.addTransaction(transaction);
        blockchain.minePendingTransactions(minerTemp.wallet.address);

        const latestBlock = blockchain.getLastBlock();
        const previousBlock = blockchain.chain[blockchain.chain.length - 2];

        assert.equal(latestBlock.version, 1);
        assert.equal(latestBlock.height, 2);
        assert.equal(
            latestBlock.merkleRoot,
            Block.calculateMerkleRoot(latestBlock.transactions)
        );
        assert.equal(blockchain.isValidBlock(latestBlock, previousBlock, latestBlock.height), true);
    } finally {
        minerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("reward transactions stay unique across consecutive mined blocks", () => {
    const minerTemp = createTempWallet("tmp-test-reward-uniqueness");

    try {
        const blockchain = new Blockchain();

        blockchain.minePendingTransactions(minerTemp.wallet.address);
        blockchain.minePendingTransactions(minerTemp.wallet.address);
        blockchain.minePendingTransactions(minerTemp.wallet.address);

        const rewardTransactionIds = blockchain.chain
            .slice(1)
            .map(block => block.transactions.find(transaction => transaction.from === null)?.txId);

        assert.equal(new Set(rewardTransactionIds).size, rewardTransactionIds.length);
    } finally {
        minerTemp.cleanup();
    }
});

test("transaction receipt reports pending and confirmed lifecycle", () => {
    const senderTemp = createTempWallet("tmp-test-receipt-sender");
    const receiverTemp = createTempWallet("tmp-test-receipt-receiver");

    try {
        const blockchain = new Blockchain();
        const sender = senderTemp.wallet;
        const receiver = receiverTemp.wallet;

        blockchain.minePendingTransactions(sender.address);

        const transaction = sender.createTransaction(receiver.address, 7, blockchain, 2);
        blockchain.addTransaction(transaction);

        const pendingReceipt = blockchain.getTransactionReceipt(transaction.txId);
        assert.equal(pendingReceipt.status, "pending");
        assert.equal(pendingReceipt.confirmations, 0);
        assert.equal(pendingReceipt.includedInBlock, false);
        assert.equal(pendingReceipt.effectiveDebit, 9);
        assert.equal(pendingReceipt.effectiveCredit, 7);

        blockchain.minePendingTransactions(sender.address);

        const confirmedReceipt = blockchain.getTransactionReceipt(transaction.txId);
        assert.equal(confirmedReceipt.status, "confirmed");
        assert.equal(confirmedReceipt.blockHeight, 2);
        assert.equal(confirmedReceipt.confirmations, 1);
        assert.equal(confirmedReceipt.includedInBlock, true);
        assert.equal(confirmedReceipt.effectiveDebit, 9);
        assert.equal(confirmedReceipt.effectiveCredit, 7);
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("data transactions carry payloads and appear in receipts and stats", () => {
    const senderTemp = createTempWallet("tmp-test-data-sender");
    const receiverTemp = createTempWallet("tmp-test-data-receiver");

    try {
        const blockchain = new Blockchain();
        const sender = senderTemp.wallet;
        const receiver = receiverTemp.wallet;

        blockchain.minePendingTransactions(sender.address);

        const transaction = sender.createTransaction(
            receiver.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "greeting",
                    value: "hello"
                }
            }
        );

        blockchain.addTransaction(transaction);

        const pendingReceipt = blockchain.getTransactionReceipt(transaction.txId);
        assert.equal(pendingReceipt.type, Transaction.TYPES.DATA);
        assert.equal(pendingReceipt.payload.key, "greeting");
        assert.equal(pendingReceipt.payloadBytes > 0, true);
        assert.equal(pendingReceipt.execution.status, "pending");

        blockchain.minePendingTransactions(sender.address);

        const confirmedReceipt = blockchain.getTransactionReceipt(transaction.txId);
        const stats = blockchain.getStats();

        assert.equal(confirmedReceipt.type, Transaction.TYPES.DATA);
        assert.equal(confirmedReceipt.payload.value, "hello");
        assert.equal(typeof confirmedReceipt.payloadHash, "string");
        assert.equal(confirmedReceipt.execution.status, "applied");
        assert.equal(stats.confirmedDataTransactionCount, 1);
        assert.equal(stats.supportedTransactionTypes.includes(Transaction.TYPES.DATA), true);
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("data transactions reject oversized payloads", () => {
    const senderTemp = createTempWallet("tmp-test-data-oversized-sender");
    const receiverTemp = createTempWallet("tmp-test-data-oversized-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        assert.throws(
            () => senderTemp.wallet.createTransaction(
                receiverTemp.wallet.address,
                0,
                blockchain,
                1,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        blob: "x".repeat(Transaction.MAX_PAYLOAD_BYTES + 1)
                    }
                }
            ),
            /Payload exceeds/
        );
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("kv:set updates confirmed state and receipt state changes", () => {
    const senderTemp = createTempWallet("tmp-test-kv-set-sender");
    const receiverTemp = createTempWallet("tmp-test-kv-set-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const transaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "greeting",
                    value: "hello"
                }
            }
        );

        blockchain.addTransaction(transaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const receipt = blockchain.getTransactionReceipt(transaction.txId);
        const keyDetails = blockchain.getStateKeyDetails("greeting");

        assert.equal(keyDetails.exists, true);
        assert.equal(keyDetails.value, "hello");
        assert.equal(receipt.execution.stateChanges.length, 1);
        assert.equal(receipt.execution.stateChanges[0].action, "set");
        assert.equal(receipt.execution.stateChanges[0].nextValue, "hello");
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("kv:delete removes state and appends history", () => {
    const senderTemp = createTempWallet("tmp-test-kv-delete-sender");
    const receiverTemp = createTempWallet("tmp-test-kv-delete-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const setTransaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "theme",
                    value: "blue"
                }
            }
        );
        blockchain.addTransaction(setTransaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const deleteTransaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:delete",
                    key: "theme"
                }
            }
        );
        blockchain.addTransaction(deleteTransaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const keyDetails = blockchain.getStateKeyDetails("theme");
        const history = blockchain.getStateHistory("theme");

        assert.equal(keyDetails.exists, false);
        assert.equal(history.length, 2);
        assert.equal(history[0].action, "set");
        assert.equal(history[1].action, "delete");
        assert.equal(history[1].previousValue, "blue");
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("formal app/action payloads execute kv:set operations", () => {
    const senderTemp = createTempWallet("tmp-test-action-kv-sender");
    const receiverTemp = createTempWallet("tmp-test-action-kv-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const transaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    app: "kv",
                    action: "set",
                    params: {
                        key: "theme",
                        value: "midnight"
                    }
                }
            }
        );

        blockchain.addTransaction(transaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const receipt = blockchain.getTransactionReceipt(transaction.txId);
        const keyDetails = blockchain.getStateKeyDetails("theme");

        assert.equal(keyDetails.exists, true);
        assert.equal(keyDetails.value, "midnight");
        assert.equal(receipt.execution.status, "applied");
        assert.equal(receipt.execution.stateChanges[0].key, "theme");
        assert.equal(receipt.execution.stateChanges[0].nextValue, "midnight");
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("formal app/action payloads execute counter operations", () => {
    const senderTemp = createTempWallet("tmp-test-action-counter-sender");
    const receiverTemp = createTempWallet("tmp-test-action-counter-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const createTransaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    app: "counter",
                    action: "create",
                    params: {
                        id: "score",
                        initialValue: 10
                    }
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const addTransaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    app: "counter",
                    action: "add",
                    params: {
                        id: "score",
                        delta: 5
                    }
                }
            }
        );
        blockchain.addTransaction(addTransaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const counter = blockchain.getCounterItem(senderTemp.wallet.address, "score");
        const receipt = blockchain.getTransactionReceipt(addTransaction.txId);

        assert.notEqual(counter, null);
        assert.equal(counter.value, 15);
        assert.equal(receipt.execution.status, "applied");
        assert.equal(receipt.execution.stateChanges[0].action, "counter:add");
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("formal app/action payloads reject unsupported actions with a clear error", () => {
    const senderTemp = createTempWallet("tmp-test-action-unsupported-sender");
    const receiverTemp = createTempWallet("tmp-test-action-unsupported-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const transaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    app: "counter",
                    action: "multiply",
                    params: {
                        id: "score",
                        delta: 2
                    }
                }
            }
        );

        assert.throws(
            () => blockchain.addTransaction(transaction),
            /Unsupported action policy: counter:multiply/
        );
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("state survives export and reload", () => {
    const senderTemp = createTempWallet("tmp-test-state-reload-sender");
    const receiverTemp = createTempWallet("tmp-test-state-reload-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const transaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "mode",
                    value: { theme: "dark" }
                }
            }
        );
        blockchain.addTransaction(transaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const restored = new Blockchain();
        const loaded = restored.loadState(blockchain.exportState());

        assert.equal(loaded, true);
        assert.deepEqual(restored.getStateValue("mode"), { theme: "dark" });
        assert.equal(restored.getStateHistory("mode").length, 1);
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("kv:increment creates and updates numeric state values", () => {
    const senderTemp = createTempWallet("tmp-test-kv-inc-sender");
    const receiverTemp = createTempWallet("tmp-test-kv-inc-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const firstIncrement = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:increment",
                    key: "counter",
                    amount: 2
                }
            }
        );
        blockchain.addTransaction(firstIncrement);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const secondIncrement = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:increment",
                    key: "counter",
                    amount: 3
                }
            }
        );
        blockchain.addTransaction(secondIncrement);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const keyDetails = blockchain.getStateKeyDetails("counter");
        const history = blockchain.getStateHistory("counter");
        const receipt = blockchain.getTransactionReceipt(secondIncrement.txId);

        assert.equal(keyDetails.value, 5);
        assert.equal(history.length, 2);
        assert.equal(history[0].action, "increment");
        assert.equal(history[1].delta, 3);
        assert.equal(receipt.execution.stateChanges[0].delta, 3);
        assert.equal(receipt.execution.stateChanges[0].nextValue, 5);
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("state ownership prevents another address from mutating a key", () => {
    const ownerTemp = createTempWallet("tmp-test-owner-a");
    const otherTemp = createTempWallet("tmp-test-owner-b");
    const receiverTemp = createTempWallet("tmp-test-owner-r");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);
        blockchain.minePendingTransactions(otherTemp.wallet.address);

        const ownerSet = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "profile",
                    value: "alice"
                }
            }
        );
        blockchain.addTransaction(ownerSet);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const attackerSet = otherTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "profile",
                    value: "mallory"
                }
            }
        );

        blockchain.addTransaction(attackerSet);
        blockchain.minePendingTransactions(otherTemp.wallet.address);

        const keyDetails = blockchain.getStateKeyDetails("profile");
        const receipt = blockchain.getTransactionReceipt(attackerSet.txId);

        assert.equal(keyDetails.value, "alice");
        assert.equal(receipt.execution.status, "rejected");
        assert.match(receipt.execution.logs[0], /owned by another address/);
    } finally {
        ownerTemp.cleanup();
        otherTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("kv:increment rejects non-numeric keys", () => {
    const senderTemp = createTempWallet("tmp-test-inc-reject-sender");
    const receiverTemp = createTempWallet("tmp-test-inc-reject-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const setTransaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "label",
                    value: "hello"
                }
            }
        );
        blockchain.addTransaction(setTransaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const incrementTransaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:increment",
                    key: "label",
                    amount: 1
                }
            }
        );
        blockchain.addTransaction(incrementTransaction);
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const receipt = blockchain.getTransactionReceipt(incrementTransaction.txId);
        const keyDetails = blockchain.getStateKeyDetails("label");

        assert.equal(receipt.execution.status, "rejected");
        assert.match(receipt.execution.logs[0], /not numeric/);
        assert.equal(keyDetails.value, "hello");
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("pending state preview reflects queued state changes before mining", () => {
    const senderTemp = createTempWallet("tmp-test-pending-preview-sender");
    const receiverTemp = createTempWallet("tmp-test-pending-preview-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const transaction = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "draft",
                    value: "pending-value"
                }
            }
        );

        blockchain.addTransaction(transaction);

        const confirmedKey = blockchain.getStateKeyDetails("draft");
        const pendingKey = blockchain.getPendingStateKeyDetails("draft");
        const pendingState = blockchain.getPendingStatePreview();
        const pendingReceipt = blockchain.getTransactionReceipt(transaction.txId);

        assert.equal(confirmedKey.exists, false);
        assert.equal(pendingKey.exists, true);
        assert.equal(pendingKey.value, "pending-value");
        assert.equal(pendingState.stats.pendingAppliedTransactions, 1);
        assert.equal(pendingReceipt.execution.status, "pending");
        assert.equal(pendingReceipt.execution.stateChanges[0].nextValue, "pending-value");
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("pending state preview surfaces rejected conflicting state transactions", () => {
    const ownerTemp = createTempWallet("tmp-test-pending-reject-owner");
    const attackerTemp = createTempWallet("tmp-test-pending-reject-attacker");
    const receiverTemp = createTempWallet("tmp-test-pending-reject-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);
        blockchain.minePendingTransactions(attackerTemp.wallet.address);

        const ownerSet = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "shared",
                    value: "owner-value"
                }
            }
        );
        blockchain.addTransaction(ownerSet);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const ownerUpdate = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "shared",
                    value: "owner-pending"
                }
            }
        );
        blockchain.addTransaction(ownerUpdate);

        const attackerUpdate = attackerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            2,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "kv:set",
                    key: "shared",
                    value: "attacker-pending"
                }
            }
        );
        blockchain.addTransaction(attackerUpdate);

        const preview = blockchain.getPendingStatePreview();
        const pendingKey = blockchain.getPendingStateKeyDetails("shared");
        const attackerExecution = preview.executions.find(
            execution => execution.txId === attackerUpdate.txId
        );

        assert.equal(pendingKey.value, "owner-pending");
        assert.equal(preview.stats.pendingRejectedTransactions, 1);
        assert.equal(attackerExecution.status, "rejected");
        assert.match(attackerExecution.logs[0], /owned by another address/);
    } finally {
        ownerTemp.cleanup();
        attackerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("todo app creates, toggles and lists namespaced state items", () => {
    const ownerTemp = createTempWallet("tmp-test-todo-owner");
    const receiverTemp = createTempWallet("tmp-test-todo-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "todo:create",
                    id: "first",
                    text: "Buy milk"
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const toggleTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "todo:toggle",
                    id: "first",
                    done: true
                }
            }
        );
        blockchain.addTransaction(toggleTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const todoItems = blockchain.getTodoItems(ownerTemp.wallet.address);
        const todoKey = blockchain.buildTodoStateKey(ownerTemp.wallet.address, "first");
        const todoReceipt = blockchain.getTransactionReceipt(toggleTransaction.txId);

        assert.equal(todoItems.length, 1);
        assert.equal(todoItems[0].id, "first");
        assert.equal(todoItems[0].text, "Buy milk");
        assert.equal(todoItems[0].done, true);
        assert.equal(blockchain.getStateKeyDetails(todoKey).exists, true);
        assert.equal(todoReceipt.execution.stateChanges[0].action, "todo:toggle");
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("todo app pending preview shows unmined todo items", () => {
    const ownerTemp = createTempWallet("tmp-test-todo-pending-owner");
    const receiverTemp = createTempWallet("tmp-test-todo-pending-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "todo:create",
                    id: "draft",
                    text: "Pending todo"
                }
            }
        );
        blockchain.addTransaction(createTransaction);

        const confirmedItems = blockchain.getTodoItems(ownerTemp.wallet.address);
        const pendingItems = blockchain.getTodoItems(ownerTemp.wallet.address, { pending: true });

        assert.equal(confirmedItems.length, 0);
        assert.equal(pendingItems.length, 1);
        assert.equal(pendingItems[0].id, "draft");
        assert.equal(pendingItems[0].done, false);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("notes app creates, updates, deletes and lists namespaced notes", () => {
    const ownerTemp = createTempWallet("tmp-test-note-owner");
    const receiverTemp = createTempWallet("tmp-test-note-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "note:set",
                    id: "roadmap",
                    content: "Ship state layer"
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const updateTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "note:set",
                    id: "roadmap",
                    content: "Ship state layer and notes app"
                }
            }
        );
        blockchain.addTransaction(updateTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const noteItems = blockchain.getNoteItems(ownerTemp.wallet.address);
        const noteKey = blockchain.buildNoteStateKey(ownerTemp.wallet.address, "roadmap");
        const noteReceipt = blockchain.getTransactionReceipt(updateTransaction.txId);

        assert.equal(noteItems.length, 1);
        assert.equal(noteItems[0].id, "roadmap");
        assert.equal(noteItems[0].content, "Ship state layer and notes app");
        assert.equal(blockchain.getStateKeyDetails(noteKey).exists, true);
        assert.equal(noteReceipt.execution.stateChanges[0].action, "note:update");

        const deleteTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "note:delete",
                    id: "roadmap"
                }
            }
        );
        blockchain.addTransaction(deleteTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        assert.equal(blockchain.getNoteItems(ownerTemp.wallet.address).length, 0);
        assert.equal(blockchain.getStateKeyDetails(noteKey).exists, false);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("notes app pending preview shows unmined note values", () => {
    const ownerTemp = createTempWallet("tmp-test-note-pending-owner");
    const receiverTemp = createTempWallet("tmp-test-note-pending-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const setTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "note:set",
                    id: "draft",
                    content: "Pending note"
                }
            }
        );
        blockchain.addTransaction(setTransaction);

        const confirmedItems = blockchain.getNoteItems(ownerTemp.wallet.address);
        const pendingItems = blockchain.getNoteItems(ownerTemp.wallet.address, { pending: true });
        const pendingEntry = blockchain.getNoteItem(ownerTemp.wallet.address, "draft", { pending: true });

        assert.equal(confirmedItems.length, 0);
        assert.equal(pendingItems.length, 1);
        assert.equal(pendingItems[0].content, "Pending note");
        assert.equal(pendingEntry.id, "draft");
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("profile app creates, updates and deletes account-level profile state", () => {
    const ownerTemp = createTempWallet("tmp-test-profile-owner");
    const receiverTemp = createTempWallet("tmp-test-profile-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "profile:set",
                    displayName: "Daniil",
                    bio: "Building Duglas"
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const updateTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "profile:set",
                    displayName: "Daniil V",
                    bio: "Building Duglas Testnet"
                }
            }
        );
        blockchain.addTransaction(updateTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const profile = blockchain.getProfile(ownerTemp.wallet.address);
        const profileKey = blockchain.buildProfileStateKey(ownerTemp.wallet.address);
        const receipt = blockchain.getTransactionReceipt(updateTransaction.txId);

        assert.equal(profile.displayName, "Daniil V");
        assert.equal(profile.bio, "Building Duglas Testnet");
        assert.equal(blockchain.getStateKeyDetails(profileKey).exists, true);
        assert.equal(receipt.execution.stateChanges[0].action, "profile:update");

        const deleteTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "profile:delete"
                }
            }
        );
        blockchain.addTransaction(deleteTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        assert.equal(blockchain.getProfile(ownerTemp.wallet.address), null);
        assert.equal(blockchain.getStateKeyDetails(profileKey).exists, false);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("profile app pending preview shows unmined account profile state", () => {
    const ownerTemp = createTempWallet("tmp-test-profile-pending-owner");
    const receiverTemp = createTempWallet("tmp-test-profile-pending-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const setTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "profile:set",
                    displayName: "Pending User",
                    bio: "Pending bio"
                }
            }
        );
        blockchain.addTransaction(setTransaction);

        const confirmedProfile = blockchain.getProfile(ownerTemp.wallet.address);
        const pendingProfile = blockchain.getProfile(ownerTemp.wallet.address, { pending: true });

        assert.equal(confirmedProfile, null);
        assert.equal(pendingProfile.displayName, "Pending User");
        assert.equal(pendingProfile.bio, "Pending bio");
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("registry app creates, updates and deletes global registry entries", () => {
    const ownerTemp = createTempWallet("tmp-test-registry-owner");
    const receiverTemp = createTempWallet("tmp-test-registry-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "registry:set",
                    name: "duglas",
                    record: "https://duglas.local"
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const updateTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "registry:set",
                    name: "duglas",
                    record: "https://testnet.duglas.local"
                }
            }
        );
        blockchain.addTransaction(updateTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const entry = blockchain.getRegistryEntry("duglas");
        const entryKey = blockchain.buildRegistryStateKey("duglas");
        const receipt = blockchain.getTransactionReceipt(updateTransaction.txId);

        assert.equal(entry.name, "duglas");
        assert.equal(entry.record, "https://testnet.duglas.local");
        assert.equal(blockchain.getStateKeyDetails(entryKey).exists, true);
        assert.equal(receipt.execution.stateChanges[0].action, "registry:update");

        const deleteTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "registry:delete",
                    name: "duglas"
                }
            }
        );
        blockchain.addTransaction(deleteTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        assert.equal(blockchain.getRegistryEntry("duglas"), null);
        assert.equal(blockchain.getStateKeyDetails(entryKey).exists, false);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("registry app pending preview shows unmined global entries", () => {
    const ownerTemp = createTempWallet("tmp-test-registry-pending-owner");
    const receiverTemp = createTempWallet("tmp-test-registry-pending-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const setTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "registry:set",
                    name: "alpha",
                    record: "pending-value"
                }
            }
        );
        blockchain.addTransaction(setTransaction);

        const confirmedEntry = blockchain.getRegistryEntry("alpha");
        const pendingEntry = blockchain.getRegistryEntry("alpha", { pending: true });
        const pendingEntries = blockchain.getRegistryEntries({ pending: true });

        assert.equal(confirmedEntry, null);
        assert.equal(pendingEntry.record, "pending-value");
        assert.equal(pendingEntries.length, 1);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("registry app ownership blocks another address from hijacking a claimed name", () => {
    const ownerTemp = createTempWallet("tmp-test-registry-claim-owner");
    const attackerTemp = createTempWallet("tmp-test-registry-claim-attacker");
    const receiverTemp = createTempWallet("tmp-test-registry-claim-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);
        blockchain.minePendingTransactions(attackerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "registry:set",
                    name: "taken",
                    record: "owner-record"
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const attackerTransaction = attackerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "registry:set",
                    name: "taken",
                    record: "attacker-record"
                }
            }
        );
        blockchain.addTransaction(attackerTransaction);

        const preview = blockchain.getPendingStatePreview();
        const execution = preview.executions.find(item => item.txId === attackerTransaction.txId);
        const pendingEntry = blockchain.getRegistryEntry("taken", { pending: true });

        assert.equal(pendingEntry.record, "owner-record");
        assert.equal(execution.status, "rejected");
        assert.match(execution.logs[0], /owned by another address/);
    } finally {
        ownerTemp.cleanup();
        attackerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("counter app creates, updates and deletes numeric state machines", () => {
    const ownerTemp = createTempWallet("tmp-test-counter-owner");
    const receiverTemp = createTempWallet("tmp-test-counter-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:create",
                    id: "score",
                    initialValue: 10
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const addTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:add",
                    id: "score",
                    delta: 5
                }
            }
        );
        blockchain.addTransaction(addTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const subTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:sub",
                    id: "score",
                    delta: 3
                }
            }
        );
        blockchain.addTransaction(subTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const counter = blockchain.getCounterItem(ownerTemp.wallet.address, "score");
        const counterKey = blockchain.buildCounterStateKey(ownerTemp.wallet.address, "score");
        const receipt = blockchain.getTransactionReceipt(subTransaction.txId);

        assert.equal(counter.value, 12);
        assert.equal(blockchain.getStateKeyDetails(counterKey).exists, true);
        assert.equal(receipt.execution.stateChanges[0].action, "counter:sub");

        const deleteTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:delete",
                    id: "score"
                }
            }
        );
        blockchain.addTransaction(deleteTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        assert.equal(blockchain.getCounterItem(ownerTemp.wallet.address, "score"), null);
        assert.equal(blockchain.getStateKeyDetails(counterKey).exists, false);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("counter app pending preview shows unmined numeric state changes", () => {
    const ownerTemp = createTempWallet("tmp-test-counter-pending-owner");
    const receiverTemp = createTempWallet("tmp-test-counter-pending-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:create",
                    id: "draft",
                    initialValue: 2
                }
            }
        );
        blockchain.addTransaction(createTransaction);

        const confirmedCounter = blockchain.getCounterItem(ownerTemp.wallet.address, "draft");
        const pendingCounter = blockchain.getCounterItem(ownerTemp.wallet.address, "draft", { pending: true });

        assert.equal(confirmedCounter, null);
        assert.equal(pendingCounter.value, 2);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("counter app rejects operations that would move below zero", () => {
    const ownerTemp = createTempWallet("tmp-test-counter-floor-owner");
    const receiverTemp = createTempWallet("tmp-test-counter-floor-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const createTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:create",
                    id: "hp",
                    initialValue: 1
                }
            }
        );
        blockchain.addTransaction(createTransaction);
        blockchain.minePendingTransactions(ownerTemp.wallet.address);

        const subTransaction = ownerTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    op: "counter:sub",
                    id: "hp",
                    delta: 2
                }
            }
        );
        blockchain.addTransaction(subTransaction);

        const preview = blockchain.getPendingStatePreview();
        const execution = preview.executions.find(item => item.txId === subTransaction.txId);
        const pendingCounter = blockchain.getCounterItem(ownerTemp.wallet.address, "hp", { pending: true });

        assert.equal(execution.status, "rejected");
        assert.match(execution.logs[0], /below zero/);
        assert.equal(pendingCounter.value, 1);
    } finally {
        ownerTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("mempool replaces a pending transaction only with a higher fee bump", () => {
    const senderTemp = createTempWallet("tmp-test-rbf-sender");
    const receiverTemp = createTempWallet("tmp-test-rbf-receiver");

    try {
        const blockchain = new Blockchain();
        const sender = senderTemp.wallet;
        const receiver = receiverTemp.wallet;

        blockchain.minePendingTransactions(sender.address);

        const original = sender.createTransaction(receiver.address, 5, blockchain, 1);
        blockchain.addTransaction(original);

        const replacement = new Transaction(
            sender.address,
            receiver.address,
            5,
            Date.now(),
            original.nonce,
            2
        );
        replacement.signTransaction(sender.keyPair);
        blockchain.addTransaction(replacement);

        assert.equal(blockchain.pendingTransactions.length, 1);
        assert.equal(blockchain.pendingTransactions[0].txId, replacement.txId);
        assert.equal(blockchain.pendingTransactions[0].fee, 2);

        const underpricedReplacement = new Transaction(
            sender.address,
            receiver.address,
            5,
            Date.now(),
            original.nonce,
            2
        );
        underpricedReplacement.signTransaction(sender.keyPair);
        assert.throws(
            () => blockchain.addTransaction(underpricedReplacement),
            /Replacement transaction fee must be at least 3/
        );
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("mempool enforces a minimum fee for data transactions", () => {
    const senderTemp = createTempWallet("tmp-test-data-fee-sender");
    const receiverTemp = createTempWallet("tmp-test-data-fee-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        const underpriced = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            0,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    app: "kv",
                    action: "set",
                    params: {
                        key: "theme",
                        value: "blue"
                    }
                }
            }
        );

        assert.throws(
            () => blockchain.addTransaction(underpriced),
            /minimum required fee of 1/
        );

        const priceyPayload = "x".repeat(1100);
        const chunkedFeeRequired = senderTemp.wallet.createTransaction(
            receiverTemp.wallet.address,
            0,
            blockchain,
            1,
            {
                type: Transaction.TYPES.DATA,
                payload: {
                    app: "notes",
                    action: "set",
                    params: {
                        id: "roadmap",
                        content: priceyPayload
                    }
                }
            }
        );

        assert.throws(
            () => blockchain.addTransaction(chunkedFeeRequired),
            /minimum required fee of 2/
        );
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});

test("mempool enforces a sender pending transaction limit", () => {
    const senderTemp = createTempWallet("tmp-test-limit-sender");
    const receiver1Temp = createTempWallet("tmp-test-limit-r1");
    const receiver2Temp = createTempWallet("tmp-test-limit-r2");
    const receiver3Temp = createTempWallet("tmp-test-limit-r3");

    try {
        const blockchain = new Blockchain();
        blockchain.maxPendingTransactionsPerSender = 2;

        blockchain.minePendingTransactions(senderTemp.wallet.address);

        blockchain.addTransaction(
            senderTemp.wallet.createTransaction(receiver1Temp.wallet.address, 5, blockchain, 1)
        );
        blockchain.addTransaction(
            senderTemp.wallet.createTransaction(receiver2Temp.wallet.address, 5, blockchain, 1)
        );

        assert.throws(
            () => blockchain.addTransaction(
                senderTemp.wallet.createTransaction(receiver3Temp.wallet.address, 5, blockchain, 1)
            ),
            /Too many pending transactions for sender/
        );
    } finally {
        senderTemp.cleanup();
        receiver1Temp.cleanup();
        receiver2Temp.cleanup();
        receiver3Temp.cleanup();
    }
});

test("mempool enforces a sender pending data transaction limit", () => {
    const senderTemp = createTempWallet("tmp-test-data-limit-sender");
    const receiverTemp = createTempWallet("tmp-test-data-limit-receiver");

    try {
        const blockchain = new Blockchain();
        blockchain.maxPendingDataTransactionsPerSender = 2;
        blockchain.minePendingTransactions(senderTemp.wallet.address);

        blockchain.addTransaction(
            senderTemp.wallet.createTransaction(
                receiverTemp.wallet.address,
                0,
                blockchain,
                1,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "kv",
                        action: "set",
                        params: { key: "a", value: 1 }
                    }
                }
            )
        );
        blockchain.addTransaction(
            senderTemp.wallet.createTransaction(
                receiverTemp.wallet.address,
                0,
                blockchain,
                1,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "kv",
                        action: "set",
                        params: { key: "b", value: 2 }
                    }
                }
            )
        );

        assert.throws(
            () => blockchain.addTransaction(
                senderTemp.wallet.createTransaction(
                    receiverTemp.wallet.address,
                    0,
                    blockchain,
                    1,
                    {
                        type: Transaction.TYPES.DATA,
                        payload: {
                            app: "kv",
                            action: "set",
                            params: { key: "c", value: 3 }
                        }
                    }
                )
            ),
            /Too many pending data transactions for sender/
        );
    } finally {
        senderTemp.cleanup();
        receiverTemp.cleanup();
    }
});
