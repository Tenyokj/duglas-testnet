const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Wallet } = require("../src/core/wallet");

test("wallet can be exported and restored from a private key", () => {
    const wallet = Wallet.create();
    const restored = Wallet.fromPrivateKey(wallet.privateKey);

    assert.equal(restored.privateKey, wallet.privateKey);
    assert.equal(restored.address, wallet.address);
});

test("wallet derives an Ethereum-style address from a known private key", () => {
    const wallet = Wallet.fromPrivateKey(
        "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );

    assert.equal(wallet.address, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
});

test("wallet save and load preserve the same identity", () => {
    const filePath = path.join(__dirname, "tmp-wallet-save-load.json");
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    try {
        const wallet = Wallet.create();
        wallet.save(filePath);

        const loaded = Wallet.loadOrCreate(filePath);
        assert.equal(loaded.privateKey, wallet.privateKey);
        assert.equal(loaded.address, wallet.address);
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

test("wallet loadFromFile throws when file does not exist", () => {
    const filePath = path.join(__dirname, "tmp-wallet-missing.json");

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    assert.throws(() => Wallet.loadFromFile(filePath), /Wallet file not found/);
});

test("wallet can be saved to a new file and restored from it", () => {
    const filePath = path.join(__dirname, "tmp-wallet-manual-load.json");

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    try {
        const wallet = Wallet.create();
        wallet.save(filePath);

        const loaded = Wallet.loadFromFile(filePath);
        assert.equal(loaded.privateKey, wallet.privateKey);
        assert.equal(loaded.address, wallet.address);
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

test("wallet registry can save and list named wallets", () => {
    const directoryPath = path.join(__dirname, "tmp-wallet-registry");

    fs.rmSync(directoryPath, { recursive: true, force: true });

    try {
        const alpha = Wallet.create();
        const beta = Wallet.create();

        const alphaPath = Wallet.saveNamedWallet(directoryPath, "alpha", alpha);
        const betaPath = Wallet.saveNamedWallet(directoryPath, "beta_1", beta);
        const listed = Wallet.listNamedWallets(directoryPath);

        assert.equal(listed.length, 2);
        assert.deepEqual(
            listed.map(item => item.name),
            ["alpha", "beta_1"]
        );
        assert.equal(listed[0].filePath, alphaPath);
        assert.equal(listed[1].filePath, betaPath);
        assert.equal(listed[0].address, alpha.address);
        assert.equal(listed[1].address, beta.address);
    } finally {
        fs.rmSync(directoryPath, { recursive: true, force: true });
    }
});

test("wallet registry rejects invalid wallet names", () => {
    assert.throws(
        () => Wallet.normalizeWalletName("alpha beta"),
        /Wallet name may contain only letters, numbers, hyphens and underscores/
    );
});

test("wallet can be deterministically restored from a mnemonic", () => {
    const mnemonic = Wallet.generateMnemonic();
    const walletA = Wallet.fromMnemonic(mnemonic);
    const walletB = Wallet.fromMnemonic(mnemonic);

    assert.equal(walletA.mnemonic, walletB.mnemonic);
    assert.equal(walletA.privateKey, walletB.privateKey);
    assert.equal(walletA.address, walletB.address);
});

test("wallet save and load preserve mnemonic metadata", () => {
    const filePath = path.join(__dirname, "tmp-wallet-mnemonic.json");
    fs.rmSync(filePath, { force: true });

    try {
        const wallet = Wallet.createFromMnemonic();
        wallet.save(filePath);

        const loaded = Wallet.loadFromFile(filePath);
        assert.equal(loaded.privateKey, wallet.privateKey);
        assert.equal(loaded.address, wallet.address);
        assert.equal(loaded.mnemonic, wallet.mnemonic);
    } finally {
        fs.rmSync(filePath, { force: true });
    }
});

test("wallet rejects invalid mnemonic words", () => {
    assert.throws(
        () => Wallet.fromMnemonic("bad words only"),
        /Mnemonic phrase must contain exactly 16 words|Unknown mnemonic word/
    );
});
