const WebSocket = require("ws");
const { Transaction } = require("../core/transaction");

const MessageType = {
    CHAIN: "CHAIN",
    REQUEST_CHAIN: "REQUEST_CHAIN",
    NEW_BLOCK: "NEW_BLOCK",
    NEW_TRANSACTION: "NEW_TRANSACTION",
    REQUEST_PENDING_TRANSACTIONS: "REQUEST_PENDING_TRANSACTIONS",
    PENDING_TRANSACTIONS: "PENDING_TRANSACTIONS"
};

const ALLOWED_MESSAGE_TYPES = new Set(Object.values(MessageType));
const MAX_P2P_MESSAGE_BYTES = 128 * 1024;

class P2PServer {
    constructor(blockchain, onStateChange = () => {}) {
        this.blockchain = blockchain;
        this.onStateChange = onStateChange;
        this.sockets = [];
        this.peerReconnectTimers = new Map();
    }

    listen(port) {
        const server = new WebSocket.Server({ port });

        server.on("connection", socket => this.connectSocket(socket));
        server.on("error", error => {
            console.error(`Failed to start P2P server on port ${port}: ${error.message}`);
        });

        console.log("P2P listening on port", port);
    }

    connectToPeer(address) {
        if (this.hasPeer(address)) {
            return;
        }

        const socket = new WebSocket(address);
        socket.peerAddress = address;

        socket.on("open", () => this.connectSocket(socket));
        socket.on("error", error => {
            console.error(`Peer connection error for ${address}: ${error.message}`);
        });
        socket.on("close", () => {
            this.removeSocket(socket);
            this.scheduleReconnect(address);
        });
    }

    connectSocket(socket) {
        if (this.sockets.includes(socket)) {
            return;
        }

        socket.connectedAt = socket.connectedAt ?? Date.now();
        this.sockets.push(socket);
        console.log("Connected to peer");
        this.clearReconnect(socket.peerAddress);

        this.initMessageHandler(socket);

        this.send(socket, {
            type: MessageType.REQUEST_CHAIN
        });

        this.send(socket, {
            type: MessageType.REQUEST_PENDING_TRANSACTIONS
        });
    }

    initMessageHandler(socket) {
        socket.on("message", data => {
            const message = this.parseMessage(data);

            if (!message) {
                return;
            }

            switch (message.type) {

                case MessageType.REQUEST_CHAIN:
                    this.send(socket, {
                        type: MessageType.CHAIN,
                        data: this.blockchain.chain
                    });
                    break;

                case MessageType.CHAIN:
                    this.handleChain(message.data);
                    break;

                case MessageType.NEW_BLOCK:
                    this.handleNewBlock(message.data);
                    break;

                case MessageType.NEW_TRANSACTION:
                    this.handleIncomingTransaction(message.data);
                    break;

                case MessageType.REQUEST_PENDING_TRANSACTIONS:
                    this.send(socket, {
                        type: MessageType.PENDING_TRANSACTIONS,
                        data: this.blockchain.pendingTransactions
                    });
                    break;

                case MessageType.PENDING_TRANSACTIONS:
                    this.handlePendingTransactions(message.data);
                    break;

                default:
                    console.error(`Ignoring unsupported message type: ${message.type}`);
            }
        });
    }

    parseMessage(data) {
        const raw = typeof data === "string" ? data : data.toString();

        if (Buffer.byteLength(raw) > MAX_P2P_MESSAGE_BYTES) {
            console.error("Ignoring oversized P2P message");
            return null;
        }

        let message;

        try {
            message = JSON.parse(raw);
        } catch {
            console.error("Ignoring invalid JSON message from peer");
            return null;
        }

        if (!message || typeof message !== "object" || Array.isArray(message)) {
            console.error("Ignoring malformed P2P message payload");
            return null;
        }

        if (!ALLOWED_MESSAGE_TYPES.has(message.type)) {
            console.error(`Ignoring unknown P2P message type: ${message.type}`);
            return null;
        }

        return message;
    }

    hasPeer(address) {
        return this.sockets.some(socket => socket.peerAddress === address);
    }

    removeSocket(socket) {
        this.sockets = this.sockets.filter(currentSocket => currentSocket !== socket);
    }

    scheduleReconnect(address) {
        if (!address || this.peerReconnectTimers.has(address) || this.hasPeer(address)) {
            return;
        }

        const timer = setTimeout(() => {
            this.peerReconnectTimers.delete(address);
            console.log(`Retrying peer connection to ${address}`);
            this.connectToPeer(address);
        }, 2000);

        this.peerReconnectTimers.set(address, timer);
    }

    clearReconnect(address) {
        if (!address || !this.peerReconnectTimers.has(address)) {
            return;
        }

        clearTimeout(this.peerReconnectTimers.get(address));
        this.peerReconnectTimers.delete(address);
    }

    handleChain(receivedChain) {
        if (this.blockchain.replaceChain(receivedChain)) {
            console.log("Replacing chain with heavier chain");
            this.onStateChange();
        }
    }

    handleNewBlock(block) {
        if (this.blockchain.addBlock(block)) {
            console.log("Accepted new block from peer");
            this.onStateChange();
        } else {
            this.broadcast({
                type: MessageType.REQUEST_CHAIN
            });
        }
    }

    handleIncomingTransaction(transactionData) {
        try {
            const transaction = Transaction.fromData(transactionData);

            if (
                this.blockchain.hasTransactionInChain(transaction) ||
                this.blockchain.hasTransactionInPending(transaction)
            ) {
                return;
            }

            this.blockchain.addTransaction(transaction);
            this.onStateChange();
            this.broadcast({
                type: MessageType.NEW_TRANSACTION,
                data: transaction
            });
        } catch {
            // Ignore invalid or already known transactions.
        }
    }

    handlePendingTransactions(transactions = []) {
        for (const transactionData of transactions) {
            this.handleIncomingTransaction(transactionData);
        }
    }

    broadcast(message) {
        this.sockets.forEach(socket => this.send(socket, message));
    }

    send(socket, message) {
        if (socket.readyState !== WebSocket.OPEN) {
            return;
        }

        socket.send(JSON.stringify(message));
    }

    broadcastNewBlock(block) {
        this.broadcast({
            type: MessageType.NEW_BLOCK,
            data: block
        });
    }

    broadcastTransaction(transaction) {
        this.broadcast({
            type: MessageType.NEW_TRANSACTION,
            data: transaction
        });
    }

    getPeerSummaries() {
        const readyStateLabels = {
            [WebSocket.CONNECTING]: "connecting",
            [WebSocket.OPEN]: "open",
            [WebSocket.CLOSING]: "closing",
            [WebSocket.CLOSED]: "closed"
        };

        return {
            connectedPeers: this.sockets.map((socket, index) => ({
                id: index,
                address: socket.peerAddress ?? "inbound-peer",
                readyState: readyStateLabels[socket.readyState] ?? String(socket.readyState),
                connectedAt: socket.connectedAt ?? null
            })),
            reconnectingPeers: Array.from(this.peerReconnectTimers.keys()).map(address => ({
                address,
                reconnectScheduled: true
            }))
        };
    }
}

module.exports = { P2PServer };
