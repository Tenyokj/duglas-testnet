const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ec, Transaction } = require("./transaction");

const MNEMONIC_PREFIXES = [
    "al", "be", "cor", "den",
    "el", "fal", "gal", "hel",
    "is", "jor", "kal", "lor",
    "mor", "nor", "or", "pra"
];
const MNEMONIC_SUFFIXES = [
    "dan", "fen", "gor", "helm",
    "ion", "jor", "kas", "lin",
    "mon", "nar", "or", "pris",
    "quil", "ron", "sor", "tor"
];
const MNEMONIC_WORD_SET = new Set(
    MNEMONIC_PREFIXES.flatMap(prefix =>
        MNEMONIC_SUFFIXES.map(suffix => `${prefix}${suffix}`)
    )
);
const MNEMONIC_WORD_COUNT = 16;
const MNEMONIC_DOMAIN = "blockchainjs-mnemonic-v1";

class Wallet {
    constructor(privateKeyHex, mnemonic = null) {
        this.keyPair = ec.keyFromPrivate(privateKeyHex, "hex");
        this.privateKey = privateKeyHex;
        this.publicKey = this.keyPair.getPublic("hex");
        this.address = Transaction.publicKeyToAddress(this.publicKey);
        this.mnemonic = mnemonic;
    }

    static create() {
        const keyPair = ec.genKeyPair();
        const privateKey = keyPair.getPrivate("hex").padStart(64, "0");
        return new Wallet(privateKey);
    }

    static createFromMnemonic() {
        return Wallet.fromMnemonic(Wallet.generateMnemonic());
    }

    static isValidPrivateKey(privateKeyHex) {
        return (
            typeof privateKeyHex === "string" &&
            /^[0-9a-fA-F]{64}$/.test(privateKeyHex)
        );
    }

    static fromPrivateKey(privateKeyHex) {
        if (typeof privateKeyHex !== "string") {
            throw new Error("Invalid private key format");
        }

        const normalizedPrivateKey = privateKeyHex.toLowerCase().padStart(64, "0");

        if (!Wallet.isValidPrivateKey(normalizedPrivateKey)) {
            throw new Error("Invalid private key format");
        }

        return new Wallet(normalizedPrivateKey);
    }

    static generateMnemonic(wordCount = MNEMONIC_WORD_COUNT) {
        const totalWords = Number(wordCount);

        if (!Number.isInteger(totalWords) || totalWords <= 0) {
            throw new Error("Mnemonic word count must be a positive integer");
        }

        const entropy = crypto.randomBytes(totalWords);
        const words = [];

        for (const byte of entropy) {
            const prefix = MNEMONIC_PREFIXES[(byte >> 4) & 0x0f];
            const suffix = MNEMONIC_SUFFIXES[byte & 0x0f];
            words.push(`${prefix}${suffix}`);
        }

        return words.join(" ");
    }

    static normalizeMnemonic(mnemonic) {
        if (typeof mnemonic !== "string") {
            throw new Error("Mnemonic phrase is required");
        }

        const normalized = mnemonic
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .join(" ");

        if (!normalized) {
            throw new Error("Mnemonic phrase is required");
        }

        const words = normalized.split(" ");

        if (words.length !== MNEMONIC_WORD_COUNT) {
            throw new Error(`Mnemonic phrase must contain exactly ${MNEMONIC_WORD_COUNT} words`);
        }

        for (const word of words) {
            if (!MNEMONIC_WORD_SET.has(word)) {
                throw new Error(`Unknown mnemonic word: ${word}`);
            }
        }

        return normalized;
    }

    static fromMnemonic(mnemonic) {
        const normalizedMnemonic = Wallet.normalizeMnemonic(mnemonic);
        const privateKey = crypto
            .createHash("sha256")
            .update(`${MNEMONIC_DOMAIN}:${normalizedMnemonic}`)
            .digest("hex");

        return new Wallet(privateKey, normalizedMnemonic);
    }

    static loadOrCreate(filePath) {
        const resolvedPath = path.resolve(filePath);

        if (fs.existsSync(resolvedPath)) {
            return Wallet.loadFromFile(resolvedPath);
        }

        const wallet = Wallet.create();
        wallet.save(resolvedPath);

        return wallet;
    }

    static loadFromFile(filePath) {
        const resolvedPath = path.resolve(filePath);

        if (!fs.existsSync(resolvedPath)) {
            throw new Error("Wallet file not found");
        }

        const data = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
        const wallet = Wallet.fromPrivateKey(data.privateKey);

        if (typeof data.mnemonic === "string" && data.mnemonic.trim()) {
            wallet.mnemonic = Wallet.normalizeMnemonic(data.mnemonic);
        }

        return wallet;
    }

    static ensureDirectory(directoryPath) {
        const resolvedPath = path.resolve(directoryPath);
        fs.mkdirSync(resolvedPath, { recursive: true });
        return resolvedPath;
    }

    static normalizeWalletName(walletName) {
        if (typeof walletName !== "string" || walletName.trim().length === 0) {
            throw new Error("Wallet name is required");
        }

        const normalized = walletName.trim().toLowerCase();

        if (!/^[a-z0-9_-]+$/.test(normalized)) {
            throw new Error("Wallet name may contain only letters, numbers, hyphens and underscores");
        }

        return normalized;
    }

    static getNamedWalletPath(directoryPath, walletName) {
        const directory = Wallet.ensureDirectory(directoryPath);
        const normalizedName = Wallet.normalizeWalletName(walletName);
        return path.join(directory, `${normalizedName}.json`);
    }

    static saveNamedWallet(directoryPath, walletName, wallet) {
        const filePath = Wallet.getNamedWalletPath(directoryPath, walletName);
        wallet.save(filePath);
        return filePath;
    }

    static loadNamedWallet(directoryPath, walletName) {
        const filePath = Wallet.getNamedWalletPath(directoryPath, walletName);
        return {
            wallet: Wallet.loadFromFile(filePath),
            filePath
        };
    }

    static listNamedWallets(directoryPath) {
        const directory = Wallet.ensureDirectory(directoryPath);

        return fs.readdirSync(directory)
            .filter(fileName => fileName.endsWith(".json"))
            .sort((left, right) => left.localeCompare(right))
            .map(fileName => {
                const filePath = path.join(directory, fileName);
                const wallet = Wallet.loadFromFile(filePath);

                return {
                    name: path.basename(fileName, ".json"),
                    filePath,
                    address: wallet.address
                };
            });
    }

    save(filePath) {
        const resolvedPath = path.resolve(filePath);

        fs.writeFileSync(
            resolvedPath,
            JSON.stringify({
                privateKey: this.privateKey,
                mnemonic: this.mnemonic
            }, null, 2)
        );
    }

    exportData() {
        return {
            privateKey: this.privateKey,
            publicKey: this.publicKey,
            address: this.address,
            mnemonic: this.mnemonic,
            mnemonicWordCount: this.mnemonic ? this.mnemonic.split(" ").length : 0,
            mnemonicType: this.mnemonic ? "custom-v1" : null
        };
    }

    createTransaction(to, amount, blockchain, fee = 0, options = {}) {
        const nonce = blockchain.getNextNonce(this.address);
        const transaction = new Transaction(
            this.address,
            to,
            amount,
            Date.now(),
            nonce,
            fee,
            options
        );

        transaction.signTransaction(this.keyPair);
        return transaction;
    }
}

module.exports = { Wallet };
