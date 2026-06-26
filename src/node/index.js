const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { Blockchain } = require("../core/blockchain");
const { P2PServer } = require("../network/p2p");
const { Wallet } = require("../core/wallet");
const { NodeStorage } = require("../core/storage");
const { Transaction } = require("../core/transaction");
const { SlidingWindowRateLimiter, CooldownLimiter } = require("../core/rate_limiter");

const blockchain = new Blockchain();

const P2P_PORT = Number(process.env.P2P_PORT || process.argv[2] || 6001);
const HTTP_PORT = Number(process.env.HTTP_PORT || process.argv[3] || 3001);
const cliPeers = process.argv.slice(4);
const bootstrapPeers = (process.env.BOOTSTRAP_PEERS || "")
    .split(",")
    .map(peer => peer.trim())
    .filter(Boolean);
const peers = Array.from(new Set([
    ...bootstrapPeers,
    ...cliPeers
]));
const projectRoot = path.resolve(__dirname, "..", "..");
const walletPath = process.env.WALLET_FILE || path.join(projectRoot, `wallet-${P2P_PORT}.json`);
const walletDirectory = process.env.WALLET_DIRECTORY || path.join(projectRoot, `wallets-${P2P_PORT}`);
const statePath = process.env.STATE_FILE || path.join(projectRoot, `state-${P2P_PORT}.json`);
const apiRateLimit = Number(process.env.API_RATE_LIMIT || 120);
const apiRateWindowMs = Number(process.env.API_RATE_WINDOW_MS || 60_000);
const faucetCooldownMs = Number(process.env.FAUCET_COOLDOWN_MS || 30_000);
const maxRequestBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 16_384);
const nodeRuntime = process.env.NODE_RUNTIME || "local";
const storage = new NodeStorage(statePath);
const apiLimiter = new SlidingWindowRateLimiter(apiRateLimit, apiRateWindowMs);
const faucetLimiter = new CooldownLimiter(faucetCooldownMs);
let wallet = Wallet.loadOrCreate(walletPath);
Wallet.ensureDirectory(walletDirectory);

const loadedState = storage.load();
if (loadedState && blockchain.loadState(loadedState)) {
    console.log(`Loaded blockchain state from ${statePath}`);
}

function persistState() {
    // Persist after meaningful state transitions so the node can recover its local chain.
    storage.save(blockchain.exportState());
}

const p2p = new P2PServer(blockchain, persistState);

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";

        request.on("data", chunk => {
            body += chunk;

            if (Buffer.byteLength(body) > maxRequestBodyBytes) {
                reject(new Error("Request body too large"));
                request.destroy();
            }
        });

        request.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("Invalid JSON body"));
            }
        });

        request.on("error", reject);
    });
}

function getRequestSourceKey(request) {
    return request.socket.remoteAddress || "unknown";
}

function getBalancePayload(address = wallet.address) {
    const normalizedAddress = Transaction.normalizeAddress(address);

    return {
        address: normalizedAddress
            ? Transaction.toChecksumAddress(normalizedAddress)
            : address,
        confirmedBalance: blockchain.getBalance(address, false),
        availableBalance: blockchain.getBalance(address, true),
        nextNonce: blockchain.getNextNonce(address)
    };
}

function getWalletInfo(activeWallet = wallet) {
    return {
        address: activeWallet.address,
        walletFile: walletPath,
        walletDirectory
    };
}

function getStorageProfile() {
    const stateStorageKind = statePath.startsWith("/data/")
        ? "container-volume"
        : "local-file";
    const walletStorageKind = walletPath.startsWith("/data/")
        ? "container-volume"
        : "local-file";

    return {
        runtime: nodeRuntime,
        stateStorageKind,
        walletStorageKind,
        stateFile: statePath,
        walletFile: walletPath
    };
}

