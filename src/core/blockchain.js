const crypto = require("crypto");
const { Transaction } = require("./transaction");
const INITIAL_DIFFICULTY = 3;
const MIN_DIFFICULTY = INITIAL_DIFFICULTY;
const BLOCK_VERSION = 1;
const NETWORK_NAME = "Duglas Testnet";
const NETWORK_SYMBOL = "DUG";
const NETWORK_DECIMALS = 4;
const NETWORK_CHAIN_ID = 180322;
const NETWORK_PROTOCOL_VERSION = 1;
const NETWORK_CONSENSUS = "pow-sha256";
const NETWORK_ADDRESS_FORMAT = "evm-like-0x";
const STATE_OPERATIONS = Object.freeze({
    SET: "kv:set",
    DELETE: "kv:delete",
    INCREMENT: "kv:increment",
    TODO_CREATE: "todo:create",
    TODO_TOGGLE: "todo:toggle",
    TODO_DELETE: "todo:delete",
    NOTE_SET: "note:set",
    NOTE_DELETE: "note:delete",
    PROFILE_SET: "profile:set",
    PROFILE_DELETE: "profile:delete",
    REGISTRY_SET: "registry:set",
    REGISTRY_DELETE: "registry:delete",
    COUNTER_CREATE: "counter:create",
    COUNTER_ADD: "counter:add",
    COUNTER_SUB: "counter:sub",
    COUNTER_DELETE: "counter:delete"
});
const APP_DEFINITIONS = Object.freeze({
    todo: Object.freeze({
        name: "todo",
        title: "Todo App",
        description: "Namespaced task items with create, toggle and delete operations.",
        prefix: "todo",
        operations: Object.freeze([
            STATE_OPERATIONS.TODO_CREATE,
            STATE_OPERATIONS.TODO_TOGGLE,
            STATE_OPERATIONS.TODO_DELETE
        ])
    }),
    notes: Object.freeze({
        name: "notes",
        title: "Notes App",
        description: "Namespaced text notes with set and delete operations.",
        prefix: "note",
        operations: Object.freeze([
            STATE_OPERATIONS.NOTE_SET,
            STATE_OPERATIONS.NOTE_DELETE
        ])
    }),
    profile: Object.freeze({
        name: "profile",
        title: "Profile App",
        description: "Account-level profile state with one profile per address.",
        prefix: "profile",
        operations: Object.freeze([
            STATE_OPERATIONS.PROFILE_SET,
            STATE_OPERATIONS.PROFILE_DELETE
        ])
    }),
    registry: Object.freeze({
        name: "registry",
        title: "Registry App",
        description: "Global name registry with ownership-based updates and deletes.",
        prefix: "registry",
        operations: Object.freeze([
            STATE_OPERATIONS.REGISTRY_SET,
            STATE_OPERATIONS.REGISTRY_DELETE
        ])
    }),
    counter: Object.freeze({
        name: "counter",
        title: "Counter App",
        description: "Namespaced numeric counters with create/add/sub/delete state transitions.",
        prefix: "counter",
        operations: Object.freeze([
            STATE_OPERATIONS.COUNTER_CREATE,
            STATE_OPERATIONS.COUNTER_ADD,
            STATE_OPERATIONS.COUNTER_SUB,
            STATE_OPERATIONS.COUNTER_DELETE
        ])
    })
});
const ACTION_POLICIES = Object.freeze([
    Object.freeze({
        app: "kv",
        appTitle: "State Layer",
        action: "set",
        operation: STATE_OPERATIONS.SET,
        description: "Set or overwrite one confirmed state key.",
        params: Object.freeze([
            Object.freeze({ name: "key", type: "string", required: true, description: "State key to update." }),
            Object.freeze({ name: "value", type: "any", required: true, description: "Next value to store at the key." })
        ])
    }),
    Object.freeze({
        app: "kv",
        appTitle: "State Layer",
        action: "delete",
        operation: STATE_OPERATIONS.DELETE,
        description: "Delete one confirmed state key.",
        params: Object.freeze([
            Object.freeze({ name: "key", type: "string", required: true, description: "State key to delete." })
        ])
    }),
    Object.freeze({
        app: "kv",
        appTitle: "State Layer",
        action: "increment",
        operation: STATE_OPERATIONS.INCREMENT,
        description: "Increment a numeric state key by a signed delta.",
        params: Object.freeze([
            Object.freeze({ name: "key", type: "string", required: true, description: "Numeric state key to update." }),
            Object.freeze({ name: "amount", type: "number", required: true, description: "Signed numeric delta to apply." })
        ])
    }),
    Object.freeze({
        app: "todo",
        appTitle: "Todo App",
        action: "create",
        operation: STATE_OPERATIONS.TODO_CREATE,
        description: "Create a todo item for the sender namespace.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Todo identifier." }),
            Object.freeze({ name: "text", type: "string", required: true, description: "Todo text content." })
        ])
    }),
    Object.freeze({
        app: "todo",
        appTitle: "Todo App",
        action: "toggle",
        operation: STATE_OPERATIONS.TODO_TOGGLE,
        description: "Toggle or explicitly set a todo completion flag.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Todo identifier." }),
            Object.freeze({ name: "done", type: "boolean", required: false, description: "Optional explicit completion flag." })
        ])
    }),
    Object.freeze({
        app: "todo",
        appTitle: "Todo App",
        action: "delete",
        operation: STATE_OPERATIONS.TODO_DELETE,
        description: "Delete a todo item from the sender namespace.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Todo identifier." })
        ])
    }),
    Object.freeze({
        app: "notes",
        appTitle: "Notes App",
        action: "set",
        operation: STATE_OPERATIONS.NOTE_SET,
        description: "Create or overwrite a note for the sender namespace.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Note identifier." }),
            Object.freeze({ name: "content", type: "string", required: true, description: "Note body text." })
        ])
    }),
    Object.freeze({
        app: "notes",
        appTitle: "Notes App",
        action: "delete",
        operation: STATE_OPERATIONS.NOTE_DELETE,
        description: "Delete a note from the sender namespace.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Note identifier." })
        ])
    }),
    Object.freeze({
        app: "profile",
        appTitle: "Profile App",
        action: "set",
        operation: STATE_OPERATIONS.PROFILE_SET,
        description: "Create or update the sender profile document.",
        params: Object.freeze([
            Object.freeze({ name: "displayName", type: "string", required: true, description: "Profile display name." }),
            Object.freeze({ name: "bio", type: "string", required: false, description: "Optional profile bio." })
        ])
    }),
    Object.freeze({
        app: "profile",
        appTitle: "Profile App",
        action: "delete",
        operation: STATE_OPERATIONS.PROFILE_DELETE,
        description: "Delete the sender profile document.",
        params: Object.freeze([])
    }),
    Object.freeze({
        app: "registry",
        appTitle: "Registry App",
        action: "set",
        operation: STATE_OPERATIONS.REGISTRY_SET,
        description: "Claim or update a global registry name.",
        params: Object.freeze([
            Object.freeze({ name: "name", type: "string", required: true, description: "Registry name to claim." }),
            Object.freeze({ name: "record", type: "string", required: true, description: "Record value stored for the name." })
        ])
    }),
    Object.freeze({
        app: "registry",
        appTitle: "Registry App",
        action: "delete",
        operation: STATE_OPERATIONS.REGISTRY_DELETE,
        description: "Delete a global registry name owned by the sender.",
        params: Object.freeze([
            Object.freeze({ name: "name", type: "string", required: true, description: "Registry name to delete." })
        ])
    }),
    Object.freeze({
        app: "counter",
        appTitle: "Counter App",
        action: "create",
        operation: STATE_OPERATIONS.COUNTER_CREATE,
        description: "Create a numeric counter for the sender namespace.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Counter identifier." }),
            Object.freeze({ name: "initialValue", type: "number", required: false, description: "Optional initial numeric value." })
        ])
    }),
    Object.freeze({
        app: "counter",
        appTitle: "Counter App",
        action: "add",
        operation: STATE_OPERATIONS.COUNTER_ADD,
        description: "Increase a sender-owned counter by a positive delta.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Counter identifier." }),
            Object.freeze({ name: "delta", type: "number", required: true, description: "Positive numeric delta." })
        ])
    }),
    Object.freeze({
        app: "counter",
        appTitle: "Counter App",
        action: "sub",
        operation: STATE_OPERATIONS.COUNTER_SUB,
        description: "Decrease a sender-owned counter by a positive delta.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Counter identifier." }),
            Object.freeze({ name: "delta", type: "number", required: true, description: "Positive numeric delta." })
        ])
    }),
    Object.freeze({
        app: "counter",
        appTitle: "Counter App",
        action: "delete",
        operation: STATE_OPERATIONS.COUNTER_DELETE,
        description: "Delete a sender-owned counter.",
        params: Object.freeze([
            Object.freeze({ name: "id", type: "string", required: true, description: "Counter identifier." })
        ])
    })
]);
const ACTION_POLICY_MAP = Object.freeze(
    Object.fromEntries(
        ACTION_POLICIES.map(policy => [`${policy.app}:${policy.action}`, policy])
    )
);
const ACTION_OPERATION_MAP = Object.freeze(
    Object.fromEntries(
        ACTION_POLICIES.map(policy => [`${policy.app}:${policy.action}`, policy.operation])
    )
);

const SHA256 = message =>
    crypto.createHash("sha256").update(message).digest("hex");

class Block {
    constructor(
        timestamp,
        transactions,
        difficulty = INITIAL_DIFFICULTY,
        prevHash = "",
        height = 0,
        version = BLOCK_VERSION
    ) {
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.prevHash = prevHash;
        this.height = height;
        this.version = version;
        this.merkleRoot = Block.calculateMerkleRoot(transactions);
        this.nonce = 0;
        this.difficulty = difficulty;
        this.hash = this.getHash();
    }

    static calculateMerkleRoot(transactions) {
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return SHA256("");
        }

        // Build a simple binary Merkle tree from transaction ids.
        let layer = transactions.map(transaction =>
            SHA256(transaction.txId ?? JSON.stringify(transaction))
        );

