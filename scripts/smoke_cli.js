const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const HTTP_PORT = 3111;
const P2P_PORT = 6111;
const BASE_URL = `http://localhost:${HTTP_PORT}`;
const CLEANUP_PATHS = [
    path.join(PROJECT_ROOT, `state-${P2P_PORT}.json`),
    path.join(PROJECT_ROOT, `wallet-${P2P_PORT}.json`),
    path.join(PROJECT_ROOT, `wallets-${P2P_PORT}`)
];

function cleanupAuditFiles() {
    for (const targetPath of CLEANUP_PATHS) {
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
    }
}

function waitForNode(timeoutMs = 15_000) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        function poll() {
            const request = http.get(`${BASE_URL}/status`, response => {
                response.resume();
                resolve();
            });

            request.on("error", () => {
                if (Date.now() - startedAt >= timeoutMs) {
                    reject(new Error(`Timed out waiting for Duglas node on ${BASE_URL}`));
                    return;
                }

                setTimeout(poll, 250);
            });
        }

        poll();
    });
}

function runCliStep(args, label) {
    const result = spawnSync("node", [path.join("bin", "duglas.js"), ...args, BASE_URL], {
        cwd: PROJECT_ROOT,
        encoding: "utf8"
    });

    if (result.status !== 0) {
        throw new Error(
            `${label} failed\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`
        );
    }

    process.stdout.write(`PASS ${label}\n`);
    return result.stdout;
}

async function main() {
    cleanupAuditFiles();

    const nodeProcess = spawn("node", [path.join("src", "node", "index.js")], {
        cwd: PROJECT_ROOT,
        env: {
            ...process.env,
            P2P_PORT: String(P2P_PORT),
            HTTP_PORT: String(HTTP_PORT)
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    let nodeStdout = "";
    let nodeStderr = "";

    nodeProcess.stdout.on("data", chunk => {
        nodeStdout += chunk.toString();
    });

    nodeProcess.stderr.on("data", chunk => {
        nodeStderr += chunk.toString();
    });

    try {
        await waitForNode();

        runCliStep(["status"], "status");
        runCliStep(["wallet-save-name", "alice"], "wallet-save-name");
        const bobOutput = runCliStep(["wallet-seed-new", "bob"], "wallet-seed-new");
        const bobAddressMatch = bobOutput.match(/0x[a-fA-F0-9]{40}/);

        if (!bobAddressMatch) {
            throw new Error("Could not extract Bob address from wallet-seed-new output");
        }

        const bobAddress = bobAddressMatch[0];

        runCliStep(["wallet-switch", "alice"], "wallet-switch alice");
        runCliStep(["faucet"], "faucet");
        runCliStep(["send", bobAddress, "10", "1"], "send");
        runCliStep(["mempool"], "mempool");
        runCliStep(["mine"], "mine transfer");
        runCliStep(["wallet-switch", "bob"], "wallet-switch bob");
        runCliStep(["balance"], "bob balance");
        runCliStep(["send-action", bobAddress, "kv", "set", "{\"key\":\"greeting\",\"value\":\"hello\"}", "1"], "send-action");
        runCliStep(["state-pending"], "state-pending");
        runCliStep(["mine"], "mine state");
        runCliStep(["state-get", "greeting"], "state-get");
        runCliStep(["todo-create", "ship_mvp", "Ship the Duglas MVP", "1"], "todo-create");
        runCliStep(["mine"], "mine todo");
        runCliStep(["todo-list", bobAddress], "todo-list");
        runCliStep(["apps"], "apps");
        runCliStep(["action-policies"], "action-policies");

        process.stdout.write(`\nSmoke CLI audit completed successfully against ${BASE_URL}.\n`);
    } finally {
        nodeProcess.kill("SIGINT");
        await new Promise(resolve => setTimeout(resolve, 500));
        cleanupAuditFiles();

        if (nodeStderr.trim()) {
            process.stdout.write(`\nNode stderr during smoke test:\n${nodeStderr}\n`);
        }

        if (nodeProcess.exitCode !== null && nodeProcess.exitCode !== 0 && nodeProcess.exitCode !== 130) {
            process.stdout.write(`\nNode stdout before exit:\n${nodeStdout}\n`);
        }
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