function getNodeInfo(sourceKey) {
    const lastBlock = blockchain.getLastBlock();
    const peerSummary = p2p.getPeerSummaries();
    const storageProfile = getStorageProfile();

    return {
        network: blockchain.getNetworkIdentity(),
        node: {
            runtime: storageProfile.runtime,
            httpPort: HTTP_PORT,
            p2pPort: P2P_PORT,
            stateFile: statePath,
            walletFile: walletPath,
            walletDirectory,
            bootstrapPeers: peers,
            stateStorageKind: storageProfile.stateStorageKind,
            walletStorageKind: storageProfile.walletStorageKind
        },
        wallet: getBalancePayload(),
        chain: {
            height: blockchain.chain.length - 1,
            blockCount: blockchain.chain.length,
            lastBlockHash: lastBlock?.hash ?? null,
            difficulty: blockchain.difficulty,
            chainWork: blockchain.getChainWork(),
            state: blockchain.getStateStats()
        },
        mempool: {
            pendingTransactionCount: blockchain.pendingTransactions.length,
            pendingFees: blockchain.getPendingFees(),
            ...blockchain.getMempoolPolicy(),
            supportedTransactionTypes: blockchain.getSupportedTransactionTypes()
        },
        peers: {
            connected: peerSummary.connectedPeers.length,
            reconnecting: peerSummary.reconnectingPeers.length,
            connectedPeers: peerSummary.connectedPeers,
            reconnectingPeers: peerSummary.reconnectingPeers
        },
        api: {
            rateLimit: apiLimiter.getUsage(sourceKey),
            maxRequestBodyBytes
        },
        faucet: {
            cooldownMs: faucetCooldownMs,
            nextAvailableInMs: faucetLimiter.getRemainingMs(sourceKey),
            currentReward: blockchain.getCurrentMiningReward()
        }
    };
}

function getSyncStatus() {
    const lastBlock = blockchain.getLastBlock();
    const peerSummary = p2p.getPeerSummaries();
    const peerCount = peerSummary.connectedPeers.length;

    return {
        network: blockchain.getNetworkIdentity(),
        localHeight: blockchain.chain.length - 1,
        localChainWork: blockchain.getChainWork(),
        lastBlockHash: lastBlock?.hash ?? null,
        pendingTransactions: blockchain.pendingTransactions.length,
        peerCount,
        reconnectingPeerCount: peerSummary.reconnectingPeers.length,
        syncState: peerCount === 0 ? "isolated" : "connected",
        isIsolated: peerCount === 0,
        hasPendingTransactions: blockchain.pendingTransactions.length > 0
    };
}

function getFaucetStatus(sourceKey) {
    return {
        network: blockchain.getNetworkIdentity(),
        cooldownMs: faucetCooldownMs,
        nextAvailableInMs: faucetLimiter.getRemainingMs(sourceKey),
        currentReward: blockchain.getCurrentMiningReward(),
        canRequestNow: faucetLimiter.getRemainingMs(sourceKey) === 0
    };
}

function listWalletsPayload() {
    const wallets = Wallet.listNamedWallets(walletDirectory).map(item => ({
        ...item,
        active: Transaction.areAddressesEqual(item.address, wallet.address)
    }));

    return {
        activeWallet: getWalletInfo(),
        wallets
    };
}