        while (layer.length > 1) {
            const nextLayer = [];

            for (let i = 0; i < layer.length; i += 2) {
                const left = layer[i];
                const right = layer[i + 1] ?? left;
                nextLayer.push(SHA256(left + right));
            }

            layer = nextLayer;
        }

        return layer[0];
    }

    static calculateHashForBlock(block) {
        if (
            typeof block.version !== "number" ||
            typeof block.height !== "number" ||
            typeof block.merkleRoot !== "string"
        ) {
            return SHA256(
                block.prevHash +
                block.timestamp +
                JSON.stringify(block.transactions) +
                block.nonce
            );
        }

        return SHA256(
            block.version +
            block.prevHash +
            block.merkleRoot +
            block.timestamp +
            block.height +
            block.difficulty +
            block.nonce
        );
    }

    getHash() {
        return Block.calculateHashForBlock(this);
    }

    mine() {
        const target = "0".repeat(this.difficulty);

        while (this.hash.substring(0, this.difficulty) !== target) {
            this.nonce++;
            this.hash = this.getHash();
        }
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];

        this.difficulty = INITIAL_DIFFICULTY;
        this.blockTime = 3000;
        this.adjustmentInterval = 5;

        this.pendingTransactions = [];
        this.initialMiningReward = 50;
        this.halvingInterval = 10;
        this.maxTransactionsPerBlock = 5;
        this.maxPendingTransactions = 250;
        this.maxPendingTransactionsPerSender = 16;
        this.maxPendingDataTransactionsPerSender = 8;
        this.minReplacementFeeBump = 1;
        this.minDataTransactionFee = 1;
        this.dataFeePerChunk = 1;
        this.dataFeeChunkBytes = 1024;
        this.resetDerivedState();
    }

    getSupportedTransactionTypes() {
        return Object.values(Transaction.TYPES);
    }

    getMempoolPolicy() {
        return {
            maxPendingTransactions: this.maxPendingTransactions,
            maxPendingTransactionsPerSender: this.maxPendingTransactionsPerSender,
            maxPendingDataTransactionsPerSender: this.maxPendingDataTransactionsPerSender,
            minReplacementFeeBump: this.minReplacementFeeBump,
            minDataTransactionFee: this.minDataTransactionFee,
            dataFeePerChunk: this.dataFeePerChunk,
            dataFeeChunkBytes: this.dataFeeChunkBytes
        };
    }

    getSupportedStateOperations() {
        return Object.values(STATE_OPERATIONS);
    }

    getAppDefinitions() {
        return Object.values(APP_DEFINITIONS).map(definition => ({ ...definition }));
    }

    getAppDefinition(name) {
        return APP_DEFINITIONS[name] ?? null;
    }

    getActionPolicies() {
        return ACTION_POLICIES.map(policy => ({
            app: policy.app,
            appTitle: policy.appTitle,
            action: policy.action,
            operation: policy.operation,
            description: policy.description,
            params: policy.params.map(param => ({ ...param }))
        }));
    }

    getActionPolicy(app, action) {
        if (typeof app !== "string" || typeof action !== "string") {
            return null;
        }

        return ACTION_POLICY_MAP[`${app}:${action}`] ?? null;
    }

    getActionPolicyByOperation(operationName) {
        return ACTION_POLICIES.find(policy => policy.operation === operationName) ?? null;
    }

    normalizeTodoId(todoId) {
        if (typeof todoId !== "string" || todoId.trim().length === 0) {
            throw new Error("Todo id must be a non-empty string");
        }

        const normalizedId = todoId.trim().toLowerCase();

        if (!/^[a-z0-9_-]+$/.test(normalizedId)) {
            throw new Error("Todo id may contain only letters, numbers, hyphens and underscores");
        }

        return normalizedId;
    }

    normalizeNoteId(noteId) {
        if (typeof noteId !== "string" || noteId.trim().length === 0) {
            throw new Error("Note id must be a non-empty string");
        }

        const normalizedId = noteId.trim().toLowerCase();

        if (!/^[a-z0-9_-]+$/.test(normalizedId)) {
            throw new Error("Note id may contain only letters, numbers, hyphens and underscores");
        }

        return normalizedId;
    }

    normalizeRegistryName(name) {
        if (typeof name !== "string" || name.trim().length === 0) {
            throw new Error("Registry name must be a non-empty string");
        }

        const normalizedName = name.trim().toLowerCase();

        if (!/^[a-z0-9_-]{1,32}$/.test(normalizedName)) {
            throw new Error("Registry name may contain only letters, numbers, hyphens and underscores, up to 32 chars");
        }

        return normalizedName;
    }

    normalizeCounterId(counterId) {
        if (typeof counterId !== "string" || counterId.trim().length === 0) {
            throw new Error("Counter id must be a non-empty string");
        }

        const normalizedId = counterId.trim().toLowerCase();

        if (!/^[a-z0-9_-]{1,32}$/.test(normalizedId)) {
            throw new Error("Counter id may contain only letters, numbers, hyphens and underscores, up to 32 chars");
        }

        return normalizedId;
    }

    buildTodoStateKey(ownerAddress, todoId) {
        const normalizedOwner = this.normalizeAddress(ownerAddress);

        if (!normalizedOwner) {
            throw new Error("Invalid todo owner address");
        }

        return `todo:${normalizedOwner}:${this.normalizeTodoId(todoId)}`;
    }

    buildNoteStateKey(ownerAddress, noteId) {
        const normalizedOwner = this.normalizeAddress(ownerAddress);

        if (!normalizedOwner) {
            throw new Error("Invalid note owner address");
        }

        return `note:${normalizedOwner}:${this.normalizeNoteId(noteId)}`;
    }

    buildProfileStateKey(ownerAddress) {
        const normalizedOwner = this.normalizeAddress(ownerAddress);

        if (!normalizedOwner) {
            throw new Error("Invalid profile owner address");
        }

        return `profile:${normalizedOwner}`;
    }

    buildRegistryStateKey(name) {
        return `registry:${this.normalizeRegistryName(name)}`;
    }

    buildCounterStateKey(ownerAddress, counterId) {
        const normalizedOwner = this.normalizeAddress(ownerAddress);

        if (!normalizedOwner) {
            throw new Error("Invalid counter owner address");
        }

        return `counter:${normalizedOwner}:${this.normalizeCounterId(counterId)}`;
    }

    resetDerivedState() {
        this.state = new Map();
        this.stateHistory = new Map();
        this.executionResults = new Map();
    }

    getStateEntry(key) {
        return this.state.get(key) ?? null;
    }

    getStateEntryFromMap(stateMap, key) {
        return stateMap.get(key) ?? null;
    }

    getStateValue(key) {
        const entry = this.getStateEntry(key);
        return entry ? entry.value : null;
    }

    getStateSnapshotFromMap(stateMap) {
        return Array.from(stateMap.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => ({
                key,
                value: entry.value,
                owner: entry.owner,
                updatedByTxId: entry.updatedByTxId,
                updatedAtBlockHeight: entry.updatedAtBlockHeight,
                updatedAtTimestamp: entry.updatedAtTimestamp
            }));
    }

    getStateSnapshot() {
        return this.getStateSnapshotFromMap(this.state);
    }

    getStateHistory(key) {
        return (this.stateHistory.get(key) ?? []).map(entry => ({ ...entry }));
    }

    getStateStatsFromMaps(stateMap, historyMap) {
        const totalChanges = Array.from(historyMap.values()).reduce(
            (sum, entries) => sum + entries.length,
            0
        );

        return {
            activeKeys: stateMap.size,
            totalChanges,
            supportedOperations: this.getSupportedStateOperations()
        };
    }

    getStateStats() {
        return this.getStateStatsFromMaps(this.state, this.stateHistory);
    }

    getFormalActionPayloadResolution(payload) {
        if (!payload || typeof payload !== "object") {
            return {
                operation: null,
                policy: null,
                error: null,
                isFormalActionPayload: false
            };
        }

        const hasFormalFields = (
            Object.prototype.hasOwnProperty.call(payload, "app") ||
            Object.prototype.hasOwnProperty.call(payload, "action") ||
            Object.prototype.hasOwnProperty.call(payload, "params")
        );

        if (!hasFormalFields) {
            return {
                operation: null,
                policy: null,
                error: null,
                isFormalActionPayload: false
            };
        }

        if (
            typeof payload.app !== "string" ||
            typeof payload.action !== "string" ||
            payload.params == null ||
            typeof payload.params !== "object" ||
            Array.isArray(payload.params)
        ) {
            return {
                operation: null,
                policy: null,
                error: "Formal action payload requires string 'app', string 'action', and object 'params'",
                isFormalActionPayload: true
            };
        }

        const policy = this.getActionPolicy(payload.app, payload.action);

        if (!policy) {
            return {
                operation: null,
                policy: null,
                error: `Unsupported action policy: ${payload.app}:${payload.action}`,
                isFormalActionPayload: true
            };
        }

        return {
            operation: {
                op: policy.operation,
                ...payload.params
            },
            policy,
            error: null,
            isFormalActionPayload: true
        };
    }

    translateActionPayload(payload) {
        if (!payload || typeof payload !== "object") {
            return null;
        }

        if (typeof payload.op === "string") {
            return payload;
        }

        const resolution = this.getFormalActionPayloadResolution(payload);
        return resolution.operation;
    }

    resolveStateOperation(transaction) {
        const transactionType = Transaction.inferType(
            transaction.from,
            transaction.type ?? null
        );

        if (transactionType !== Transaction.TYPES.DATA || !transaction.payload) {
            return {
                operation: null,
                policy: null,
                error: null,
                payloadFormat: null
            };
        }

        if (typeof transaction.payload.op === "string") {
            return {
                operation: transaction.payload,
                policy: this.getActionPolicyByOperation(transaction.payload.op),
                error: null,
                payloadFormat: "legacy"
            };
        }

        const resolution = this.getFormalActionPayloadResolution(transaction.payload);
        return {
            operation: resolution.operation,
            policy: resolution.policy,
            error: resolution.error,
            payloadFormat: resolution.isFormalActionPayload ? "action" : null
        };
    }

    validateActionPolicyPayload(policy, params) {
        for (const parameter of policy.params) {
            const hasValue = Object.prototype.hasOwnProperty.call(params, parameter.name);

            if (parameter.required && !hasValue) {
                return `Action '${policy.app}:${policy.action}' requires param '${parameter.name}'`;
            }

            if (!hasValue) {
                continue;
            }

            const value = params[parameter.name];

            if (parameter.type === "any") {
                continue;
            }

            if (parameter.type === "number") {
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    return `Action '${policy.app}:${policy.action}' param '${parameter.name}' must be a finite number`;
                }

                continue;
            }

            if (parameter.type === "boolean") {
                if (typeof value !== "boolean") {
                    return `Action '${policy.app}:${policy.action}' param '${parameter.name}' must be boolean`;
                }

                continue;
            }

            if (parameter.type === "string") {
                if (typeof value !== "string") {
                    return `Action '${policy.app}:${policy.action}' param '${parameter.name}' must be a string`;
                }

                continue;
            }

            if (parameter.type === "object") {
                if (!value || typeof value !== "object" || Array.isArray(value)) {
                    return `Action '${policy.app}:${policy.action}' param '${parameter.name}' must be an object`;
                }
            }
        }

        return null;
    }

    parseStateOperation(transaction) {
        const { operation: normalizedPayload } = this.resolveStateOperation(transaction);

        if (!normalizedPayload) {
            return null;
        }

        const {
            op,
            key,
            value,
            amount,
            id,
            text,
            done,
            content,
            displayName,
            bio,
            name,
            record,
            initialValue,
            delta
        } = normalizedPayload;

        return {
            op,
            key,
            value,
            amount,
            id,
            text,
            done,
            content,
            displayName,
            bio,
            name,
            record,
            initialValue,
            delta
        };
    }

    getNormalizedStateActor(transaction) {
        return this.normalizeAddress(transaction.from);
    }

    createStateEntry(value, owner, transaction, blockHeight) {
        return {
            value,
            owner,
            updatedByTxId: transaction.txId,
            updatedAtBlockHeight: blockHeight,
            updatedAtTimestamp: transaction.timestamp
        };
    }

    createStateHistoryEntry(action, key, owner, previousValue, nextValue, transaction, blockHeight, extra = {}) {
        return {
            action,
            key,
            owner,
            previousValue,
            nextValue,
            txId: transaction.txId,
            blockHeight,
            timestamp: transaction.timestamp,
            ...extra
        };
    }

    createStateExecutionResult(baseResult, key, action, owner, previousValue, nextValue, extra = {}) {
        return {
            ...baseResult,
            stateChanges: [
                {
                    key,
                    action,
                    owner,
                    previousValue,
                    nextValue,
                    ...extra
                }
            ]
        };
    }

    getStateOperationHandlers() {
        return {
            [STATE_OPERATIONS.SET]: {
                requiresExplicitKey: true,
                validate: operation => {
                    if (!Object.prototype.hasOwnProperty.call(operation, "value")) {
                        return "State set operation requires a value";
                    }

                    return null;
                },
                resolveKey: operation => operation.key,
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, actor, transaction, blockHeight, operation } = context;
                    const nextEntry = this.createStateEntry(
                        operation.value,
                        previousEntry?.owner ?? actor,
                        transaction,
                        blockHeight
                    );

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "set",
                            resolvedKey,
                            nextEntry.owner,
                            previousValue,
                            operation.value,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "set",
                        nextEntry.owner,
                        previousValue,
                        operation.value
                    );
                }
            },
            [STATE_OPERATIONS.DELETE]: {
                requiresExplicitKey: true,
                resolveKey: operation => operation.key,
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`State key '${resolvedKey}' does not exist`]
                        };
                    }

                    stateMap.delete(resolvedKey);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "delete",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            null,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "delete",
                        previousEntry.owner,
                        previousValue,
                        null
                    );
                }
            },
            [STATE_OPERATIONS.INCREMENT]: {
                requiresExplicitKey: true,
                validate: operation => {
                    if (
                        typeof operation.amount !== "number" ||
                        !Number.isFinite(operation.amount) ||
                        operation.amount === 0
                    ) {
                        return "State increment operation requires a non-zero numeric amount";
                    }

                    return null;
                },
                resolveKey: operation => operation.key,
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, actor, transaction, blockHeight, operation } = context;

                    if (previousEntry && typeof previousEntry.value !== "number") {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`State key '${resolvedKey}' is not numeric and cannot be incremented`]
                        };
                    }

                    const currentValue = previousEntry ? previousEntry.value : 0;
                    const nextValue = currentValue + operation.amount;
                    const nextEntry = this.createStateEntry(
                        nextValue,
                        previousEntry?.owner ?? actor,
                        transaction,
                        blockHeight
                    );

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "increment",
                            resolvedKey,
                            nextEntry.owner,
                            currentValue,
                            nextValue,
                            transaction,
                            blockHeight,
                            { delta: operation.amount }
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "increment",
                        nextEntry.owner,
                        currentValue,
                        nextValue,
                        { delta: operation.amount }
                    );
                }
            },
            [STATE_OPERATIONS.TODO_CREATE]: {
                validate: operation => {
                    try {
                        this.normalizeTodoId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    if (typeof operation.text !== "string" || operation.text.trim().length === 0) {
                        return "Todo create operation requires a non-empty text value";
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildTodoStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, actor, transaction, blockHeight, operation } = context;

                    if (previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Todo '${operation.id}' already exists for this owner`]
                        };
                    }

                    const todoValue = {
                        id: this.normalizeTodoId(operation.id),
                        text: operation.text.trim(),
                        done: false,
                        createdBy: actor,
                        createdAt: transaction.timestamp,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(todoValue, actor, transaction, blockHeight);

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "todo:create",
                            resolvedKey,
                            actor,
                            null,
                            todoValue,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "todo:create",
                        actor,
                        null,
                        todoValue
                    );
                }
            },
            [STATE_OPERATIONS.TODO_TOGGLE]: {
                validate: operation => {
                    try {
                        this.normalizeTodoId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    if (operation.done !== undefined && typeof operation.done !== "boolean") {
                        return "Todo toggle operation field 'done' must be boolean when provided";
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildTodoStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Todo '${operation.id}' does not exist for this owner`]
                        };
                    }

                    const currentTodo = previousEntry.value;
                    const nextDone = typeof operation.done === "boolean"
                        ? operation.done
                        : !Boolean(currentTodo.done);
                    const nextTodo = {
                        ...currentTodo,
                        done: nextDone,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(
                        nextTodo,
                        previousEntry.owner,
                        transaction,
                        blockHeight
                    );

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "todo:toggle",
                            resolvedKey,
                            previousEntry.owner,
                            currentTodo,
                            nextTodo,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "todo:toggle",
                        previousEntry.owner,
                        currentTodo,
                        nextTodo
                    );
                }
            },
            [STATE_OPERATIONS.TODO_DELETE]: {
                validate: operation => {
                    try {
                        this.normalizeTodoId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildTodoStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Todo '${operation.id}' does not exist for this owner`]
                        };
                    }

                    stateMap.delete(resolvedKey);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "todo:delete",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            null,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "todo:delete",
                        previousEntry.owner,
                        previousValue,
                        null
                    );
                }
            },
            [STATE_OPERATIONS.NOTE_SET]: {
                validate: operation => {
                    try {
                        this.normalizeNoteId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    if (typeof operation.content !== "string" || operation.content.trim().length === 0) {
                        return "Note set operation requires a non-empty content value";
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildNoteStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, actor, transaction, blockHeight, operation } = context;
                    const normalizedId = this.normalizeNoteId(operation.id);
                    const noteContent = operation.content.trim();
                    const currentNote = previousEntry?.value ?? null;
                    const nextNote = {
                        id: normalizedId,
                        content: noteContent,
                        createdBy: currentNote?.createdBy ?? actor,
                        createdAt: currentNote?.createdAt ?? transaction.timestamp,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(
                        nextNote,
                        previousEntry?.owner ?? actor,
                        transaction,
                        blockHeight
                    );
                    const action = currentNote ? "note:update" : "note:create";

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            action,
                            resolvedKey,
                            nextEntry.owner,
                            previousValue,
                            nextNote,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        action,
                        nextEntry.owner,
                        previousValue,
                        nextNote
                    );
                }
            },
            [STATE_OPERATIONS.NOTE_DELETE]: {
                validate: operation => {
                    try {
                        this.normalizeNoteId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildNoteStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Note '${operation.id}' does not exist for this owner`]
                        };
                    }

                    stateMap.delete(resolvedKey);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "note:delete",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            null,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "note:delete",
                        previousEntry.owner,
                        previousValue,
                        null
                    );
                }
            },
            [STATE_OPERATIONS.PROFILE_SET]: {
                validate: operation => {
                    if (typeof operation.displayName !== "string" || operation.displayName.trim().length === 0) {
                        return "Profile set operation requires a non-empty displayName";
                    }

                    if (operation.bio !== undefined && typeof operation.bio !== "string") {
                        return "Profile set operation field 'bio' must be a string when provided";
                    }

                    return null;
                },
                resolveKey: (_, actor) => this.buildProfileStateKey(actor),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, actor, transaction, blockHeight, operation } = context;
                    const currentProfile = previousEntry?.value ?? null;
                    const nextProfile = {
                        address: actor,
                        displayName: operation.displayName.trim(),
                        bio: typeof operation.bio === "string" ? operation.bio.trim() : "",
                        createdBy: currentProfile?.createdBy ?? actor,
                        createdAt: currentProfile?.createdAt ?? transaction.timestamp,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(
                        nextProfile,
                        previousEntry?.owner ?? actor,
                        transaction,
                        blockHeight
                    );
                    const action = currentProfile ? "profile:update" : "profile:create";

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            action,
                            resolvedKey,
                            nextEntry.owner,
                            previousValue,
                            nextProfile,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        action,
                        nextEntry.owner,
                        previousValue,
                        nextProfile
                    );
                }
            },
            [STATE_OPERATIONS.PROFILE_DELETE]: {
                resolveKey: (_, actor) => this.buildProfileStateKey(actor),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: ["Profile does not exist for this owner"]
                        };
                    }

                    stateMap.delete(resolvedKey);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "profile:delete",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            null,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "profile:delete",
                        previousEntry.owner,
                        previousValue,
                        null
                    );
                }
            },
            [STATE_OPERATIONS.REGISTRY_SET]: {
                validate: operation => {
                    try {
                        this.normalizeRegistryName(operation.name);
                    } catch (error) {
                        return error.message;
                    }

                    if (typeof operation.record !== "string" || operation.record.trim().length === 0) {
                        return "Registry set operation requires a non-empty record value";
                    }

                    return null;
                },
                resolveKey: operation => this.buildRegistryStateKey(operation.name),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, actor, transaction, blockHeight, operation } = context;
                    const normalizedName = this.normalizeRegistryName(operation.name);
                    const currentRecord = previousEntry?.value ?? null;
                    const nextRecord = {
                        name: normalizedName,
                        record: operation.record.trim(),
                        ownerAddress: actor,
                        createdBy: currentRecord?.createdBy ?? actor,
                        createdAt: currentRecord?.createdAt ?? transaction.timestamp,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(
                        nextRecord,
                        previousEntry?.owner ?? actor,
                        transaction,
                        blockHeight
                    );
                    const action = currentRecord ? "registry:update" : "registry:create";

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            action,
                            resolvedKey,
                            nextEntry.owner,
                            previousValue,
                            nextRecord,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        action,
                        nextEntry.owner,
                        previousValue,
                        nextRecord
                    );
                }
            },
            [STATE_OPERATIONS.REGISTRY_DELETE]: {
                validate: operation => {
                    try {
                        this.normalizeRegistryName(operation.name);
                    } catch (error) {
                        return error.message;
                    }

                    return null;
                },
                resolveKey: operation => this.buildRegistryStateKey(operation.name),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Registry name '${operation.name}' does not exist`]
                        };
                    }

                    stateMap.delete(resolvedKey);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "registry:delete",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            null,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "registry:delete",
                        previousEntry.owner,
                        previousValue,
                        null
                    );
                }
            },
            [STATE_OPERATIONS.COUNTER_CREATE]: {
                validate: operation => {
                    try {
                        this.normalizeCounterId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    if (
                        typeof operation.initialValue !== "number" ||
                        !Number.isFinite(operation.initialValue) ||
                        !Number.isInteger(operation.initialValue) ||
                        operation.initialValue < 0
                    ) {
                        return "Counter create operation requires a non-negative integer initialValue";
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildCounterStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, actor, transaction, blockHeight, operation } = context;

                    if (previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Counter '${operation.id}' already exists for this owner`]
                        };
                    }

                    const nextCounter = {
                        id: this.normalizeCounterId(operation.id),
                        value: operation.initialValue,
                        createdBy: actor,
                        createdAt: transaction.timestamp,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(nextCounter, actor, transaction, blockHeight);

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "counter:create",
                            resolvedKey,
                            actor,
                            null,
                            nextCounter,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "counter:create",
                        actor,
                        null,
                        nextCounter
                    );
                }
            },
            [STATE_OPERATIONS.COUNTER_ADD]: {
                validate: operation => {
                    try {
                        this.normalizeCounterId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    if (
                        typeof operation.delta !== "number" ||
                        !Number.isFinite(operation.delta) ||
                        !Number.isInteger(operation.delta) ||
                        operation.delta <= 0
                    ) {
                        return "Counter add operation requires a positive integer delta";
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildCounterStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Counter '${operation.id}' does not exist for this owner`]
                        };
                    }

                    const currentCounter = previousEntry.value;
                    const nextCounter = {
                        ...currentCounter,
                        value: currentCounter.value + operation.delta,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(nextCounter, previousEntry.owner, transaction, blockHeight);

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "counter:add",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            nextCounter,
                            transaction,
                            blockHeight,
                            { delta: operation.delta }
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "counter:add",
                        previousEntry.owner,
                        previousValue,
                        nextCounter,
                        { delta: operation.delta }
                    );
                }
            },
            [STATE_OPERATIONS.COUNTER_SUB]: {
                validate: operation => {
                    try {
                        this.normalizeCounterId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    if (
                        typeof operation.delta !== "number" ||
                        !Number.isFinite(operation.delta) ||
                        !Number.isInteger(operation.delta) ||
                        operation.delta <= 0
                    ) {
                        return "Counter sub operation requires a positive integer delta";
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildCounterStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Counter '${operation.id}' does not exist for this owner`]
                        };
                    }

                    const currentCounter = previousEntry.value;

                    if (currentCounter.value - operation.delta < 0) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Counter '${operation.id}' cannot go below zero`]
                        };
                    }

                    const nextCounter = {
                        ...currentCounter,
                        value: currentCounter.value - operation.delta,
                        updatedAt: transaction.timestamp
                    };
                    const nextEntry = this.createStateEntry(nextCounter, previousEntry.owner, transaction, blockHeight);

                    stateMap.set(resolvedKey, nextEntry);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "counter:sub",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            nextCounter,
                            transaction,
                            blockHeight,
                            { delta: operation.delta }
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "counter:sub",
                        previousEntry.owner,
                        previousValue,
                        nextCounter,
                        { delta: operation.delta }
                    );
                }
            },
            [STATE_OPERATIONS.COUNTER_DELETE]: {
                validate: operation => {
                    try {
                        this.normalizeCounterId(operation.id);
                    } catch (error) {
                        return error.message;
                    }

                    return null;
                },
                resolveKey: (operation, actor) => this.buildCounterStateKey(actor, operation.id),
                apply: context => {
                    const { baseResult, stateMap, historyMap, resolvedKey, previousEntry, previousValue, transaction, blockHeight, operation } = context;

                    if (!previousEntry) {
                        return {
                            ...baseResult,
                            status: "rejected",
                            logs: [`Counter '${operation.id}' does not exist for this owner`]
                        };
                    }

                    stateMap.delete(resolvedKey);
                    this.recordStateHistoryInMap(
                        historyMap,
                        resolvedKey,
                        this.createStateHistoryEntry(
                            "counter:delete",
                            resolvedKey,
                            previousEntry.owner,
                            previousValue,
                            null,
                            transaction,
                            blockHeight
                        )
                    );

                    return this.createStateExecutionResult(
                        baseResult,
                        resolvedKey,
                        "counter:delete",
                        previousEntry.owner,
                        previousValue,
                        null
                    );
                }
            }
        };
    }

    getStateOperationHandler(operationName) {
        return this.getStateOperationHandlers()[operationName] ?? null;
    }

    getMinimumFeeForTransaction(transaction) {
        const transactionType = Transaction.inferType(
            transaction.from,
            transaction.type ?? null
        );

        if (transactionType !== Transaction.TYPES.DATA) {
            return 0;
        }

        const payloadBytes = Transaction.getPayloadSize(transaction.payload ?? null);
        const chunkCount = Math.max(
            1,
            Math.ceil(payloadBytes / Math.max(1, this.dataFeeChunkBytes))
        );

        return this.minDataTransactionFee + ((chunkCount - 1) * this.dataFeePerChunk);
    }

    validateStateTransaction(transaction) {
        const resolvedOperation = this.resolveStateOperation(transaction);

        if (resolvedOperation.error) {
            return resolvedOperation.error;
        }

        if (
            resolvedOperation.payloadFormat === "action" &&
            resolvedOperation.policy &&
            transaction.payload?.params
        ) {
            const actionPayloadError = this.validateActionPolicyPayload(
                resolvedOperation.policy,
                transaction.payload.params
            );

            if (actionPayloadError) {
                return actionPayloadError;
            }
        }

        const operation = resolvedOperation.operation;

        if (!operation) {
            return null;
        }

        const handler = this.getStateOperationHandler(operation.op);

        if (!handler) {
            return `Unsupported state operation: ${operation.op}`;
        }

        const requiresExplicitKey = handler.requiresExplicitKey === true;

        if (
            requiresExplicitKey &&
            (typeof operation.key !== "string" || operation.key.trim().length === 0)
        ) {
            return "State operation key must be a non-empty string";
        }

        if (typeof handler.validate === "function") {
            const validationError = handler.validate(operation);

            if (validationError) {
                return validationError;
            }
        }

        return null;
    }

    resolveStateOperationKey(operation, actor) {
        if (!operation) {
            return null;
        }

        const handler = this.getStateOperationHandler(operation.op);
        return handler?.resolveKey
            ? handler.resolveKey(operation, actor)
            : operation.key;
    }

    recordStateHistoryInMap(historyMap, key, entry) {
        const history = historyMap.get(key) ?? [];
        history.push(entry);
        historyMap.set(key, history);
    }

    recordStateHistory(key, entry) {
        this.recordStateHistoryInMap(this.stateHistory, key, entry);
    }

    cloneStateMap(stateMap) {
        return new Map(
            Array.from(stateMap.entries()).map(([key, entry]) => [
                key,
                { ...entry }
            ])
        );
    }

    cloneHistoryMap(historyMap) {
        return new Map(
            Array.from(historyMap.entries()).map(([key, entries]) => [
                key,
                entries.map(entry => ({ ...entry }))
            ])
        );
    }

    applyStateTransactionToMaps(stateMap, historyMap, transaction, blockHeight = null) {
        const baseResult = {
            status: "applied",
            blockHeight,
            payloadHash: Transaction.getPayloadHash(transaction.payload ?? null),
            payloadBytes: Transaction.getPayloadSize(transaction.payload ?? null),
            stateChanges: [],
            logs: []
        };

        const operation = this.parseStateOperation(transaction);

        if (!operation) {
            return baseResult;
        }

        const validationError = this.validateStateTransaction(transaction);

        if (validationError) {
            return {
                ...baseResult,
                status: "rejected",
                logs: [validationError]
            };
        }

        const actor = this.getNormalizedStateActor(transaction);
        const resolvedKey = this.resolveStateOperationKey(operation, actor);
        const previousEntry = this.getStateEntryFromMap(stateMap, resolvedKey);
        const previousValue = previousEntry ? previousEntry.value : null;

        if (previousEntry && actor && previousEntry.owner !== actor) {
            return {
                ...baseResult,
                status: "rejected",
                logs: [`State key '${resolvedKey}' is owned by another address`]
            };
        }

        const handler = this.getStateOperationHandler(operation.op);

        if (!handler?.apply) {
            return {
                ...baseResult,
                status: "rejected",
                logs: [`Unsupported state operation: ${operation.op}`]
            };
        }

        return handler.apply({
            baseResult,
            stateMap,
            historyMap,
            transaction,
            blockHeight,
            operation,
            actor,
            resolvedKey,
            previousEntry,
            previousValue
        });
    }

    executeTransactionState(transaction, blockHeight = null) {
        return this.applyStateTransactionToMaps(
            this.state,
            this.stateHistory,
            transaction,
            blockHeight
        );
    }

    rebuildDerivedState() {
        this.resetDerivedState();

        for (let blockHeight = 0; blockHeight < this.chain.length; blockHeight++) {
            const block = this.chain[blockHeight];

            for (const transaction of block.transactions) {
                this.executionResults.set(
                    transaction.txId,
                    this.executeTransactionState(transaction, blockHeight)
                );
            }
        }
    }

    getPendingTransactionsInExecutionOrder() {
        const orderedTransactions = [];
        const remainingTransactions = [...this.pendingTransactions];
        const selectedTransactions = [];

        while (remainingTransactions.length > 0) {
            const usedTransactionIds = new Set(selectedTransactions.map(
                transaction => transaction.txId
            ));
            const eligibleTransactions = remainingTransactions
                .filter(transaction => !usedTransactionIds.has(transaction.txId))
                .filter(transaction => {
                    if (transaction.from === null) {
                        return false;
                    }

                    const normalizedFrom = this.normalizeAddress(transaction.from);
                    const senderSelectedTransactions = selectedTransactions.filter(
                        selectedTransaction => this.addressesEqual(selectedTransaction.from, normalizedFrom)
                    );
                    const expectedNonce = senderSelectedTransactions.length > 0
                        ? senderSelectedTransactions[senderSelectedTransactions.length - 1].nonce + 1
                        : this.getConfirmedNonce(normalizedFrom);

                    return transaction.nonce === expectedNonce;
                });

            if (eligibleTransactions.length === 0) {
                break;
            }

            eligibleTransactions.sort((left, right) => {
                if (right.fee !== left.fee) {
                    return right.fee - left.fee;
                }

                return left.timestamp - right.timestamp;
            });

            const nextTransaction = eligibleTransactions[0];
            orderedTransactions.push(nextTransaction);
            selectedTransactions.push(nextTransaction);

            const index = remainingTransactions.findIndex(
                transaction => transaction.txId === nextTransaction.txId
            );

            if (index !== -1) {
                remainingTransactions.splice(index, 1);
            }
        }

        return orderedTransactions;
    }

    getPendingStatePreview() {
        const stateMap = this.cloneStateMap(this.state);
        const historyMap = this.cloneHistoryMap(this.stateHistory);
        const executions = [];
        const orderedTransactions = this.getPendingTransactionsInExecutionOrder().filter(
            transaction => Transaction.inferType(transaction.from, transaction.type ?? null) === Transaction.TYPES.DATA
        );

        for (const transaction of orderedTransactions) {
            const execution = this.applyStateTransactionToMaps(
                stateMap,
                historyMap,
                transaction,
                null
            );

            executions.push({
                txId: transaction.txId,
                ...execution
            });
        }

        const appliedCount = executions.filter(execution => execution.status === "applied").length;
        const rejectedCount = executions.filter(execution => execution.status === "rejected").length;

        return {
            state: this.getStateSnapshotFromMap(stateMap),
            stats: {
                ...this.getStateStatsFromMaps(stateMap, historyMap),
                pendingAppliedTransactions: appliedCount,
                pendingRejectedTransactions: rejectedCount
            },
            executions
        };
    }

    getPendingStateKeyDetails(key) {
        const preview = this.getPendingStatePreview();
        const entry = preview.state.find(item => item.key === key) ?? null;
        const relatedExecutions = preview.executions.filter(execution =>
            execution.stateChanges.some(change => change.key === key) ||
            execution.logs.some(log => log.includes(`'${key}'`))
        );

        return {
            key,
            exists: Boolean(entry),
            owner: entry?.owner ?? null,
            value: entry?.value ?? null,
            updatedByTxId: entry?.updatedByTxId ?? null,
            updatedAtBlockHeight: entry?.updatedAtBlockHeight ?? null,
            updatedAtTimestamp: entry?.updatedAtTimestamp ?? null,
            pendingPreview: true,
            pendingExecutions: relatedExecutions
        };
    }

    getStateEntriesByPrefix(prefix, options = {}) {
        const sourceEntries = options.pending
            ? this.getPendingStatePreview().state
            : this.getStateSnapshot();

        return sourceEntries.filter(entry => entry.key.startsWith(prefix));
    }

    getNamespacedAppItems(ownerAddress, appName, options = {}, mapEntry) {
        const normalizedOwner = this.normalizeAddress(ownerAddress);
        const appDefinition = this.getAppDefinition(appName);

        if (!normalizedOwner || !appDefinition) {
            return [];
        }

        const prefix = `${appDefinition.prefix}:${normalizedOwner}:`;
        const sourceEntries = this.getStateEntriesByPrefix(prefix, options);

        return sourceEntries
            .map(entry => mapEntry(entry, prefix))
            .sort((left, right) => left.id.localeCompare(right.id));
    }

    getTodoItems(ownerAddress, options = {}) {
        return this.getNamespacedAppItems(ownerAddress, "todo", options, (entry, prefix) => ({
                key: entry.key,
                owner: entry.owner,
                id: entry.value?.id ?? entry.key.slice(prefix.length),
                text: entry.value?.text ?? "",
                done: Boolean(entry.value?.done),
                createdBy: entry.value?.createdBy ?? null,
                createdAt: entry.value?.createdAt ?? null,
                updatedAt: entry.value?.updatedAt ?? null,
                updatedAtBlockHeight: entry.updatedAtBlockHeight,
                updatedByTxId: entry.updatedByTxId
        }));
    }

    getNoteItems(ownerAddress, options = {}) {
        return this.getNamespacedAppItems(ownerAddress, "notes", options, (entry, prefix) => ({
                key: entry.key,
                owner: entry.owner,
                id: entry.value?.id ?? entry.key.slice(prefix.length),
                content: entry.value?.content ?? "",
                createdBy: entry.value?.createdBy ?? null,
                createdAt: entry.value?.createdAt ?? null,
                updatedAt: entry.value?.updatedAt ?? null,
                updatedAtBlockHeight: entry.updatedAtBlockHeight,
                updatedByTxId: entry.updatedByTxId
        }));
    }

    getNoteItem(ownerAddress, noteId, options = {}) {
        let key;

        try {
            key = this.buildNoteStateKey(ownerAddress, noteId);
        } catch {
            return null;
        }

        const items = this.getNoteItems(ownerAddress, options);

        return items.find(item => item.key === key) ?? null;
    }

    getProfile(ownerAddress, options = {}) {
        let key;

        try {
            key = this.buildProfileStateKey(ownerAddress);
        } catch {
            return null;
        }

        const sourceEntries = options.pending
            ? this.getPendingStatePreview().state
            : this.getStateSnapshot();
        const entry = sourceEntries.find(item => item.key === key) ?? null;

        if (!entry) {
            return null;
        }

        return {
            key: entry.key,
            owner: entry.owner,
            address: entry.value?.address ?? ownerAddress,
            displayName: entry.value?.displayName ?? "",
            bio: entry.value?.bio ?? "",
            createdBy: entry.value?.createdBy ?? null,
            createdAt: entry.value?.createdAt ?? null,
            updatedAt: entry.value?.updatedAt ?? null,
            updatedAtBlockHeight: entry.updatedAtBlockHeight,
            updatedByTxId: entry.updatedByTxId
        };
    }

    getRegistryEntries(options = {}) {
        const sourceEntries = this.getStateEntriesByPrefix("registry:", options);

        return sourceEntries
            .map(entry => ({
                key: entry.key,
                owner: entry.owner,
                name: entry.value?.name ?? entry.key.slice("registry:".length),
                record: entry.value?.record ?? "",
                ownerAddress: entry.value?.ownerAddress ?? entry.owner,
                createdBy: entry.value?.createdBy ?? null,
                createdAt: entry.value?.createdAt ?? null,
                updatedAt: entry.value?.updatedAt ?? null,
                updatedAtBlockHeight: entry.updatedAtBlockHeight,
                updatedByTxId: entry.updatedByTxId
            }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    getRegistryEntry(name, options = {}) {
        let key;

        try {
            key = this.buildRegistryStateKey(name);
        } catch {
            return null;
        }

        return this.getRegistryEntries(options).find(entry => entry.key === key) ?? null;
    }

    getCounterItems(ownerAddress, options = {}) {
        return this.getNamespacedAppItems(ownerAddress, "counter", options, (entry, prefix) => ({
            key: entry.key,
            owner: entry.owner,
            id: entry.value?.id ?? entry.key.slice(prefix.length),
            value: entry.value?.value ?? 0,
            createdBy: entry.value?.createdBy ?? null,
            createdAt: entry.value?.createdAt ?? null,
            updatedAt: entry.value?.updatedAt ?? null,
            updatedAtBlockHeight: entry.updatedAtBlockHeight,
            updatedByTxId: entry.updatedByTxId
        }));
    }

    getCounterItem(ownerAddress, counterId, options = {}) {
        let key;

        try {
            key = this.buildCounterStateKey(ownerAddress, counterId);
        } catch {
            return null;
        }

        const items = this.getCounterItems(ownerAddress, options);

        return items.find(item => item.key === key) ?? null;
    }

    getGenesisId() {
        return this.chain[0]?.hash ?? this.createGenesisBlock().hash;
    }

    getNetworkIdentity() {
        return {
            networkName: NETWORK_NAME,
            symbol: NETWORK_SYMBOL,
            decimals: NETWORK_DECIMALS,
            chainId: NETWORK_CHAIN_ID,
            protocolVersion: NETWORK_PROTOCOL_VERSION,
            blockVersion: BLOCK_VERSION,
            consensus: NETWORK_CONSENSUS,
            addressFormat: NETWORK_ADDRESS_FORMAT,
            genesisId: this.getGenesisId()
        };
    }

    createGenesisBlock() {
        return this.createBlock(0, [], INITIAL_DIFFICULTY, "0", 0);
    }

    createLegacyGenesisBlock() {
        const genesis = {
            timestamp: 0,
            transactions: [],
            prevHash: "0",
            nonce: 0,
            difficulty: INITIAL_DIFFICULTY
        };
        genesis.hash = Block.calculateHashForBlock(genesis);
        return genesis;
    }

    createBlock(timestamp, transactions, difficulty, prevHash, height) {
        return new Block(
            timestamp,
            transactions,
            difficulty,
            prevHash,
            height,
            BLOCK_VERSION
        );
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    normalizeAddress(address) {
        return Transaction.normalizeAddress(address);
    }

    addressesEqual(left, right) {
        return Transaction.areAddressesEqual(left, right);
    }

    getConfirmedNonce(address) {
        const normalizedAddress = this.normalizeAddress(address);

        if (!normalizedAddress) {
            return 0;
        }

        let nonce = 0;

        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (this.addressesEqual(tx.from, normalizedAddress)) {
                    nonce++;
                }
            }
        }

        return nonce;
    }

    getNextNonce(address) {
        const normalizedAddress = this.normalizeAddress(address);

        if (!normalizedAddress) {
            return 0;
        }

        const pendingNonceCount = this.pendingTransactions.filter(
            tx => this.addressesEqual(tx.from, normalizedAddress)
        ).length;

        return this.getConfirmedNonce(normalizedAddress) + pendingNonceCount;
    }

    hasTransactionInPending(transaction) {
        return this.pendingTransactions.some(tx => tx.txId === transaction.txId);
    }

    getPendingTransactionsForAddress(address) {
        return this.pendingTransactions.filter(tx =>
            this.addressesEqual(tx.from, address)
        );
    }

    findPendingTransactionBySenderAndNonce(transaction) {
        return this.pendingTransactions.find(tx =>
            this.addressesEqual(tx.from, transaction.from) &&
            tx.nonce === transaction.nonce
        ) ?? null;
    }

    replacePendingTransaction(previousTransaction, nextTransaction) {
        const index = this.pendingTransactions.findIndex(
            transaction => transaction.txId === previousTransaction.txId
        );

        if (index === -1) {
            return false;
        }

        this.pendingTransactions[index] = nextTransaction;
        return true;
    }

    getPendingDataTransactionsForAddress(address) {
        return this.getPendingTransactionsForAddress(address).filter(transaction =>
            Transaction.inferType(transaction.from, transaction.type ?? null) === Transaction.TYPES.DATA
        );
    }

    addTransaction(transaction) {
        if (!(transaction instanceof Transaction)) {
            throw new Error("Only Transaction instances allowed");
        }

        if (!transaction.isValid()) {
            throw new Error("Invalid transaction");
        }

        if (this.hasTransactionInChain(transaction) || this.hasTransactionInPending(transaction)) {
            throw new Error("Duplicate transaction");
        }

        const stateValidationError = this.validateStateTransaction(transaction);
        if (stateValidationError) {
            throw new Error(stateValidationError);
        }

        const minimumFee = this.getMinimumFeeForTransaction(transaction);

        if (transaction.fee < minimumFee) {
            throw new Error(`Transaction fee is below minimum required fee of ${minimumFee}`);
        }

        // Validate sender funds against both confirmed and pending debits.
        if (transaction.from !== null) {
            const transactionType = Transaction.inferType(
                transaction.from,
                transaction.type ?? null
            );
            const replacementTransaction = this.findPendingTransactionBySenderAndNonce(transaction);
            const senderPendingTransactions = this.getPendingTransactionsForAddress(transaction.from);
            const senderPendingDataTransactions = this.getPendingDataTransactionsForAddress(transaction.from);

            if (replacementTransaction) {
                if (transaction.fee < replacementTransaction.fee + this.minReplacementFeeBump) {
                    throw new Error(
                        `Replacement transaction fee must be at least ${replacementTransaction.fee + this.minReplacementFeeBump}`
                    );
                }
            } else {
                const expectedNonce = this.getNextNonce(transaction.from);

                if (transaction.nonce !== expectedNonce) {
                    throw new Error("Invalid transaction nonce");
                }

                if (senderPendingTransactions.length >= this.maxPendingTransactionsPerSender) {
                    throw new Error("Too many pending transactions for sender");
                }

                if (
                    transactionType === Transaction.TYPES.DATA &&
                    senderPendingDataTransactions.length >= this.maxPendingDataTransactionsPerSender
                ) {
                    throw new Error("Too many pending data transactions for sender");
                }

                if (this.pendingTransactions.length >= this.maxPendingTransactions) {
                    throw new Error("Mempool is full");
                }
            }

            const confirmedBalance = this.getBalance(transaction.from, false);

            const pendingSpent = senderPendingTransactions
                .filter(tx => !replacementTransaction || tx.txId !== replacementTransaction.txId)
                .reduce((sum, tx) => sum + tx.amount + tx.fee, 0);

            if (confirmedBalance - pendingSpent < transaction.amount + transaction.fee) {
                throw new Error("Insufficient balance");
            }

            if (replacementTransaction) {
                this.replacePendingTransaction(replacementTransaction, transaction);
                return;
            }
        }

        this.pendingTransactions.push(transaction);
    }

    getPendingFees() {
        return this.pendingTransactions.reduce(
            (sum, transaction) => sum + transaction.fee,
            0
        );
    }

    getMiningRewardAtHeight(height) {
        if (height <= 0) {
            return 0;
        }

        const halvings = Math.floor((height - 1) / this.halvingInterval);
        const reward = this.initialMiningReward / Math.pow(2, halvings);

        return reward >= 1 ? reward : 0;
    }

    getCurrentMiningReward() {
        return this.getMiningRewardAtHeight(this.chain.length);
    }

    getTransactionExecutionResult(transaction, options = {}) {
        const {
            status = "applied",
            blockHeight = null
        } = options;

        if (status === "pending") {
            const preview = this.getPendingStatePreview();
            const executionPreview = preview.executions.find(
                execution => execution.txId === transaction.txId
            ) ?? {
                status: "pending",
                blockHeight,
                payloadHash: Transaction.getPayloadHash(transaction.payload ?? null),
                payloadBytes: Transaction.getPayloadSize(transaction.payload ?? null),
                stateChanges: [],
                logs: []
            };
            return {
                ...executionPreview,
                status: executionPreview.status === "rejected" ? "rejected" : "pending"
            };
        }

        const confirmedExecution = this.executionResults.get(transaction.txId);
        if (confirmedExecution) {
            return { ...confirmedExecution };
        }

        return {
            status,
            blockHeight,
            payloadHash: Transaction.getPayloadHash(transaction.payload ?? null),
            payloadBytes: Transaction.getPayloadSize(transaction.payload ?? null),
            stateChanges: [],
            logs: []
        };
    }

    getFeesForTransactions(transactions) {
        return transactions.reduce(
            (sum, transaction) => sum + transaction.fee,
            0
        );
    }

    getEligiblePendingTransactions(selectedTransactions) {
        const expectedNonces = new Map();

        for (const transaction of selectedTransactions) {
            if (transaction.from === null) {
                continue;
            }

            expectedNonces.set(
                this.normalizeAddress(transaction.from),
                transaction.nonce + 1
            );
        }

        return this.pendingTransactions.filter(transaction => {
            const normalizedFrom = this.normalizeAddress(transaction.from);
            const expectedNonce = expectedNonces.has(normalizedFrom)
                ? expectedNonces.get(normalizedFrom)
                : this.getConfirmedNonce(normalizedFrom);

            return transaction.nonce === expectedNonce;
        });
    }

    getTransactionsForNextBlock() {
        const selectedTransactions = [];
        const usedTransactionIds = new Set();

        while (selectedTransactions.length < this.maxTransactionsPerBlock) {
            const eligibleTransactions = this.getEligiblePendingTransactions(
                selectedTransactions
            ).filter(transaction => !usedTransactionIds.has(transaction.txId));

            if (eligibleTransactions.length === 0) {
                break;
            }

            eligibleTransactions.sort((a, b) => {
                if (b.fee !== a.fee) {
                    return b.fee - a.fee;
                }

                return a.timestamp - b.timestamp;
            });

            const nextTransaction = eligibleTransactions[0];
            selectedTransactions.push(nextTransaction);
            usedTransactionIds.add(nextTransaction.txId);
        }

        return selectedTransactions;
    }

    minePendingTransactions(minerAddress) {
        const txs = this.getTransactionsForNextBlock();
        const totalFees = this.getFeesForTransactions(txs);
        const blockReward = this.getCurrentMiningReward();
        const blockTimestamp = Date.now();

        // reward transaction
        txs.push(
            new Transaction(
                null,
                minerAddress,
                blockReward + totalFees,
                blockTimestamp,
                this.chain.length,
                0
            )
        );

        const previousBlock = this.getLastBlock();
        const block = this.createBlock(
            blockTimestamp,
            txs,
            this.difficulty,
            previousBlock.hash,
            this.chain.length
        );

        block.mine();

        this.chain.push(block);
        this.rebuildDerivedState();

        this.removePendingTransactions(txs);

        if (this.chain.length % this.adjustmentInterval === 0) {
            this.adjustDifficulty();
        }
    }

    exportState() {
        return {
            chain: this.chain,
            pendingTransactions: this.pendingTransactions,
            difficulty: this.difficulty,
            maxTransactionsPerBlock: this.maxTransactionsPerBlock,
            maxPendingTransactions: this.maxPendingTransactions,
            maxPendingTransactionsPerSender: this.maxPendingTransactionsPerSender,
            minReplacementFeeBump: this.minReplacementFeeBump,
            maxPendingDataTransactionsPerSender: this.maxPendingDataTransactionsPerSender,
            minDataTransactionFee: this.minDataTransactionFee,
            dataFeePerChunk: this.dataFeePerChunk,
            dataFeeChunkBytes: this.dataFeeChunkBytes,
            initialMiningReward: this.initialMiningReward,
            halvingInterval: this.halvingInterval
        };
    }

    loadState(state) {
        if (!state || !Array.isArray(state.chain)) {
            return false;
        }

        if (!this.isValidChain(state.chain)) {
            return false;
        }

        const pendingTransactions = Array.isArray(state.pendingTransactions)
            ? state.pendingTransactions.map(tx => Transaction.fromData(tx))
            : [];

        const originalChain = this.chain;
        const originalPendingTransactions = this.pendingTransactions;
        const originalDifficulty = this.difficulty;

        this.chain = state.chain;
        this.pendingTransactions = [];
        this.difficulty = typeof state.difficulty === "number"
            ? Math.max(MIN_DIFFICULTY, state.difficulty)
            : this.getLastBlock().difficulty;
        this.maxTransactionsPerBlock = typeof state.maxTransactionsPerBlock === "number"
            ? Math.max(1, Math.floor(state.maxTransactionsPerBlock))
            : this.maxTransactionsPerBlock;
        this.maxPendingTransactions = typeof state.maxPendingTransactions === "number"
            ? Math.max(1, Math.floor(state.maxPendingTransactions))
            : this.maxPendingTransactions;
        this.maxPendingTransactionsPerSender = typeof state.maxPendingTransactionsPerSender === "number"
            ? Math.max(1, Math.floor(state.maxPendingTransactionsPerSender))
            : this.maxPendingTransactionsPerSender;
        this.minReplacementFeeBump = typeof state.minReplacementFeeBump === "number"
            ? Math.max(0, state.minReplacementFeeBump)
            : this.minReplacementFeeBump;
        this.maxPendingDataTransactionsPerSender = typeof state.maxPendingDataTransactionsPerSender === "number"
            ? Math.max(1, Math.floor(state.maxPendingDataTransactionsPerSender))
            : this.maxPendingDataTransactionsPerSender;
        this.minDataTransactionFee = typeof state.minDataTransactionFee === "number"
            ? Math.max(0, state.minDataTransactionFee)
            : this.minDataTransactionFee;
        this.dataFeePerChunk = typeof state.dataFeePerChunk === "number"
            ? Math.max(0, state.dataFeePerChunk)
            : this.dataFeePerChunk;
        this.dataFeeChunkBytes = typeof state.dataFeeChunkBytes === "number"
            ? Math.max(1, Math.floor(state.dataFeeChunkBytes))
            : this.dataFeeChunkBytes;
        this.initialMiningReward = typeof state.initialMiningReward === "number"
            ? Math.max(0, state.initialMiningReward)
            : this.initialMiningReward;
        this.halvingInterval = typeof state.halvingInterval === "number"
            ? Math.max(1, Math.floor(state.halvingInterval))
            : this.halvingInterval;
        this.rebuildDerivedState();

        try {
            for (const transaction of pendingTransactions) {
                if (transaction.from === null) {
                    continue;
                }

                this.addTransaction(transaction);
            }
        } catch {
            this.chain = originalChain;
            this.pendingTransactions = originalPendingTransactions;
            this.difficulty = originalDifficulty;
            this.rebuildDerivedState();
            return false;
        }

        return true;
    }

    adjustDifficulty() {
        if (this.chain.length < this.adjustmentInterval) return;

        const latest = this.getLastBlock();
        const prev = this.chain[this.chain.length - this.adjustmentInterval];

        const expectedTime = this.blockTime * this.adjustmentInterval;
        const actualTime = latest.timestamp - prev.timestamp;

        if (actualTime < expectedTime / 2) {
            this.difficulty++;
        } else if (actualTime > expectedTime * 2) {
            this.difficulty--;
        }

        this.difficulty = Math.max(MIN_DIFFICULTY, this.difficulty);
    }

    getBalance(address, includePending = true) {
        const normalizedAddress = this.normalizeAddress(address);

        if (!normalizedAddress) {
            return 0;
        }

        let balance = 0;

        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (this.addressesEqual(tx.from, normalizedAddress)) balance -= tx.amount + tx.fee;
                if (this.addressesEqual(tx.to, normalizedAddress)) balance += tx.amount;
            }
        }

        if (includePending) {
            for (const tx of this.pendingTransactions) {
                if (this.addressesEqual(tx.from, normalizedAddress)) balance -= tx.amount + tx.fee;
            }
        }

        return balance;
    }

    removePendingTransactions(transactions) {
        const transactionIds = new Set(
            transactions.map(transaction => transaction.txId)
        );

        this.pendingTransactions = this.pendingTransactions.filter(
            transaction => !transactionIds.has(transaction.txId)
        );
    }

    calculateBlockHash(block) {
        return Block.calculateHashForBlock(block);
    }

    isValidBlock(block, previousBlock, expectedHeight = null) {
        if (!block || !previousBlock) {
            return false;
        }

        if (block.prevHash !== previousBlock.hash) {
            return false;
        }

        if (block.hash !== this.calculateBlockHash(block)) {
            return false;
        }

        if (
            typeof block.difficulty !== "number" ||
            block.difficulty < MIN_DIFFICULTY ||
            Math.abs(block.difficulty - previousBlock.difficulty) > 1
        ) {
            return false;
        }

        if (!Array.isArray(block.transactions)) {
            return false;
        }

        const isModernBlock =
            typeof block.version === "number" &&
            typeof block.height === "number" &&
            typeof block.merkleRoot === "string";

        if (isModernBlock) {
            if (block.version !== BLOCK_VERSION) {
                return false;
            }

            const requiredHeight = expectedHeight ?? (
                typeof previousBlock.height === "number"
                    ? previousBlock.height + 1
                    : null
            );

            if (requiredHeight !== null && block.height !== requiredHeight) {
                return false;
            }

            if (block.merkleRoot !== Block.calculateMerkleRoot(block.transactions)) {
                return false;
            }
        }

        if (block.transactions.length === 0) {
            return false;
        }

        const target = "0".repeat(block.difficulty);
        if (!block.hash.startsWith(target)) {
            return false;
        }

        const normalTransactions = block.transactions.filter(tx => tx.from !== null);
        const rewardTransactions = block.transactions.filter(tx => tx.from === null);

        if (normalTransactions.length > this.maxTransactionsPerBlock) {
            return false;
        }

        if (rewardTransactions.length !== 1) {
            return false;
        }

        const rewardTransaction = rewardTransactions[0];
        const expectedRewardAmount =
            this.getMiningRewardAtHeight(expectedHeight ?? this.chain.length) +
            this.getFeesForTransactions(normalTransactions);

        if (rewardTransaction.amount !== expectedRewardAmount) {
            return false;
        }

        for (const tx of block.transactions) {
            if (!Transaction.isValidTransaction(tx)) {
                return false;
            }

            const stateValidationError = this.validateStateTransaction(tx);
            if (stateValidationError) {
                return false;
            }
        }

        return true;
    }

    isValidChain(chain = this.chain) {
        if (!Array.isArray(chain) || chain.length === 0) {
            return false;
        }

        const localGenesis = this.createGenesisBlock();
        const legacyGenesis = this.createLegacyGenesisBlock();
        const receivedGenesis = chain[0];
        const seenTransactionIds = new Set();
        const accountNonces = new Map();

        const matchesModernGenesis =
            receivedGenesis &&
            receivedGenesis.hash === localGenesis.hash &&
            receivedGenesis.prevHash === localGenesis.prevHash &&
            receivedGenesis.timestamp === localGenesis.timestamp &&
            receivedGenesis.nonce === localGenesis.nonce &&
            receivedGenesis.difficulty === localGenesis.difficulty &&
            receivedGenesis.height === localGenesis.height &&
            receivedGenesis.version === localGenesis.version &&
            receivedGenesis.merkleRoot === localGenesis.merkleRoot;

        const matchesLegacyGenesis =
            receivedGenesis &&
            receivedGenesis.hash === legacyGenesis.hash &&
            receivedGenesis.prevHash === legacyGenesis.prevHash &&
            receivedGenesis.timestamp === legacyGenesis.timestamp &&
            receivedGenesis.nonce === legacyGenesis.nonce &&
            receivedGenesis.difficulty === legacyGenesis.difficulty;

        if (!matchesModernGenesis && !matchesLegacyGenesis) {
            return false;
        }

        for (let i = 1; i < chain.length; i++) {
            const current = chain[i];
            const prev = chain[i - 1];

            if (!this.isValidBlock(current, prev, i)) return false;

            for (const tx of current.transactions) {
                if (seenTransactionIds.has(tx.txId)) {
                    return false;
                }

                seenTransactionIds.add(tx.txId);

                if (tx.from === null) {
                    continue;
                }

                const normalizedFrom = this.normalizeAddress(tx.from);
                const expectedNonce = accountNonces.get(normalizedFrom) ?? 0;

                if (tx.nonce !== expectedNonce) {
                    return false;
                }

                accountNonces.set(normalizedFrom, expectedNonce + 1);
            }
        }

        return true;
    }

    getChainWork(chain = this.chain) {
        return chain.reduce((sum, block) => {
            return sum + Math.pow(2, block.difficulty);
        }, 0);
    }

    getBlockSummaries() {
        return this.chain.map((block, index) => ({
            height: block.height ?? index,
            hash: block.hash,
            prevHash: block.prevHash,
            timestamp: block.timestamp,
            version: block.version ?? "legacy",
            merkleRoot: block.merkleRoot ?? null,
            difficulty: block.difficulty,
            nonce: block.nonce,
            totalFees: Array.isArray(block.transactions)
                ? block.transactions.reduce((sum, transaction) => sum + transaction.fee, 0)
                : 0,
            rewardAmount: Array.isArray(block.transactions)
                ? (block.transactions.find(transaction => transaction.from === null)?.amount ?? 0)
                : 0,
            transactionCount: Array.isArray(block.transactions)
                ? block.transactions.length
                : 0
        }));
    }

    getBlockByHash(hash) {
        return this.chain.find(block => block.hash === hash) ?? null;
    }

    getStateKeyDetails(key) {
        const entry = this.getStateEntry(key);

        return {
            key,
            exists: Boolean(entry),
            value: entry ? entry.value : null,
            owner: entry?.owner ?? null,
            updatedByTxId: entry?.updatedByTxId ?? null,
            updatedAtBlockHeight: entry?.updatedAtBlockHeight ?? null,
            updatedAtTimestamp: entry?.updatedAtTimestamp ?? null,
            historyLength: this.getStateHistory(key).length
        };
    }

    buildTransactionReceipt(transaction, options = {}) {
        const {
            status = "unknown",
            block = null,
            blockHeight = null,
            transactionIndex = null
        } = options;
        const isReward = transaction.from === null;
        const currentHeight = this.chain.length - 1;
        const confirmations = blockHeight == null
            ? 0
            : Math.max(0, currentHeight - blockHeight + 1);
        const normalizedType = Transaction.inferType(
            transaction.from,
            transaction.type ?? null
        );
        const executionStatus = status === "pending"
            ? "pending"
            : (status === "confirmed" ? "applied" : "unknown");

        return {
            txId: transaction.txId,
            status,
            type: normalizedType,
            version: transaction.version ?? 1,
            from: transaction.from,
            to: transaction.to,
            amount: transaction.amount,
            fee: transaction.fee,
            nonce: transaction.nonce,
            timestamp: transaction.timestamp,
            payload: transaction.payload ?? null,
            payloadHash: Transaction.getPayloadHash(transaction.payload ?? null),
            payloadBytes: Transaction.getPayloadSize(transaction.payload ?? null),
            blockHeight,
            blockHash: block?.hash ?? null,
            transactionIndex,
            confirmations,
            includedInBlock: blockHeight != null,
            effectiveDebit: isReward ? 0 : transaction.amount + transaction.fee,
            effectiveCredit: transaction.amount,
            execution: this.getTransactionExecutionResult(transaction, {
                status: executionStatus,
                blockHeight
            })
        };
    }

    getTransactionReceipt(txId) {
        for (let blockIndex = 0; blockIndex < this.chain.length; blockIndex++) {
            const block = this.chain[blockIndex];

            for (let transactionIndex = 0; transactionIndex < block.transactions.length; transactionIndex++) {
                const transaction = block.transactions[transactionIndex];

                if (transaction.txId === txId) {
                    return this.buildTransactionReceipt(transaction, {
                        status: "confirmed",
                        block,
                        blockHeight: blockIndex,
                        transactionIndex
                    });
                }
            }
        }

        const pendingIndex = this.pendingTransactions.findIndex(
            transaction => transaction.txId === txId
        );

        if (pendingIndex !== -1) {
            return this.buildTransactionReceipt(
                this.pendingTransactions[pendingIndex],
                {
                    status: "pending",
                    transactionIndex: pendingIndex
                }
            );
        }

        return {
            txId,
            status: "not_found",
            type: null,
            from: null,
            to: null,
            amount: null,
            fee: null,
            nonce: null,
            timestamp: null,
            blockHeight: null,
            blockHash: null,
            transactionIndex: null,
            confirmations: 0,
            includedInBlock: false,
            effectiveDebit: null,
            effectiveCredit: null,
            payload: null,
            payloadHash: null,
            payloadBytes: 0,
            execution: null
        };
    }

    findTransaction(txId) {
        for (let blockIndex = 0; blockIndex < this.chain.length; blockIndex++) {
            const block = this.chain[blockIndex];

            for (let transactionIndex = 0; transactionIndex < block.transactions.length; transactionIndex++) {
                const transaction = block.transactions[transactionIndex];

                if (transaction.txId === txId) {
                    return {
                        status: "confirmed",
                        blockHeight: blockIndex,
                        blockHash: block.hash,
                        transactionIndex,
                        transaction
                    };
                }
            }
        }

        const pendingIndex = this.pendingTransactions.findIndex(
            transaction => transaction.txId === txId
        );

        if (pendingIndex !== -1) {
            return {
                status: "pending",
                blockHeight: null,
                blockHash: null,
                transactionIndex: pendingIndex,
                transaction: this.pendingTransactions[pendingIndex]
            };
        }

        return null;
    }

    getAddressActivity(address) {
        const normalizedAddress = this.normalizeAddress(address);

        if (!normalizedAddress) {
            return {
                address,
                balance: 0,
                availableBalance: 0,
                nextNonce: 0,
                confirmedTransactions: [],
                pendingTransactions: []
            };
        }

        const confirmedTransactions = [];
        const pendingTransactions = [];

        for (let blockIndex = 0; blockIndex < this.chain.length; blockIndex++) {
            const block = this.chain[blockIndex];

            for (let transactionIndex = 0; transactionIndex < block.transactions.length; transactionIndex++) {
                const transaction = block.transactions[transactionIndex];

                if (
                    this.addressesEqual(transaction.from, normalizedAddress) ||
                    this.addressesEqual(transaction.to, normalizedAddress)
                ) {
                    confirmedTransactions.push({
                        status: "confirmed",
                        blockHeight: blockIndex,
                        blockHash: block.hash,
                        transactionIndex,
                        direction: this.addressesEqual(transaction.to, normalizedAddress)
                            ? "incoming"
                            : "outgoing",
                        transaction
                    });
                }
            }
        }

        for (let transactionIndex = 0; transactionIndex < this.pendingTransactions.length; transactionIndex++) {
            const transaction = this.pendingTransactions[transactionIndex];

            if (
                this.addressesEqual(transaction.from, normalizedAddress) ||
                this.addressesEqual(transaction.to, normalizedAddress)
            ) {
                pendingTransactions.push({
                    status: "pending",
                    blockHeight: null,
                    blockHash: null,
                    transactionIndex,
                    direction: this.addressesEqual(transaction.to, normalizedAddress)
                        ? "incoming"
                        : "outgoing",
                    transaction
                });
            }
        }

        return {
            address: Transaction.toChecksumAddress(normalizedAddress),
            balance: this.getBalance(normalizedAddress, false),
            availableBalance: this.getBalance(normalizedAddress, true),
            nextNonce: this.getNextNonce(normalizedAddress),
            confirmedTransactions,
            pendingTransactions
        };
    }

    getTotalSupply() {
        let totalSupply = 0;

        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                if (transaction.from === null) {
                    totalSupply += transaction.amount;
                }
            }
        }

        return totalSupply;
    }

    getConfirmedTransactionCount() {
        return this.chain.reduce(
            (sum, block) => sum + block.transactions.filter(tx => tx.from !== null).length,
            0
        );
    }

    getTotalFeesCollected() {
        return this.chain.reduce(
            (sum, block) => sum + this.getFeesForTransactions(block.transactions.filter(tx => tx.from !== null)),
            0
        );
    }

    getStats() {
        const confirmedDataTransactionCount = this.chain.reduce(
            (sum, block) => sum + block.transactions.filter(
                transaction => transaction.from !== null && Transaction.inferType(transaction.from, transaction.type ?? null) === Transaction.TYPES.DATA
            ).length,
            0
        );

        return {
            ...this.getNetworkIdentity(),
            supportedTransactionTypes: this.getSupportedTransactionTypes(),
            supportedStateOperations: this.getSupportedStateOperations(),
            chainHeight: this.chain.length - 1,
            blockCount: this.chain.length,
            confirmedTransactionCount: this.getConfirmedTransactionCount(),
            confirmedDataTransactionCount,
            pendingTransactionCount: this.pendingTransactions.length,
            ...this.getMempoolPolicy(),
            totalSupply: this.getTotalSupply(),
            totalFeesCollected: this.getTotalFeesCollected(),
            currentMiningReward: this.getCurrentMiningReward(),
            initialMiningReward: this.initialMiningReward,
            halvingInterval: this.halvingInterval,
            difficulty: this.difficulty,
            maxTransactionsPerBlock: this.maxTransactionsPerBlock,
            chainWork: this.getChainWork(),
            pendingFees: this.getPendingFees(),
            state: this.getStateStats()
        };
    }

    addBlock(block) {
        const previousBlock = this.getLastBlock();

        if (!this.isValidBlock(block, previousBlock, this.chain.length)) {
            return false;
        }

        this.chain.push(block);
        this.rebuildDerivedState();
        this.removePendingTransactions(block.transactions);

        if (this.chain.length % this.adjustmentInterval === 0) {
            this.adjustDifficulty();
        } else {
            this.difficulty = this.getLastBlock().difficulty;
        }

        return true;
    }

    getTransactionKey(transaction) {
        return transaction.txId ?? `legacy:${transaction.from}:${transaction.to}:${transaction.amount}`;
    }

    hasTransactionInChain(transaction, chain = this.chain) {
        const targetKey = this.getTransactionKey(transaction);

        return chain.some(block =>
            Array.isArray(block.transactions) &&
            block.transactions.some(tx => this.getTransactionKey(tx) === targetKey)
        );
    }

    replaceChain(newChain) {
        const currentWork = this.getChainWork();
        const newWork = this.getChainWork(newChain);

        if (newWork <= currentWork || !this.isValidChain(newChain)) {
            return false;
        }

        const oldPendingTransactions = this.pendingTransactions.map(tx =>
            Transaction.fromData(tx)
        );

        this.chain = newChain;
        this.pendingTransactions = [];
        this.difficulty = this.getLastBlock().difficulty;
        this.rebuildDerivedState();

        if (this.chain.length % this.adjustmentInterval === 0) {
            this.adjustDifficulty();
        }

        for (const transaction of oldPendingTransactions) {
            if (transaction.from === null) {
                continue;
            }

            if (this.hasTransactionInChain(transaction, newChain)) {
                continue;
            }

            try {
                this.addTransaction(transaction);
            } catch {
                // Drop transactions that became invalid after chain replacement.
            }
        }

        return true;
    }
}

module.exports = { Block, Blockchain };
