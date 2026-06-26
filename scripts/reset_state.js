const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const removeWallets = process.argv.includes("--wallets");

function safeRemove(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return false;
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
}

function collectTargets() {
    const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
    const targets = [];

    for (const entry of entries) {
        const fullPath = path.join(projectRoot, entry.name);

        if (entry.isFile() && /^state-\d+\.json$/.test(entry.name)) {
            targets.push(fullPath);
            continue;
        }

        if (!removeWallets) {
            continue;
        }

        if (entry.isFile() && /^wallet-\d+\.json$/.test(entry.name)) {
            targets.push(fullPath);
            continue;
        }

        if (entry.isDirectory() && /^wallets-\d+$/.test(entry.name)) {
            targets.push(fullPath);
        }
    }

    return targets.sort();
}

const targets = collectTargets();

if (targets.length === 0) {
    console.log(removeWallets
        ? "No local state or wallet files found."
        : "No local state files found."
    );
    process.exit(0);
}

for (const target of targets) {
    safeRemove(target);
    console.log(`Removed ${path.basename(target)}`);
}

console.log(removeWallets
    ? "Local blockchain state and wallet files were reset."
    : "Local blockchain state was reset."
);