async function handleRequest(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);
    const sourceKey = getRequestSourceKey(request);

    // All HTTP routes share the same body parser, rate limits, and JSON helpers.
    if (request.method === "OPTIONS") {
        response.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        response.end();
        return;
    }

    if (!apiLimiter.allow(sourceKey)) {
        sendJson(response, 429, { error: "Too many requests, please slow down" });
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/status") {
        const storageProfile = getStorageProfile();

        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            runtime: storageProfile.runtime,
            stateStorageKind: storageProfile.stateStorageKind,
            walletStorageKind: storageProfile.walletStorageKind,
            stateFile: storageProfile.stateFile,
            walletFile: storageProfile.walletFile,
            p2pPort: P2P_PORT,
            httpPort: HTTP_PORT,
            bootstrapPeers: peers,
            wallet: getBalancePayload(),
            peers: p2p.sockets.length,
            chainHeight: blockchain.chain.length - 1,
            pendingTransactions: blockchain.pendingTransactions.length,
            difficulty: blockchain.difficulty,
            currentMiningReward: blockchain.getCurrentMiningReward(),
            initialMiningReward: blockchain.initialMiningReward,
            halvingInterval: blockchain.halvingInterval,
            pendingFees: blockchain.getPendingFees(),
            maxTransactionsPerBlock: blockchain.maxTransactionsPerBlock,
            ...blockchain.getMempoolPolicy()
        });
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/network") {
        sendJson(response, 200, blockchain.getNetworkIdentity());
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/action-policies") {
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            actionPolicies: blockchain.getActionPolicies()
        });
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/node-info") {
        sendJson(response, 200, getNodeInfo(sourceKey));
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/sync-status") {
        sendJson(response, 200, getSyncStatus());
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/stats") {
        sendJson(response, 200, blockchain.getStats());
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/state") {
        const view = requestUrl.searchParams.get("view");
        const stateResponse = view === "pending"
            ? {
                network: blockchain.getNetworkIdentity(),
                view: "pending",
                ...blockchain.getPendingStatePreview()
            }
            : {
                network: blockchain.getNetworkIdentity(),
                view: "confirmed",
                state: blockchain.getStateSnapshot(),
                stats: blockchain.getStateStats()
            };

        sendJson(response, 200, stateResponse);
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/state/pending") {
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            view: "pending",
            ...blockchain.getPendingStatePreview()
        });
        return;
    }

    if (request.method === "GET" && pathParts[0] === "state" && pathParts.length === 2) {
        const view = requestUrl.searchParams.get("view");
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            view: view === "pending" ? "pending" : "confirmed",
            ...(view === "pending"
                ? blockchain.getPendingStateKeyDetails(pathParts[1])
                : blockchain.getStateKeyDetails(pathParts[1]))
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "state" &&
        pathParts[2] === "history"
    ) {
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            key: pathParts[1],
            history: blockchain.getStateHistory(pathParts[1])
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts.length === 1
    ) {
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            apps: blockchain.getAppDefinitions(),
            actionPolicyCount: blockchain.getActionPolicies().length
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "counter" &&
        pathParts.length === 3
    ) {
        const view = requestUrl.searchParams.get("view");
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            owner: pathParts[2],
            view: view === "pending" ? "pending" : "confirmed",
            counters: blockchain.getCounterItems(pathParts[2], { pending: view === "pending" })
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "counter" &&
        pathParts.length === 4
    ) {
        const view = requestUrl.searchParams.get("view");
        const counter = blockchain.getCounterItem(pathParts[2], pathParts[3], { pending: view === "pending" });

        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            owner: pathParts[2],
            id: pathParts[3],
            view: view === "pending" ? "pending" : "confirmed",
            exists: Boolean(counter),
            counter
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "registry" &&
        pathParts.length === 2
    ) {
        const view = requestUrl.searchParams.get("view");
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            view: view === "pending" ? "pending" : "confirmed",
            entries: blockchain.getRegistryEntries({ pending: view === "pending" })
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "registry" &&
        pathParts.length === 3
    ) {
        const view = requestUrl.searchParams.get("view");
        const entry = blockchain.getRegistryEntry(pathParts[2], { pending: view === "pending" });

        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            name: pathParts[2],
            view: view === "pending" ? "pending" : "confirmed",
            exists: Boolean(entry),
            entry
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "profile" &&
        pathParts.length === 3
    ) {
        const view = requestUrl.searchParams.get("view");
        const profile = blockchain.getProfile(pathParts[2], { pending: view === "pending" });

        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            owner: pathParts[2],
            view: view === "pending" ? "pending" : "confirmed",
            exists: Boolean(profile),
            profile
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "todo" &&
        pathParts.length === 3
    ) {
        const view = requestUrl.searchParams.get("view");
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            owner: pathParts[2],
            view: view === "pending" ? "pending" : "confirmed",
            todos: blockchain.getTodoItems(pathParts[2], { pending: view === "pending" })
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "notes" &&
        pathParts.length === 3
    ) {
        const view = requestUrl.searchParams.get("view");
        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            owner: pathParts[2],
            view: view === "pending" ? "pending" : "confirmed",
            notes: blockchain.getNoteItems(pathParts[2], { pending: view === "pending" })
        });
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "notes" &&
        pathParts.length === 4
    ) {
        const view = requestUrl.searchParams.get("view");
        const note = blockchain.getNoteItem(pathParts[2], pathParts[3], { pending: view === "pending" });

        sendJson(response, 200, {
            network: blockchain.getNetworkIdentity(),
            owner: pathParts[2],
            id: pathParts[3],
            view: view === "pending" ? "pending" : "confirmed",
            exists: Boolean(note),
            note
        });
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/address") {
        sendJson(response, 200, { address: wallet.address, walletFile: walletPath });
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/wallet") {
        sendJson(response, 200, getWalletInfo());
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/wallets") {
        sendJson(response, 200, listWalletsPayload());
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/wallet/export") {
        sendJson(response, 200, wallet.exportData());
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/new") {
        try {
            const { name } = await readJsonBody(request);
            wallet = Wallet.create();
            wallet.save(walletPath);
            const namedWalletFile = name
                ? Wallet.saveNamedWallet(walletDirectory, name, wallet)
                : null;

            sendJson(response, 201, {
                message: "New wallet created successfully",
                address: wallet.address,
                walletFile: walletPath,
                namedWalletFile
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/mnemonic/new") {
        try {
            const { name } = await readJsonBody(request);
            wallet = Wallet.createFromMnemonic();
            wallet.save(walletPath);
            const namedWalletFile = name
                ? Wallet.saveNamedWallet(walletDirectory, name, wallet)
                : null;

            sendJson(response, 201, {
                message: "New mnemonic wallet created successfully",
                address: wallet.address,
                walletFile: walletPath,
                namedWalletFile,
                mnemonic: wallet.mnemonic,
                mnemonicWordCount: wallet.mnemonic.split(" ").length,
                mnemonicType: "custom-v1"
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/balance") {
        const address = requestUrl.searchParams.get("address") || wallet.address;

        if (!Transaction.isValidAddress(address)) {
            sendJson(response, 400, { error: "Invalid address" });
            return;
        }

        sendJson(response, 200, getBalancePayload(address));
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/chain") {
        sendJson(response, 200, blockchain.chain);
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/blocks") {
        sendJson(response, 200, blockchain.getBlockSummaries());
        return;
    }

    if (request.method === "GET" && pathParts[0] === "blocks" && pathParts[1]) {
        const block = blockchain.getBlockByHash(pathParts[1]);

        if (!block) {
            sendJson(response, 404, { error: "Block not found" });
            return;
        }

        sendJson(response, 200, block);
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/mempool") {
        sendJson(response, 200, blockchain.pendingTransactions);
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "transactions" &&
        pathParts[1] &&
        pathParts[2] === "receipt"
    ) {
        const receipt = blockchain.getTransactionReceipt(pathParts[1]);

        if (receipt.status === "not_found") {
            sendJson(response, 404, { error: "Transaction receipt not found", receipt });
            return;
        }

        sendJson(response, 200, receipt);
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "transactions" &&
        pathParts[1] &&
        pathParts.length === 2
    ) {
        const transactionInfo = blockchain.findTransaction(pathParts[1]);

        if (!transactionInfo) {
            sendJson(response, 404, { error: "Transaction not found" });
            return;
        }

        sendJson(response, 200, transactionInfo);
        return;
    }

    if (
        request.method === "GET" &&
        pathParts[0] === "addresses" &&
        pathParts[1] &&
        pathParts[2] === "transactions"
    ) {
        if (!Transaction.isValidAddress(pathParts[1])) {
            sendJson(response, 400, { error: "Invalid address" });
            return;
        }

        sendJson(response, 200, blockchain.getAddressActivity(pathParts[1]));
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/peers") {
        sendJson(response, 200, { connectedPeers: p2p.sockets.length });
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/peers/full") {
        sendJson(response, 200, p2p.getPeerSummaries());
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/faucet/status") {
        sendJson(response, 200, getFaucetStatus(sourceKey));
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/transactions") {
        try {
            const {
                to,
                amount,
                fee = 0,
                type = Transaction.TYPES.TRANSFER,
                payload = null
            } = await readJsonBody(request);

            if (!Transaction.isValidType(type)) {
                sendJson(response, 400, { error: "Unsupported transaction type" });
                return;
            }

            if (typeof fee !== "number" || fee < 0) {
                sendJson(response, 400, { error: "Field 'fee' must be a non-negative number" });
                return;
            }

            if (!Transaction.isValidAddress(to)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            let normalizedAmount = amount;

            if (type === Transaction.TYPES.TRANSFER) {
                if (typeof amount !== "number") {
                    sendJson(response, 400, { error: "Fields 'to' and numeric 'amount' are required" });
                    return;
                }
            } else if (type === Transaction.TYPES.DATA) {
                if (payload == null) {
                    sendJson(response, 400, { error: "Field 'payload' is required for data transactions" });
                    return;
                }

                normalizedAmount = amount == null ? 0 : amount;
            }

            const transaction = wallet.createTransaction(
                to,
                normalizedAmount,
                blockchain,
                fee,
                { type, payload }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/apps/todo") {
        try {
            const { id, text, fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "todo",
                        action: "create",
                        params: { id, text }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Todo creation transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/apps/profile") {
        try {
            const { displayName, bio = "", fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "profile",
                        action: "set",
                        params: { displayName, bio }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Profile set transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/apps/registry") {
        try {
            const { name, record, fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "registry",
                        action: "set",
                        params: { name, record }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Registry set transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/apps/counter") {
        try {
            const { id, initialValue, fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "counter",
                        action: "create",
                        params: { id, initialValue }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Counter create transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/apps/notes") {
        try {
            const { id, content, fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "notes",
                        action: "set",
                        params: { id, content }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Note set transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "counter" &&
        pathParts[3] === "add"
    ) {
        try {
            const { delta, fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "counter",
                        action: "add",
                        params: { id: pathParts[2], delta }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Counter add transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "counter" &&
        pathParts[3] === "sub"
    ) {
        try {
            const { delta, fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "counter",
                        action: "sub",
                        params: { id: pathParts[2], delta }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Counter sub transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "counter" &&
        pathParts[3] === "delete"
    ) {
        try {
            const { fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "counter",
                        action: "delete",
                        params: { id: pathParts[2] }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Counter delete transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "registry" &&
        pathParts[3] === "delete"
    ) {
        try {
            const { fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "registry",
                        action: "delete",
                        params: { name: pathParts[2] }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Registry delete transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "profile" &&
        pathParts[2] === "delete"
    ) {
        try {
            const { fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "profile",
                        action: "delete",
                        params: {}
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Profile delete transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "todo" &&
        pathParts[3] === "toggle"
    ) {
        try {
            const { fee = 0, done, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "todo",
                        action: "toggle",
                        params: { id: pathParts[2], done }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Todo toggle transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "notes" &&
        pathParts[3] === "delete"
    ) {
        try {
            const { fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "notes",
                        action: "delete",
                        params: { id: pathParts[2] }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Note delete transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (
        request.method === "POST" &&
        pathParts[0] === "apps" &&
        pathParts[1] === "todo" &&
        pathParts[3] === "delete"
    ) {
        try {
            const { fee = 0, to } = await readJsonBody(request);
            const targetAddress = to || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid recipient address" });
                return;
            }

            const transaction = wallet.createTransaction(
                targetAddress,
                0,
                blockchain,
                fee,
                {
                    type: Transaction.TYPES.DATA,
                    payload: {
                        app: "todo",
                        action: "delete",
                        params: { id: pathParts[2] }
                    }
                }
            );
            blockchain.addTransaction(transaction);
            persistState();
            p2p.broadcastTransaction(transaction);

            sendJson(response, 201, {
                message: "Todo delete transaction created",
                transaction
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/mine") {
        try {
            const { minerAddress } = await readJsonBody(request);
            const rewardAddress = minerAddress || wallet.address;

            blockchain.minePendingTransactions(rewardAddress);
            persistState();
            p2p.broadcastNewBlock(blockchain.getLastBlock());

            sendJson(response, 200, {
                message: "Block mined",
                block: blockchain.getLastBlock(),
                miner: rewardAddress
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/faucet") {
        try {
            const { address } = await readJsonBody(request);
            const targetAddress = address || wallet.address;

            if (!Transaction.isValidAddress(targetAddress)) {
                sendJson(response, 400, { error: "Invalid faucet address" });
                return;
            }

            if (!faucetLimiter.allow(sourceKey)) {
                sendJson(response, 429, {
                    error: `Faucet cooldown active. Try again in ${Math.ceil(faucetCooldownMs / 1000)} seconds`
                });
                return;
            }

            const rewardBeforeMining = blockchain.getCurrentMiningReward();
            blockchain.minePendingTransactions(targetAddress);
            persistState();
            p2p.broadcastNewBlock(blockchain.getLastBlock());

            sendJson(response, 200, {
                message: "Faucet mined a test block for the requested address",
                address: targetAddress,
                amount: rewardBeforeMining,
                block: blockchain.getLastBlock()
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/peers") {
        try {
            const { peer } = await readJsonBody(request);

            if (!peer) {
                sendJson(response, 400, { error: "Field 'peer' is required" });
                return;
            }

            p2p.connectToPeer(peer);
            sendJson(response, 200, { message: "Peer connection started", peer });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/import") {
        try {
            const { privateKey, name } = await readJsonBody(request);

            if (!Wallet.isValidPrivateKey(privateKey)) {
                sendJson(response, 400, { error: "Invalid private key format" });
                return;
            }

            wallet = Wallet.fromPrivateKey(privateKey);
            wallet.save(walletPath);
            const namedWalletFile = name
                ? Wallet.saveNamedWallet(walletDirectory, name, wallet)
                : null;

            sendJson(response, 200, {
                message: "Wallet imported successfully",
                address: wallet.address,
                walletFile: walletPath,
                namedWalletFile
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/mnemonic/import") {
        try {
            const { mnemonic, name } = await readJsonBody(request);

            wallet = Wallet.fromMnemonic(mnemonic);
            wallet.save(walletPath);
            const namedWalletFile = name
                ? Wallet.saveNamedWallet(walletDirectory, name, wallet)
                : null;

            sendJson(response, 200, {
                message: "Mnemonic wallet imported successfully",
                address: wallet.address,
                walletFile: walletPath,
                namedWalletFile,
                mnemonic: wallet.mnemonic,
                mnemonicWordCount: wallet.mnemonic.split(" ").length,
                mnemonicType: "custom-v1"
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/save") {
        try {
            const { filePath, name } = await readJsonBody(request);
            const namedWalletFile = name
                ? Wallet.saveNamedWallet(walletDirectory, name, wallet)
                : null;
            const targetPath = filePath || walletPath;
            wallet.save(targetPath);

            sendJson(response, 200, {
                message: "Wallet saved successfully",
                address: wallet.address,
                walletFile: path.resolve(targetPath),
                namedWalletFile
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/load") {
        try {
            const { filePath } = await readJsonBody(request);

            if (!filePath || typeof filePath !== "string") {
                sendJson(response, 400, { error: "Field 'filePath' is required" });
                return;
            }

            wallet = Wallet.loadFromFile(filePath);
            wallet.save(walletPath);

            sendJson(response, 200, {
                message: "Wallet loaded successfully",
                address: wallet.address,
                sourceWalletFile: path.resolve(filePath),
                activeWalletFile: walletPath
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/wallet/switch") {
        try {
            const { name } = await readJsonBody(request);

            if (!name || typeof name !== "string") {
                sendJson(response, 400, { error: "Field 'name' is required" });
                return;
            }

            const loaded = Wallet.loadNamedWallet(walletDirectory, name);
            wallet = loaded.wallet;
            wallet.save(walletPath);

            sendJson(response, 200, {
                message: "Active wallet switched successfully",
                name: Wallet.normalizeWalletName(name),
                address: wallet.address,
                sourceWalletFile: loaded.filePath,
                activeWalletFile: walletPath
            });
        } catch (error) {
            sendJson(response, 400, { error: error.message });
        }
        return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/") {
        sendJson(response, 200, {
            name: blockchain.networkName,
            message: "Duglas Testnet node is running",
            docs: {
                readme: "See README.md in the project root",
                quickstart: "See docs/quickstart.md",
                cli: "See docs/cli.md",
                httpApi: "See docs/http-api.md"
            },
            endpoints: {
                status: "/status",
                network: "/network",
                stats: "/stats",
                address: "/address",
                balance: "/balance",
                blocks: "/blocks",
                mempool: "/mempool"
            }
        });
        return;
    }

    sendJson(response, 404, { error: "Route not found" });
}

p2p.listen(P2P_PORT);
peers.forEach(peer => p2p.connectToPeer(peer));
persistState();

const server = http.createServer((request, response) => {
    handleRequest(request, response).catch(error => {
        sendJson(response, 500, { error: error.message });
    });
});

server.listen(HTTP_PORT, () => {
    console.log(`HTTP API listening on port ${HTTP_PORT}`);
    console.log(`P2P port: ${P2P_PORT}`);
    console.log(`Bootstrap peers: ${peers.length ? peers.join(", ") : "none"}`);
    console.log(`Wallet address: ${wallet.address}`);
    console.log(`Wallet file: ${walletPath}`);
    console.log(`State file: ${statePath}`);
    console.log(`API rate limit: ${apiRateLimit}/${apiRateWindowMs}ms`);
    console.log(`Faucet cooldown: ${faucetCooldownMs}ms`);
});
