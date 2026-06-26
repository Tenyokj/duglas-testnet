const crypto = require("crypto");
const EC = require("elliptic").ec;

const ec = new EC("secp256k1");
const KECCAK_ROUND_CONSTANTS = [
    0x0000000000000001n, 0x0000000000008082n,
    0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n,
    0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn,
    0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n,
    0x0000000080000001n, 0x8000000080008008n
];
const KECCAK_ROTATION_OFFSETS = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14]
];
const UINT64_MASK = (1n << 64n) - 1n;
const TRANSACTION_TYPES = Object.freeze({
    TRANSFER: "transfer",
    DATA: "data",
    REWARD: "reward"
});
const MAX_PAYLOAD_BYTES = 2048;

const SHA256 = message =>
    crypto.createHash("sha256").update(message).digest("hex");

function stableStringify(value) {
    if (value === null) {
        return "null";
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error("Payload contains a non-finite number");
        }

        return JSON.stringify(value);
    }

    if (typeof value === "string" || typeof value === "boolean") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(item => stableStringify(item)).join(",")}]`;
    }

    if (typeof value === "object") {
        const keys = Object.keys(value).sort();
        return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }

    throw new Error("Payload must be valid JSON data");
}

function rotateLeft64(value, shift) {
    const offset = BigInt(shift % 64);

    if (offset === 0n) {
        return value & UINT64_MASK;
    }

    return (
        ((value << offset) & UINT64_MASK) |
        (value >> (64n - offset))
    ) & UINT64_MASK;
}

function keccakF1600(state) {
    for (let round = 0; round < 24; round++) {
        const columnParity = new Array(5).fill(0n);

        for (let x = 0; x < 5; x++) {
            columnParity[x] =
                state[x] ^
                state[x + 5] ^
                state[x + 10] ^
                state[x + 15] ^
                state[x + 20];
        }

        const d = new Array(5).fill(0n);

        for (let x = 0; x < 5; x++) {
            d[x] = columnParity[(x + 4) % 5] ^ rotateLeft64(columnParity[(x + 1) % 5], 1);
        }

        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & UINT64_MASK;
            }
        }

        const b = new Array(25).fill(0n);

        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                const newX = y;
                const newY = (2 * x + 3 * y) % 5;

                b[newX + 5 * newY] = rotateLeft64(
                    state[x + 5 * y],
                    KECCAK_ROTATION_OFFSETS[x][y]
                );
            }
        }

        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                state[x + 5 * y] = (
                    b[x + 5 * y] ^
                    ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])
                ) & UINT64_MASK;
            }
        }

        state[0] = (state[0] ^ KECCAK_ROUND_CONSTANTS[round]) & UINT64_MASK;
    }
}

function keccak256(buffer) {
    const rateInBytes = 136;
    const state = new Array(25).fill(0n);
    const padded = Buffer.concat([
        Buffer.from(buffer),
        Buffer.from([0x01]),
        Buffer.alloc((rateInBytes - ((buffer.length + 1) % rateInBytes)) % rateInBytes)
    ]);

    padded[padded.length - 1] |= 0x80;

    for (let offset = 0; offset < padded.length; offset += rateInBytes) {
        const block = padded.subarray(offset, offset + rateInBytes);

        for (let laneIndex = 0; laneIndex < rateInBytes / 8; laneIndex++) {
            let lane = 0n;

            for (let byteIndex = 0; byteIndex < 8; byteIndex++) {
                lane |= BigInt(block[laneIndex * 8 + byteIndex] || 0) << (8n * BigInt(byteIndex));
            }

            state[laneIndex] = (state[laneIndex] ^ lane) & UINT64_MASK;
        }

        keccakF1600(state);
    }

    const output = Buffer.alloc(32);

    for (let laneIndex = 0; laneIndex < 4; laneIndex++) {
        const lane = state[laneIndex];

        for (let byteIndex = 0; byteIndex < 8; byteIndex++) {
            output[laneIndex * 8 + byteIndex] = Number(
                (lane >> (8n * BigInt(byteIndex))) & 0xffn
            );
        }
    }

    return output;
}

class Transaction {
    static get TYPES() {
        return TRANSACTION_TYPES;
    }

    static get MAX_PAYLOAD_BYTES() {
        return MAX_PAYLOAD_BYTES;
    }

    static isValidAddress(address) {
        if (typeof address !== "string" || address.length === 0) {
            return false;
        }

        if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
            return true;
        }

        return Transaction.isValidPublicKey(address);
    }

    static isValidPublicKey(publicKeyHex) {
        try {
            if (typeof publicKeyHex !== "string" || publicKeyHex.length === 0) {
                return false;
            }

            ec.keyFromPublic(publicKeyHex, "hex");
            return true;
        } catch {
            return false;
        }
    }

    static normalizePublicKey(publicKeyHex) {
        if (!Transaction.isValidPublicKey(publicKeyHex)) {
            throw new Error("Invalid public key");
        }

        return ec.keyFromPublic(publicKeyHex, "hex").getPublic(false, "hex");
    }

    static publicKeyToAddress(publicKeyHex) {
        const normalizedPublicKey = Transaction.normalizePublicKey(publicKeyHex);
        const publicKeyBytes = Buffer.from(normalizedPublicKey.slice(2), "hex");
        const hash = keccak256(publicKeyBytes).toString("hex");
        const lowercaseAddress = `0x${hash.slice(-40)}`;

        return Transaction.toChecksumAddress(lowercaseAddress);
    }

    static normalizeAddress(address) {
        if (typeof address !== "string" || address.length === 0) {
            return null;
        }

        if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
            return address.toLowerCase();
        }

        if (Transaction.isValidPublicKey(address)) {
            return Transaction.publicKeyToAddress(address).toLowerCase();
        }

        return null;
    }

    static toChecksumAddress(address) {
        const normalized = Transaction.normalizeAddress(address);

        if (!normalized) {
            throw new Error("Invalid address");
        }

        const addressBody = normalized.slice(2);
        const hash = keccak256(Buffer.from(addressBody, "ascii")).toString("hex");
        let checksummed = "0x";

        for (let index = 0; index < addressBody.length; index++) {
            checksummed += parseInt(hash[index], 16) >= 8
                ? addressBody[index].toUpperCase()
                : addressBody[index];
        }

        return checksummed;
    }

    static areAddressesEqual(left, right) {
        const normalizedLeft = Transaction.normalizeAddress(left);
        const normalizedRight = Transaction.normalizeAddress(right);

        return normalizedLeft !== null &&
            normalizedRight !== null &&
            normalizedLeft === normalizedRight;
    }

    static inferType(from, explicitType = null) {
        if (explicitType != null) {
            return explicitType;
        }

        return from === null
            ? TRANSACTION_TYPES.REWARD
            : TRANSACTION_TYPES.TRANSFER;
    }

    static normalizePayload(payload) {
        if (payload == null) {
            return null;
        }

        const serialized = stableStringify(payload);
        const payloadBytes = Buffer.byteLength(serialized, "utf8");

        if (payloadBytes > MAX_PAYLOAD_BYTES) {
            throw new Error(`Payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
        }

        return JSON.parse(serialized);
    }

    static getPayloadHash(payload) {
        if (payload == null) {
            return null;
        }

        return SHA256(stableStringify(payload));
    }

    static getPayloadSize(payload) {
        if (payload == null) {
            return 0;
        }

        return Buffer.byteLength(stableStringify(payload), "utf8");
    }

    static isValidType(type) {
        return Object.values(TRANSACTION_TYPES).includes(type);
    }

    constructor(from, to, amount, timestamp = Date.now(), nonce = 0, fee = 0, options = {}) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.timestamp = timestamp;
        this.nonce = nonce;
        this.fee = fee;
        this.type = Transaction.inferType(from, options.type ?? null);
        this.payload = Transaction.normalizePayload(options.payload ?? null);
        this.version = Number.isInteger(options.version) ? options.version : 1;
        this.txId = this.calculateHash();
        this.signature = null;
        this.publicKey = null;
    }

    static fromData(data) {
        const transaction = new Transaction(
            data.from,
            data.to,
            data.amount,
            data.timestamp,
            data.nonce,
            data.fee,
            {
                type: data.type ?? null,
                payload: data.payload ?? null,
                version: data.version
            }
        );
        transaction.txId = data.txId ?? transaction.calculateHash();
        transaction.signature = data.signature ?? null;
        transaction.publicKey = data.publicKey ?? null;
        return transaction;
    }

    calculateHash() {
        return Transaction.calculateHashFor(this);
    }

    static calculateHashFor(transaction) {
        const normalizedType = Transaction.inferType(
            transaction.from,
            transaction.type ?? null
        );
        const payloadHash = Transaction.getPayloadHash(transaction.payload ?? null);

        if (
            normalizedType === TRANSACTION_TYPES.TRANSFER &&
            payloadHash === null
        ) {
            return SHA256(
                transaction.from +
                transaction.to +
                transaction.amount +
                transaction.timestamp +
                transaction.nonce +
                transaction.fee
            );
        }

        if (
            normalizedType === TRANSACTION_TYPES.REWARD &&
            payloadHash === null
        ) {
            return SHA256(
                transaction.from +
                transaction.to +
                transaction.amount +
                transaction.timestamp +
                transaction.nonce +
                transaction.fee
            );
        }

        return SHA256(
            normalizedType +
            transaction.from +
            transaction.to +
            transaction.amount +
            transaction.timestamp +
            transaction.nonce +
            transaction.fee +
            (payloadHash ?? "")
        );
    }

    signTransaction(signingKey) {
        const signingPublicKey = signingKey.getPublic("hex");
        const signingAddress = Transaction.publicKeyToAddress(signingPublicKey);

        if (!Transaction.areAddressesEqual(signingAddress, this.from)) {
            throw new Error("Cannot sign other wallets' transactions");
        }

        const hash = this.calculateHash();
        const sig = signingKey.sign(hash, "base64");

        this.signature = sig.toDER("hex");
        this.publicKey = Transaction.normalizePublicKey(signingPublicKey);
    }

    isValid() {
        return Transaction.isValidTransaction(this);
    }

    static isValidTransaction(transaction) {
        if (!transaction) {
            return false;
        }

        const normalizedType = Transaction.inferType(
            transaction.from,
            transaction.type ?? null
        );

        if (!Transaction.isValidType(normalizedType)) {
            return false;
        }

        let normalizedPayload;

        try {
            normalizedPayload = Transaction.normalizePayload(transaction.payload ?? null);
        } catch {
            return false;
        }

        if (
            typeof transaction.fee !== "number" ||
            !Number.isFinite(transaction.fee) ||
            transaction.fee < 0
        ) {
            return false;
        }

        if (
            typeof transaction.timestamp !== "number" ||
            !Number.isFinite(transaction.timestamp) ||
            transaction.timestamp <= 0
        ) {
            return false;
        }

        if (
            typeof transaction.nonce !== "number" ||
            !Number.isInteger(transaction.nonce) ||
            transaction.nonce < 0
        ) {
            return false;
        }

        const expectedTxId = Transaction.calculateHashFor(transaction);

        if (transaction.txId !== expectedTxId) {
            return false;
        }

        if (normalizedType === TRANSACTION_TYPES.REWARD) {
            if (transaction.from !== null) {
                return false;
            }

            if (transaction.to == null || !Transaction.isValidAddress(transaction.to)) {
                return false;
            }

            return transaction.signature == null;
        }

        if (transaction.to == null || !Transaction.isValidAddress(transaction.to)) {
            return false;
        }

        if (normalizedType === TRANSACTION_TYPES.TRANSFER) {
            if (
                typeof transaction.amount !== "number" ||
                !Number.isFinite(transaction.amount) ||
                transaction.amount <= 0
            ) {
                return false;
            }
        } else if (normalizedType === TRANSACTION_TYPES.DATA) {
            if (
                typeof transaction.amount !== "number" ||
                !Number.isFinite(transaction.amount) ||
                transaction.amount < 0
            ) {
                return false;
            }

            if (normalizedPayload === null) {
                return false;
            }
        } else {
            return false;
        }

        if (!Transaction.isValidAddress(transaction.from)) {
            return false;
        }

        if (!transaction.signature) {
            throw new Error("No signature found");
        }

        const signingPublicKey = transaction.publicKey ?? (
            Transaction.isValidPublicKey(transaction.from)
                ? transaction.from
                : null
        );

        if (!signingPublicKey || !Transaction.isValidPublicKey(signingPublicKey)) {
            return false;
        }

        if (!Transaction.areAddressesEqual(transaction.from, signingPublicKey)) {
            return false;
        }

        const publicKey = ec.keyFromPublic(signingPublicKey, "hex");

        return publicKey.verify(
            Transaction.calculateHashFor(transaction),
            transaction.signature
        );
    }
}

module.exports = { Transaction, ec, TRANSACTION_TYPES };
