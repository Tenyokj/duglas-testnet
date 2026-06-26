#!/usr/bin/env node
const { spawnSync } = require("child_process");
const http = require("http");
const path = require("path");

const DEFAULT_BASE_URL = process.env.NODE_API_URL || "http://localhost:3001";
const DEFAULT_WATCH_INTERVAL_MS = 3000;

const COLORS = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    red: "\x1b[31m"
};

const COMMAND_GROUPS = [
    {
        title: "Overview",
        commands: [
            ["help [command]", "Show general help or detailed help for one command"],
            ["overview [baseUrl]", "Open the main terminal explorer overview"],
            ["watch [baseUrl] [intervalMs]", "Continuously refresh the overview"]
        ]
    },
    {
        title: "Wallet",
        commands: [
            ["wallet [baseUrl]", "Show the active wallet"],
            ["wallet-list [baseUrl]", "List saved wallets"],
            ["wallet-new [name] [baseUrl]", "Create a new private-key wallet"],
            ["wallet-seed-new [name] [baseUrl]", "Create a new mnemonic wallet"],
            ["wallet-save <filePath> [baseUrl]", "Save the active wallet to a file"],
            ["wallet-save-name <name> [baseUrl]", "Save the active wallet in the wallet registry"],
            ["wallet-load <filePath> [baseUrl]", "Load a wallet from a file"],
            ["wallet-switch <name> [baseUrl]", "Switch to a named wallet"],
            ["wallet-export [baseUrl]", "Export active wallet keys and mnemonic"],
            ["wallet-import <privateKey> [name] [baseUrl]", "Import a wallet from a private key"],
            ["wallet-seed-import \"phrase\" [name] [baseUrl]", "Import a wallet from a recovery phrase"]
        ]
    },
    {
        title: "Network",
        commands: [
            ["address [baseUrl]", "Show the active wallet address"],
            ["network [baseUrl]", "Show network identity metadata"],
            ["action-policies [baseUrl]", "Show supported formal app/action payload policies"],
            ["node-info [baseUrl]", "Show node files, mempool policy and API limits"],
            ["status [baseUrl]", "Show node, wallet and mining status"],
            ["stats [baseUrl]", "Show chain, economics and limits stats"],
            ["sync-status [baseUrl]", "Show sync connectivity status"],
            ["peers [baseUrl]", "Show connected peer count"],
            ["peers-full [baseUrl]", "Show detailed peer and reconnect info"],
            ["faucet-status [baseUrl]", "Show faucet cooldown and reward status"]
        ]
    },
    {
        title: "Transactions",
        commands: [
            ["balance [address] [baseUrl]", "Show balance and next nonce"],
            ["send <to> <amount> [fee] [baseUrl]", "Create a transaction"],
            ["send-data <to> <jsonPayload> [fee] [baseUrl]", "Create a payload transaction"],
            ["send-action <to> <app> <action> <jsonParams> [fee] [baseUrl]", "Create a formal app/action payload transaction"],
            ["mine [baseUrl]", "Mine a new block"],
            ["faucet [address] [baseUrl]", "Request testnet coins"],
            ["mempool [baseUrl]", "Show compact mempool view"],
            ["mempool-full [baseUrl]", "Show full mempool values"],
            ["tx <txId> [baseUrl]", "Lookup a transaction"],
            ["receipt <txId> [baseUrl]", "Show transaction receipt"],
            ["activity <address> [baseUrl]", "Show address history"]
        ]
    },
    {
        title: "State",
        commands: [
            ["state [baseUrl]", "Show the current confirmed key-value state"],
            ["state-pending [baseUrl]", "Show the predicted state after pending transactions"],
            ["state-get <key> [baseUrl]", "Show one confirmed state key"],
            ["state-get-pending <key> [baseUrl]", "Show one predicted state key"],
            ["state-history <key> [baseUrl]", "Show the history of one state key"]
        ]
    },
    {
        title: "Apps",
        commands: [
            ["apps [baseUrl]", "Show registered app-layer modules"],
            ["counter-list <owner> [baseUrl]", "Show confirmed counters for one owner"],
            ["counter-list-pending <owner> [baseUrl]", "Show predicted counters for one owner"],
            ["counter-get <owner> <id> [baseUrl]", "Show one confirmed counter"],
            ["counter-get-pending <owner> <id> [baseUrl]", "Show one predicted counter"],
            ["counter-create <id> <initialValue> [fee] [baseUrl]", "Create a numeric counter"],
            ["counter-add <id> <delta> [fee] [baseUrl]", "Increase a counter"],
            ["counter-sub <id> <delta> [fee] [baseUrl]", "Decrease a counter"],
            ["counter-delete <id> [fee] [baseUrl]", "Delete a counter"],
            ["registry-list [baseUrl]", "Show confirmed global registry entries"],
            ["registry-list-pending [baseUrl]", "Show predicted global registry entries"],
            ["registry-get <name> [baseUrl]", "Show one confirmed registry entry"],
            ["registry-get-pending <name> [baseUrl]", "Show one predicted registry entry"],
            ["registry-set <name> <record> [fee] [baseUrl]", "Create or update a global registry entry"],
            ["registry-delete <name> [fee] [baseUrl]", "Delete a global registry entry"],
            ["profile-get <owner> [baseUrl]", "Show one confirmed account profile"],
            ["profile-get-pending <owner> [baseUrl]", "Show one predicted account profile"],
            ["profile-set <displayName> [bio] [fee] [baseUrl]", "Create or update the active account profile"],
            ["profile-delete [fee] [baseUrl]", "Delete the active account profile"],
            ["todo-list <owner> [baseUrl]", "Show confirmed todo items for one owner"],
            ["todo-list-pending <owner> [baseUrl]", "Show predicted todo items for one owner"],
            ["todo-create <id> <text> [fee] [baseUrl]", "Create a todo via app-layer API"],
            ["todo-toggle <id> [done|undone] [fee] [baseUrl]", "Toggle or set todo completion"],
            ["todo-delete <id> [fee] [baseUrl]", "Delete a todo via app-layer API"],
            ["note-list <owner> [baseUrl]", "Show confirmed notes for one owner"],
            ["note-list-pending <owner> [baseUrl]", "Show predicted notes for one owner"],
            ["note-get <owner> <id> [baseUrl]", "Show one confirmed note"],
            ["note-get-pending <owner> <id> [baseUrl]", "Show one predicted note"],
            ["note-set <id> <content> [fee] [baseUrl]", "Create or update a note via app-layer API"],
            ["note-delete <id> [fee] [baseUrl]", "Delete a note via app-layer API"]
        ]
    },
    {
        title: "Blocks",
        commands: [
            ["blocks [baseUrl]", "Show compact block list"],
            ["blocks-full [baseUrl]", "Show full block hashes"],
            ["block <hash> [baseUrl]", "Show full block JSON"]
        ]
    },
    {
        title: "Local Utilities",
        commands: [
            ["reset:state", "Remove local non-Docker chain state files"],
            ["reset:local", "Remove local chain state and local wallet files"],
            ["testnet:up", "Start the Docker-based 3-node local testnet"],
            ["testnet:down", "Stop the Docker-based local testnet"],
            ["testnet:reset", "Stop the Docker testnet and delete Docker volumes"]
        ]
    }
];

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function colorize(text, color) {
    return `${color}${text}${COLORS.reset}`;
}

function bold(text) {
    return colorize(text, COLORS.bold);
}

function dim(text) {
    return colorize(text, COLORS.dim);
}

function cyan(text) {
    return colorize(text, COLORS.cyan);
}

function green(text) {
    return colorize(text, COLORS.green);
}

function yellow(text) {
    return colorize(text, COLORS.yellow);
}

function magenta(text) {
    return colorize(text, COLORS.magenta);
}

function red(text) {
    return colorize(text, COLORS.red);
}

function stripAnsi(value) {
    return String(value).replace(ANSI_PATTERN, "");
}

function visibleLength(value) {
    return stripAnsi(value).length;
}

function printBanner() {
    console.log(magenta("██████╗ ██╗   ██╗ ██████╗ ██╗      █████╗ ███████╗"));
    console.log(magenta("██╔══██╗██║   ██║██╔════╝ ██║     ██╔══██╗██╔════╝"));
    console.log(magenta("██║  ██║██║   ██║██║  ███╗██║     ███████║███████╗"));
    console.log(magenta("██║  ██║██║   ██║██║   ██║██║     ██╔══██║╚════██║"));
    console.log(magenta("██████╔╝╚██████╔╝╚██████╔╝███████╗██║  ██║███████║"));
    console.log(magenta("╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝"));
}

function findCommandHelp(commandName) {
    for (const group of COMMAND_GROUPS) {
        for (const [usage, description] of group.commands) {
            const primary = usage.split(" ")[0];
            if (primary === commandName) {
                return { group: group.title, usage, description };
            }
        }
    }

    return null;
}

function printUsage(commandName = null) {
    printBanner();
    console.log("");
    console.log(bold("Duglas Testnet CLI"));
    console.log(dim("Recommended: use `duglas <command>` after `npm link` or a global install."));
    console.log(dim("Repository mode also works: `npm run cli -- <command>`."));

    if (commandName) {
        const entry = findCommandHelp(commandName);

        if (!entry) {
            console.log("");
            console.log(red(`Unknown command: ${commandName}`));
            console.log(dim("Run `duglas help` to see all commands."));
            return;
        }

        printKeyValueBlock("Command Help", [
            ["Command", entry.usage],
            ["Group", entry.group],
            ["Description", entry.description],
            ["Example", `duglas ${entry.usage}`]
        ]);
        return;
    }

    for (const group of COMMAND_GROUPS) {
        printSection(group.title);
        const width = Math.max(...group.commands.map(([usage]) => usage.length), 0);

        for (const [usage, description] of group.commands) {
            console.log(`${cyan(usage.padEnd(width, " "))}  ${description}`);
        }
    }

    printSection("Examples");
    console.log(green("duglas overview"));
    console.log(green("duglas help send"));
    console.log(green("duglas wallet-seed-new alice"));
    console.log(green("duglas node-info"));
    console.log(green("duglas receipt TX_ID"));
    console.log(green("duglas reset:state"));
    console.log(green("duglas testnet:up"));
}

function resolveBaseUrl(args, index) {
    return args[index] || DEFAULT_BASE_URL;
}

function runLocalCommand(title, command, args) {
    printBanner();
    printSection(title);
    console.log(dim(`Working directory: ${PROJECT_ROOT}`));
    console.log(dim(`Running: ${command} ${args.join(" ")}`));

    const result = spawnSync(command, args, {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        shell: false
    });

    if (result.error) {
        throw new Error(result.error.message);
    }

    if (typeof result.status === "number" && result.status !== 0) {
        throw new Error(`${command} exited with code ${result.status}`);
    }
}

function requestJson(method, baseUrl, pathname, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(pathname, baseUrl);
        const payload = body ? JSON.stringify(body) : null;

        const request = http.request(
            url,
            {
                method,
                headers: payload
                    ? {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(payload)
                    }
                    : {}
            },
            response => {
                let data = "";

                response.on("data", chunk => {
                    data += chunk;
                });

                response.on("end", () => {
                    let parsed = null;

                    if (data) {
                        try {
                            parsed = JSON.parse(data);
                        } catch {
                            if (response.statusCode === 426 && data.includes("Upgrade Required")) {
                                reject(new Error(
                                    "This looks like a P2P WebSocket port, not the HTTP API port. Try http://localhost:3001, http://localhost:3002, etc."
                                ));
                                return;
                            }

                            reject(new Error(
                                `Expected JSON from ${url.origin}, but received: ${data.slice(0, 120)}`
                            ));
                            return;
                        }
                    }

                    if (response.statusCode >= 400) {
                        reject(new Error(parsed?.error || `HTTP ${response.statusCode}`));
                        return;
                    }

                    resolve(parsed);
                });
            }
        );

        request.on("error", error => {
            reject(new Error(error.message || "Network request failed"));
        });

        if (payload) {
            request.write(payload);
        }

        request.end();
    });
}

function formatNumber(value) {
    if (typeof value !== "number") {
        return String(value);
    }

    return Number.isInteger(value)
        ? value.toLocaleString()
        : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatPlainNumber(value) {
    if (typeof value !== "number") {
        return String(value);
    }

    return Number.isInteger(value)
        ? String(value)
        : value.toLocaleString(undefined, { maximumFractionDigits: 4, useGrouping: false });
}

function formatTimestamp(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return dim("n/a");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return formatNumber(value);
    }

    return `${date.toLocaleString()} (${formatNumber(value)})`;
}

function formatValue(value) {
    if (value == null) {
        return dim("n/a");
    }

    if (typeof value === "number") {
        return formatNumber(value);
    }

    if (typeof value === "boolean") {
        return value ? green("true") : red("false");
    }

    return String(value);
}

function shorten(value, left = 12, right = 8) {
    if (typeof value !== "string" || value.length <= left + right + 3) {
        return value;
    }

    return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function printSection(title) {
    console.log("");
    console.log(bold(magenta(title)));
    console.log(dim("─".repeat(Math.max(visibleLength(title), 12))));
}

function printHint(message) {
    console.log(dim(message));
}

function padDisplay(value, width) {
    const stringValue = String(value);
    return stringValue + " ".repeat(Math.max(0, width - visibleLength(stringValue)));
}

function getBoxLineWidth(title, innerWidth) {
    const cleanTitle = ` ${title} `;
    return Math.max(innerWidth + 2, visibleLength(cleanTitle));
}

function createBoxTop(title, innerWidth) {
    const cleanTitle = ` ${title} `;
    const lineWidth = getBoxLineWidth(title, innerWidth);
    const titleWidth = visibleLength(cleanTitle);
    const rightWidth = Math.max(0, lineWidth - titleWidth);
    return `┌${dim("─")}${bold(cleanTitle)}${dim("─".repeat(rightWidth))}┐`;
}

function createBoxBottom(title, innerWidth) {
    return `└${dim("─".repeat(getBoxLineWidth(title, innerWidth)))}┘`;
}

function printKeyValueBlock(title, entries) {
    const width = Math.max(...entries.map(([key]) => key.length), 0);
    const lines = entries.map(([key, value]) => {
        const paddedKey = cyan(key.padEnd(width, " "));
        return `${paddedKey}  ${formatValue(value)}`;
    });
    const innerWidth = Math.max(...lines.map(line => visibleLength(line)), 0);

    console.log("");
    console.log(createBoxTop(title, innerWidth));

    for (const line of lines) {
        console.log(`│ ${padDisplay(line, innerWidth)} │`);
    }

    console.log(createBoxBottom(title, innerWidth));
}

function padCell(value, width) {
    return padDisplay(value, width);
}

function printTable(title, columns, rows, options = {}) {
    const emptyMessage = options.emptyMessage ?? "No rows.";

    const widths = columns.map(column => {
        const cellLengths = rows.map(row => visibleLength(row[column.key] ?? ""));
        return Math.max(column.label.length, ...cellLengths);
    });

    const header = columns
        .map((column, index) => padCell(column.label, widths[index]))
        .join("  ");
    const divider = columns
        .map((_, index) => dim("─".repeat(widths[index])))
        .join(dim("  "));
    const contentRows = rows.length
        ? rows.map(row => columns
            .map((column, index) => padCell(row[column.key] ?? "", widths[index]))
            .join("  "))
        : [dim(emptyMessage)];
    const innerWidth = Math.max(
        visibleLength(header),
        visibleLength(divider),
        ...contentRows.map(line => visibleLength(line))
    );

    console.log("");
    console.log(createBoxTop(title, innerWidth));
    console.log(`│ ${padDisplay(bold(header), innerWidth)} │`);
    console.log(`│ ${padDisplay(divider, innerWidth)} │`);

    for (const line of contentRows) {
        console.log(`│ ${padDisplay(line, innerWidth)} │`);
    }

    console.log(createBoxBottom(title, innerWidth));
}

function printJsonBlock(title, value) {
    printSection(title);
    console.log(JSON.stringify(value, null, 2));
}

function blockSummaryRow(block) {
    return {
        height: block.height,
        txs: block.transactionCount,
        fees: formatNumber(block.totalFees),
        reward: formatNumber(block.rewardAmount),
        difficulty: formatNumber(block.difficulty),
        hash: shorten(block.hash, 14, 10)
    };
}

function blockFullRow(block) {
    return {
        height: block.height,
        txs: block.transactionCount,
        fees: formatNumber(block.totalFees),
        reward: formatNumber(block.rewardAmount),
        difficulty: formatNumber(block.difficulty),
        hash: block.hash
    };
}

function transactionRow(transaction, status = "pending") {
    return {
        status,
        type: transaction.type ?? (transaction.from === null ? "reward" : "transfer"),
        amount: formatNumber(transaction.amount),
        fee: formatNumber(transaction.fee),
        nonce: transaction.nonce,
        from: shorten(transaction.from, 12, 8),
        to: shorten(transaction.to, 12, 8),
        txId: shorten(transaction.txId, 14, 10)
    };
}

function transactionFullRow(transaction, status = "pending") {
    return {
        status,
        type: transaction.type ?? (transaction.from === null ? "reward" : "transfer"),
        amount: formatNumber(transaction.amount),
        fee: formatNumber(transaction.fee),
        nonce: transaction.nonce,
        from: transaction.from,
        to: transaction.to,
        txId: transaction.txId
    };
}

async function loadOverview(baseUrl) {
    const [status, stats, blocks, mempool] = await Promise.all([
        requestJson("GET", baseUrl, "/status"),
        requestJson("GET", baseUrl, "/stats"),
        requestJson("GET", baseUrl, "/blocks"),
        requestJson("GET", baseUrl, "/mempool")
    ]);

    return { status, stats, blocks, mempool };
}

function renderOverview(baseUrl, data) {
    process.stdout.write("\x1Bc");
    printBanner();
    console.log(bold("Duglas Testnet Terminal Explorer"));
    console.log(dim(`Connected to ${baseUrl}`));
    console.log(dim(`Updated ${new Date().toLocaleTimeString()}`));

    printKeyValueBlock("Network Identity", [
        ["Name", data.status.network.networkName],
        ["Symbol", data.status.network.symbol],
        ["Decimals", formatPlainNumber(data.status.network.decimals)],
        ["Chain ID", formatPlainNumber(data.status.network.chainId)],
        ["Genesis ID", shorten(data.status.network.genesisId, 18, 12)]
    ]);

    printKeyValueBlock("Node", [
        ["HTTP Port", formatPlainNumber(data.status.httpPort)],
        ["P2P Port", formatPlainNumber(data.status.p2pPort)],
        ["Wallet", shorten(data.status.wallet.address, 18, 12)],
        ["Peers", data.status.peers]
    ]);

    printKeyValueBlock("Network", [
        ["Height", data.stats.chainHeight],
        ["Blocks", data.stats.blockCount],
        ["Supply", data.stats.totalSupply],
        ["Difficulty", data.stats.difficulty],
        ["Reward", data.stats.currentMiningReward],
        ["Pending Fees", data.stats.pendingFees],
        ["Chain Work", data.stats.chainWork]
    ]);

    printKeyValueBlock("Wallet", [
        ["Confirmed", data.status.wallet.confirmedBalance],
        ["Available", data.status.wallet.availableBalance],
        ["Next Nonce", data.status.wallet.nextNonce]
    ]);

    printTable(
        "Latest Blocks",
        [
            { key: "height", label: "Height" },
            { key: "txs", label: "Txs" },
            { key: "fees", label: "Fees" },
            { key: "reward", label: "Reward" },
            { key: "difficulty", label: "Diff" },
            { key: "hash", label: "Hash" }
        ],
        data.blocks.slice(-6).reverse().map(blockSummaryRow)
    );

    printTable(
        "Mempool",
        [
            { key: "status", label: "Status" },
            { key: "type", label: "Type" },
            { key: "amount", label: "Amount" },
            { key: "fee", label: "Fee" },
            { key: "nonce", label: "Nonce" },
            { key: "from", label: "From" },
            { key: "to", label: "To" },
            { key: "txId", label: "TxId" }
        ],
        data.mempool.slice(0, 8).map(transaction => transactionRow(transaction)),
        {
            emptyMessage: "No pending transactions. Send one or use `duglas faucet` / `duglas send`."
        }
    );
}

function renderAddress(addressActivity) {
    printKeyValueBlock("Address", [
        ["Address", addressActivity.address],
        ["Confirmed Balance", addressActivity.balance],
        ["Available Balance", addressActivity.availableBalance],
        ["Next Nonce", addressActivity.nextNonce]
    ]);

    printTable(
        "Confirmed Transactions",
        [
            { key: "direction", label: "Direction" },
            { key: "type", label: "Type" },
            { key: "amount", label: "Amount" },
            { key: "fee", label: "Fee" },
            { key: "block", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        addressActivity.confirmedTransactions.map(item => ({
            direction: item.direction,
            type: item.transaction.type ?? (item.transaction.from === null ? "reward" : "transfer"),
            amount: formatNumber(item.transaction.amount),
            fee: formatNumber(item.transaction.fee),
            block: item.blockHeight,
            txId: shorten(item.transaction.txId, 14, 10)
        }))
    );

    printTable(
        "Pending Transactions",
        [
            { key: "direction", label: "Direction" },
            { key: "type", label: "Type" },
            { key: "amount", label: "Amount" },
            { key: "fee", label: "Fee" },
            { key: "nonce", label: "Nonce" },
            { key: "txId", label: "TxId" }
        ],
        addressActivity.pendingTransactions.map(item => ({
            direction: item.direction,
            type: item.transaction.type ?? (item.transaction.from === null ? "reward" : "transfer"),
            amount: formatNumber(item.transaction.amount),
            fee: formatNumber(item.transaction.fee),
            nonce: item.transaction.nonce,
            txId: shorten(item.transaction.txId, 14, 10)
        }))
    );
}

function renderTransactionLookup(result) {
    printKeyValueBlock("Transaction", [
        ["Status", result.status],
        ["Block Height", result.blockHeight],
        ["Block Hash", result.blockHash ? shorten(result.blockHash, 18, 12) : dim("pending")],
        ["Index", result.transactionIndex],
        ["TxId", result.transaction.txId]
    ]);

    printKeyValueBlock("Payload", [
        ["Type", result.transaction.type ?? (result.transaction.from === null ? "reward" : "transfer")],
        ["From", result.transaction.from],
        ["To", result.transaction.to],
        ["Amount", result.transaction.amount],
        ["Fee", result.transaction.fee],
        ["Nonce", result.transaction.nonce],
        ["Timestamp", formatTimestamp(result.transaction.timestamp)],
        ["Payload Present", result.transaction.payload ? green("yes") : dim("no")]
    ]);

    if (result.transaction.payload) {
        printJsonBlock("Transaction Payload", result.transaction.payload);
    }
}

function renderTransactionReceipt(receipt) {
    printKeyValueBlock("Receipt", [
        ["Status", receipt.status],
        ["Type", receipt.type],
        ["Version", receipt.version ?? dim("n/a")],
        ["Confirmations", receipt.confirmations],
        ["Included In Block", receipt.includedInBlock],
        ["Block Height", receipt.blockHeight],
        ["Block Hash", receipt.blockHash ? shorten(receipt.blockHash, 18, 12) : dim("pending")],
        ["Index", receipt.transactionIndex],
        ["TxId", receipt.txId]
    ]);

    printKeyValueBlock("Settlement", [
        ["From", receipt.from ?? dim("system")],
        ["To", receipt.to],
        ["Amount", receipt.amount],
        ["Fee", receipt.fee],
        ["Nonce", receipt.nonce],
        ["Effective Debit", receipt.effectiveDebit],
        ["Effective Credit", receipt.effectiveCredit],
        ["Timestamp", formatTimestamp(receipt.timestamp)]
    ]);

    printKeyValueBlock("Execution", [
        ["Execution Status", receipt.execution?.status ?? dim("n/a")],
        ["Payload Hash", receipt.payloadHash ?? dim("none")],
        ["Payload Bytes", receipt.payloadBytes ?? 0],
        ["State Changes", receipt.execution?.stateChanges?.length ?? 0],
        ["Logs", receipt.execution?.logs?.length ?? 0]
    ]);

    if (receipt.payload) {
        printJsonBlock("Transaction Payload", receipt.payload);
    }
}

function renderWalletList(result) {
    printKeyValueBlock("Active Wallet", [
        ["Address", result.activeWallet.address],
        ["Wallet File", result.activeWallet.walletFile],
        ["Wallet Directory", result.activeWallet.walletDirectory]
    ]);

    printTable(
        "Saved Wallets",
        [
            { key: "active", label: "Active" },
            { key: "name", label: "Name" },
            { key: "address", label: "Address" },
            { key: "filePath", label: "File" }
        ],
        result.wallets.map(item => ({
            active: item.active ? green("yes") : dim("no"),
            name: item.name,
            address: shorten(item.address, 16, 10),
            filePath: item.filePath
        }))
    );
}

function renderStatus(result) {
    printKeyValueBlock("Network", [
        ["Name", result.network.networkName],
        ["Symbol", result.network.symbol],
        ["Chain ID", formatPlainNumber(result.network.chainId)],
        ["Protocol Version", formatPlainNumber(result.network.protocolVersion)],
        ["Consensus", result.network.consensus],
        ["Genesis ID", result.network.genesisId]
    ]);

    printKeyValueBlock("Node", [
        ["Runtime", result.runtime ?? dim("unknown")],
        ["HTTP Port", formatPlainNumber(result.httpPort)],
        ["P2P Port", formatPlainNumber(result.p2pPort)],
        ["Connected Peers", result.peers],
        ["Chain Height", result.chainHeight],
        ["Pending Transactions", result.pendingTransactions]
    ]);

    printKeyValueBlock("Wallet", [
        ["Address", result.wallet.address],
        ["Confirmed", result.wallet.confirmedBalance],
        ["Available", result.wallet.availableBalance],
        ["Next Nonce", result.wallet.nextNonce]
    ]);

    printKeyValueBlock("Mining", [
        ["Difficulty", result.difficulty],
        ["Current Reward", result.currentMiningReward],
        ["Initial Reward", result.initialMiningReward],
        ["Halving Interval", result.halvingInterval],
        ["Pending Fees", result.pendingFees]
    ]);

    printKeyValueBlock("Policy", [
        ["Max Transactions Per Block", result.maxTransactionsPerBlock],
        ["Max Pending Transactions", result.maxPendingTransactions],
        ["Max Pending Per Sender", result.maxPendingTransactionsPerSender],
        ["Max Pending Data Per Sender", result.maxPendingDataTransactionsPerSender ?? dim("n/a")],
        ["Replacement Fee Bump", result.minReplacementFeeBump],
        ["Min Data Fee", result.minDataTransactionFee ?? dim("n/a")],
        ["Data Fee Chunk Bytes", result.dataFeeChunkBytes ?? dim("n/a")],
        ["Data Fee Per Chunk", result.dataFeePerChunk ?? dim("n/a")],
        ["Bootstrap Peers", result.bootstrapPeers?.length ? result.bootstrapPeers.join(", ") : "none"],
        ["State Storage", result.stateStorageKind ?? dim("unknown")],
        ["Wallet Storage", result.walletStorageKind ?? dim("unknown")]
    ]);
}

function renderStats(result) {
    printKeyValueBlock("Network", [
        ["Name", result.networkName],
        ["Symbol", result.symbol],
        ["Chain ID", formatPlainNumber(result.chainId)],
        ["Protocol Version", formatPlainNumber(result.protocolVersion)],
        ["Block Version", formatPlainNumber(result.blockVersion)],
        ["Consensus", result.consensus],
        ["Genesis ID", result.genesisId]
    ]);

    printKeyValueBlock("Chain Stats", [
        ["Chain Height", result.chainHeight],
        ["Block Count", result.blockCount],
        ["Confirmed Transactions", result.confirmedTransactionCount],
        ["Confirmed Data Transactions", result.confirmedDataTransactionCount],
        ["Pending Transactions", result.pendingTransactionCount],
        ["Chain Work", result.chainWork],
        ["Difficulty", result.difficulty]
    ]);

    printKeyValueBlock("Economics", [
        ["Total Supply", result.totalSupply],
        ["Total Fees Collected", result.totalFeesCollected],
        ["Current Reward", result.currentMiningReward],
        ["Initial Reward", result.initialMiningReward],
        ["Halving Interval", result.halvingInterval],
        ["Pending Fees", result.pendingFees]
    ]);

    printKeyValueBlock("Limits", [
        ["Max Transactions Per Block", result.maxTransactionsPerBlock],
        ["Max Pending Transactions", result.maxPendingTransactions],
        ["Max Pending Per Sender", result.maxPendingTransactionsPerSender],
        ["Max Pending Data Per Sender", result.maxPendingDataTransactionsPerSender ?? dim("n/a")],
        ["Replacement Fee Bump", result.minReplacementFeeBump],
        ["Min Data Fee", result.minDataTransactionFee ?? dim("n/a")],
        ["Data Fee Chunk Bytes", result.dataFeeChunkBytes ?? dim("n/a")],
        ["Data Fee Per Chunk", result.dataFeePerChunk ?? dim("n/a")],
        ["Decimals", formatPlainNumber(result.decimals)],
        ["Supported Tx Types", Array.isArray(result.supportedTransactionTypes) ? result.supportedTransactionTypes.join(", ") : dim("n/a")]
    ]);
}

function renderNodeInfo(result) {
    printKeyValueBlock("Node", [
        ["Network", result.network.networkName],
        ["Runtime", result.node.runtime ?? dim("unknown")],
        ["HTTP Port", formatPlainNumber(result.node.httpPort)],
        ["P2P Port", formatPlainNumber(result.node.p2pPort)],
        ["Bootstrap Peers", result.node.bootstrapPeers?.length ? result.node.bootstrapPeers.join(", ") : "none"],
        ["State Storage", result.node.stateStorageKind ?? dim("unknown")],
        ["Wallet Storage", result.node.walletStorageKind ?? dim("unknown")],
        ["State File", result.node.stateFile],
        ["Wallet File", result.node.walletFile],
        ["Wallet Directory", result.node.walletDirectory]
    ]);

    printKeyValueBlock("Chain", [
        ["Height", result.chain.height],
        ["Blocks", result.chain.blockCount],
        ["Difficulty", result.chain.difficulty],
        ["Chain Work", result.chain.chainWork],
        ["Last Block Hash", result.chain.lastBlockHash],
        ["Active State Keys", result.chain.state?.activeKeys ?? 0],
        ["State Changes", result.chain.state?.totalChanges ?? 0]
    ]);

    printKeyValueBlock("Mempool", [
        ["Pending", result.mempool.pendingTransactionCount],
        ["Pending Fees", result.mempool.pendingFees],
        ["Max Pending", result.mempool.maxPendingTransactions],
        ["Per Sender Limit", result.mempool.maxPendingTransactionsPerSender],
        ["Data Per Sender", result.mempool.maxPendingDataTransactionsPerSender ?? dim("n/a")],
        ["Replacement Fee Bump", result.mempool.minReplacementFeeBump],
        ["Min Data Fee", result.mempool.minDataTransactionFee ?? dim("n/a")],
        ["Data Fee Chunk Bytes", result.mempool.dataFeeChunkBytes ?? dim("n/a")],
        ["Data Fee Per Chunk", result.mempool.dataFeePerChunk ?? dim("n/a")],
        ["Supported Tx Types", result.mempool.supportedTransactionTypes?.join(", ") || "n/a"]
    ]);

    printKeyValueBlock("API", [
        ["Rate Limit Used", result.api.rateLimit.used],
        ["Rate Limit Remaining", result.api.rateLimit.remaining],
        ["Rate Limit Max", result.api.rateLimit.limit],
        ["Window Ms", result.api.rateLimit.windowMs],
        ["Max Body Bytes", result.api.maxRequestBodyBytes]
    ]);
}

function renderStateSnapshot(result) {
    const stats = result.stats ?? {};
    const entries = Array.isArray(result.state) ? result.state : [];

    printKeyValueBlock("State", [
        ["View", result.view ?? "confirmed"],
        ["Active Keys", stats.activeKeys ?? 0],
        ["Total Changes", stats.totalChanges ?? 0],
        ["Supported Ops", Array.isArray(stats.supportedOperations) ? stats.supportedOperations.join(", ") : dim("n/a")],
        ["Pending Applied", stats.pendingAppliedTransactions ?? 0],
        ["Pending Rejected", stats.pendingRejectedTransactions ?? 0]
    ]);

    printTable(
        result.view === "pending" ? "Pending State Preview" : "Confirmed State",
        [
            { key: "key", label: "Key" },
            { key: "owner", label: "Owner" },
            { key: "value", label: "Value" },
            { key: "height", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        entries.map(entry => ({
            key: entry.key,
            owner: entry.owner ? shorten(entry.owner, 12, 8) : dim("n/a"),
            value: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value),
            height: entry.updatedAtBlockHeight ?? dim("n/a"),
            txId: entry.updatedByTxId ? shorten(entry.updatedByTxId, 14, 10) : dim("n/a")
        }))
    );
}

function renderStateKey(result) {
    printKeyValueBlock("State Key", [
        ["Key", result.key],
        ["View", result.view ?? (result.pendingPreview ? "pending" : "confirmed")],
        ["Exists", result.exists],
        ["Owner", result.owner ?? dim("n/a")],
        ["Value", result.value == null ? dim("null") : (typeof result.value === "string" ? result.value : JSON.stringify(result.value))],
        ["Updated In Block", result.updatedAtBlockHeight],
        ["Updated By TxId", result.updatedByTxId ?? dim("n/a")],
        ["History Length", result.historyLength ?? dim("n/a")]
    ]);

    if (Array.isArray(result.pendingExecutions) && result.pendingExecutions.length > 0) {
        printTable(
            "Pending Executions",
            [
                { key: "status", label: "Status" },
                { key: "changes", label: "Changes" },
                { key: "logs", label: "Logs" },
                { key: "txId", label: "TxId" }
            ],
            result.pendingExecutions.map(execution => ({
                status: execution.status,
                changes: execution.stateChanges.length,
                logs: execution.logs.join("; ") || "none",
                txId: shorten(execution.txId, 14, 10)
            }))
        );
    }
}

function renderStateHistory(result) {
    printKeyValueBlock("State History", [
        ["Key", result.key],
        ["Entries", result.history.length]
    ]);

    printTable(
        "History",
        [
            { key: "action", label: "Action" },
            { key: "owner", label: "Owner" },
            { key: "previousValue", label: "Previous" },
            { key: "nextValue", label: "Next" },
            { key: "blockHeight", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        result.history.map(entry => ({
            action: entry.action,
            owner: shorten(entry.owner, 12, 8),
            previousValue: entry.previousValue == null ? "null" : JSON.stringify(entry.previousValue),
            nextValue: entry.nextValue == null ? "null" : JSON.stringify(entry.nextValue),
            blockHeight: entry.blockHeight,
            txId: shorten(entry.txId, 14, 10)
        }))
    );
}

function renderTodoList(result) {
    printKeyValueBlock("Todo App", [
        ["Owner", result.owner],
        ["View", result.view ?? "confirmed"],
        ["Items", result.todos.length]
    ]);

    printTable(
        "Todos",
        [
            { key: "id", label: "Id" },
            { key: "done", label: "Done" },
            { key: "text", label: "Text" },
            { key: "updatedAtBlockHeight", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        result.todos.map(todo => ({
            id: todo.id,
            done: todo.done ? green("yes") : dim("no"),
            text: todo.text,
            updatedAtBlockHeight: todo.updatedAtBlockHeight ?? dim("pending"),
            txId: todo.updatedByTxId ? shorten(todo.updatedByTxId, 14, 10) : dim("pending")
        }))
    );

    if ((result.todos?.length ?? 0) === 0 && result.view !== "pending") {
        printHint("No confirmed todos yet. Try `duglas todo-list-pending <owner>` or mine the pending transaction.");
    }
}

function renderApps(result) {
    printKeyValueBlock("App Registry", [
        ["Network", result.network.networkName],
        ["Registered Apps", result.apps.length],
        ["Action Policies", result.actionPolicyCount ?? dim("n/a")]
    ]);

    printTable(
        "Apps",
        [
            { key: "name", label: "Name" },
            { key: "title", label: "Title" },
            { key: "prefix", label: "Prefix" },
            { key: "operations", label: "Operations" },
            { key: "description", label: "Description" }
        ],
        result.apps.map(app => ({
            name: app.name,
            title: app.title,
            prefix: app.prefix,
            operations: app.operations.join(", "),
            description: app.description
        }))
    );
}

function renderActionPolicies(result) {
    printKeyValueBlock("Action Policies", [
        ["Network", result.network.networkName],
        ["Policies", result.actionPolicies.length]
    ]);

    printTable(
        "Supported Actions",
        [
            { key: "app", label: "App" },
            { key: "action", label: "Action" },
            { key: "operation", label: "Operation" },
            { key: "params", label: "Params" },
            { key: "description", label: "Description" }
        ],
        result.actionPolicies.map(policy => ({
            app: policy.app,
            action: policy.action,
            operation: policy.operation,
            params: policy.params.length === 0
                ? dim("none")
                : policy.params
                    .map(param => `${param.name}:${param.type}${param.required ? "" : "?"}`)
                    .join(", "),
            description: policy.description
        }))
    );
}

function renderCounterList(result) {
    printKeyValueBlock("Counter App", [
        ["Owner", result.owner],
        ["View", result.view ?? "confirmed"],
        ["Items", result.counters.length]
    ]);

    printTable(
        "Counters",
        [
            { key: "id", label: "Id" },
            { key: "value", label: "Value" },
            { key: "updatedAtBlockHeight", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        result.counters.map(counter => ({
            id: counter.id,
            value: counter.value,
            updatedAtBlockHeight: counter.updatedAtBlockHeight ?? dim("pending"),
            txId: counter.updatedByTxId ? shorten(counter.updatedByTxId, 14, 10) : dim("pending")
        }))
    );

    if ((result.counters?.length ?? 0) === 0 && result.view !== "pending") {
        printHint("No confirmed counters yet. Try `duglas counter-list-pending <owner>` or mine the pending transaction.");
    }
}

function renderCounterEntry(result) {
    printKeyValueBlock("Counter", [
        ["Owner", result.owner],
        ["Id", result.id],
        ["View", result.view ?? "confirmed"],
        ["Exists", result.exists]
    ]);

    if (!result.exists || !result.counter) {
        if (result.view !== "pending") {
            printHint("Counter not found in confirmed state. Try `duglas counter-get-pending <owner> <id>` or mine the pending transaction.");
        }
        return;
    }

    printKeyValueBlock("Counter Details", [
        ["Value", result.counter.value],
        ["Created By", result.counter.createdBy ?? dim("n/a")],
        ["Created At", formatTimestamp(result.counter.createdAt)],
        ["Updated At", formatTimestamp(result.counter.updatedAt)],
        ["Updated In Block", result.counter.updatedAtBlockHeight ?? dim("pending")],
        ["Updated By TxId", result.counter.updatedByTxId ?? dim("pending")]
    ]);
}

function renderRegistryList(result) {
    printKeyValueBlock("Registry App", [
        ["View", result.view ?? "confirmed"],
        ["Entries", result.entries.length]
    ]);

    printTable(
        "Registry Entries",
        [
            { key: "name", label: "Name" },
            { key: "record", label: "Record" },
            { key: "ownerAddress", label: "Owner" },
            { key: "updatedAtBlockHeight", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        result.entries.map(entry => ({
            name: entry.name,
            record: entry.record,
            ownerAddress: shorten(entry.ownerAddress, 14, 10),
            updatedAtBlockHeight: entry.updatedAtBlockHeight ?? dim("pending"),
            txId: entry.updatedByTxId ? shorten(entry.updatedByTxId, 14, 10) : dim("pending")
        }))
    );

    if ((result.entries?.length ?? 0) === 0 && result.view !== "pending") {
        printHint("No confirmed registry entries yet. Try `duglas registry-list-pending` or mine the pending transaction.");
    }
}

function renderRegistryEntry(result) {
    printKeyValueBlock("Registry Entry", [
        ["Name", result.name],
        ["View", result.view ?? "confirmed"],
        ["Exists", result.exists]
    ]);

    if (!result.exists || !result.entry) {
        if (result.view !== "pending") {
            printHint("Registry entry not found in confirmed state. Try `duglas registry-get-pending <name>` or mine the pending transaction.");
        }
        return;
    }

    printKeyValueBlock("Entry Details", [
        ["Record", result.entry.record],
        ["Owner Address", result.entry.ownerAddress],
        ["Created By", result.entry.createdBy ?? dim("n/a")],
        ["Created At", formatTimestamp(result.entry.createdAt)],
        ["Updated At", formatTimestamp(result.entry.updatedAt)],
        ["Updated In Block", result.entry.updatedAtBlockHeight ?? dim("pending")],
        ["Updated By TxId", result.entry.updatedByTxId ?? dim("pending")]
    ]);
}

function renderProfileEntry(result) {
    printKeyValueBlock("Profile App", [
        ["Owner", result.owner],
        ["View", result.view ?? "confirmed"],
        ["Exists", result.exists]
    ]);

    if (!result.exists || !result.profile) {
        if (result.view !== "pending") {
            printHint("Profile not found in confirmed state. Try `duglas profile-get-pending <owner>` or mine the pending transaction.");
        }
        return;
    }

    printKeyValueBlock("Profile", [
        ["Address", result.profile.address],
        ["Display Name", result.profile.displayName],
        ["Bio", result.profile.bio || dim("empty")],
        ["Created By", result.profile.createdBy ?? dim("n/a")],
        ["Created At", formatTimestamp(result.profile.createdAt)],
        ["Updated At", formatTimestamp(result.profile.updatedAt)],
        ["Updated In Block", result.profile.updatedAtBlockHeight ?? dim("pending")],
        ["Updated By TxId", result.profile.updatedByTxId ?? dim("pending")]
    ]);
}

function renderNoteList(result) {
    printKeyValueBlock("Notes App", [
        ["Owner", result.owner],
        ["View", result.view ?? "confirmed"],
        ["Items", result.notes.length]
    ]);

    printTable(
        "Notes",
        [
            { key: "id", label: "Id" },
            { key: "content", label: "Content" },
            { key: "updatedAtBlockHeight", label: "Block" },
            { key: "txId", label: "TxId" }
        ],
        result.notes.map(note => ({
            id: note.id,
            content: note.content,
            updatedAtBlockHeight: note.updatedAtBlockHeight ?? dim("pending"),
            txId: note.updatedByTxId ? shorten(note.updatedByTxId, 14, 10) : dim("pending")
        }))
    );

    if ((result.notes?.length ?? 0) === 0 && result.view !== "pending") {
        printHint("No confirmed notes yet. Try `duglas note-list-pending <owner>` or mine the pending transaction.");
    }
}

function renderNoteEntry(result) {
    printKeyValueBlock("Note", [
        ["Owner", result.owner],
        ["Id", result.id],
        ["View", result.view ?? "confirmed"],
        ["Exists", result.exists]
    ]);

    if (!result.exists || !result.note) {
        if (result.view !== "pending") {
            printHint("Note not found in confirmed state. Try `duglas note-get-pending <owner> <id>` or mine the pending transaction.");
        }
        return;
    }

    printKeyValueBlock("Note Details", [
        ["Content", result.note.content],
        ["Created By", result.note.createdBy ?? dim("n/a")],
        ["Created At", formatTimestamp(result.note.createdAt)],
        ["Updated At", formatTimestamp(result.note.updatedAt)],
        ["Updated In Block", result.note.updatedAtBlockHeight ?? dim("pending")],
        ["Updated By TxId", result.note.updatedByTxId ?? dim("pending")]
    ]);
}

function renderSyncStatus(result) {
    printKeyValueBlock("Sync Status", [
        ["Network", result.network.networkName],
        ["State", result.syncState],
        ["Local Height", result.localHeight],
        ["Local Chain Work", result.localChainWork],
        ["Peer Count", result.peerCount],
        ["Reconnecting Peers", result.reconnectingPeerCount],
        ["Is Isolated", result.isIsolated],
        ["Has Pending Transactions", result.hasPendingTransactions],
        ["Last Block Hash", result.lastBlockHash]
    ]);
}

function renderFaucetStatus(result) {
    printKeyValueBlock("Faucet Status", [
        ["Network", result.network.networkName],
        ["Current Reward", result.currentReward],
        ["Cooldown Ms", result.cooldownMs],
        ["Next Available In Ms", result.nextAvailableInMs],
        ["Can Request Now", result.canRequestNow]
    ]);
}

function renderPeerDetails(result) {
    printKeyValueBlock("Peers", [
        ["Connected", result.connectedPeers.length],
        ["Reconnecting", result.reconnectingPeers.length]
    ]);

    printTable(
        "Connected Peers",
        [
            { key: "id", label: "ID" },
            { key: "address", label: "Address" },
            { key: "readyState", label: "State" },
            { key: "connectedAt", label: "Connected At" }
        ],
        result.connectedPeers.map(peer => ({
            id: peer.id,
            address: peer.address,
            readyState: peer.readyState,
            connectedAt: formatTimestamp(peer.connectedAt)
        }))
    );

    printTable(
        "Reconnecting Peers",
        [
            { key: "address", label: "Address" },
            { key: "reconnectScheduled", label: "Scheduled" }
        ],
        result.reconnectingPeers.map(peer => ({
            address: peer.address,
            reconnectScheduled: peer.reconnectScheduled
        }))
    );
}

async function runWatch(baseUrl, intervalMs) {
    while (true) {
        try {
            const overview = await loadOverview(baseUrl);
            renderOverview(baseUrl, overview);
            console.log("");
            console.log(dim(`Refreshing every ${intervalMs}ms. Press Ctrl+C to stop.`));
        } catch (error) {
            process.stdout.write("\x1Bc");
            console.error(red(error.message));
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
}

function printResult(command, result) {
    switch (command) {
        case "wallet":
            printKeyValueBlock("Wallet", [
                ["Address", result.address],
                ["Wallet File", result.walletFile],
                ["Wallet Directory", result.walletDirectory]
            ]);
            break;
        case "wallet-list":
            renderWalletList(result);
            break;
        case "wallet-new":
            printKeyValueBlock("Wallet Created", [
                ["Message", result.message],
                ["Address", result.address],
                ["Wallet File", result.walletFile],
                ["Named Wallet File", result.namedWalletFile]
            ]);
            break;
        case "wallet-seed-new":
            printKeyValueBlock("Mnemonic Wallet Created", [
                ["Message", result.message],
                ["Address", result.address],
                ["Wallet File", result.walletFile],
                ["Named Wallet File", result.namedWalletFile],
                ["Mnemonic Type", result.mnemonicType],
                ["Word Count", result.mnemonicWordCount]
            ]);
            printSection("Recovery Phrase");
            console.log(result.mnemonic);
            break;
        case "wallet-save":
        case "wallet-save-name":
            printKeyValueBlock("Wallet Saved", [
                ["Message", result.message],
                ["Address", result.address],
                ["Wallet File", result.walletFile],
                ["Named Wallet File", result.namedWalletFile]
            ]);
            break;
        case "wallet-load":
            printKeyValueBlock("Wallet Loaded", [
                ["Message", result.message],
                ["Address", result.address],
                ["Source Wallet File", result.sourceWalletFile],
                ["Active Wallet File", result.activeWalletFile]
            ]);
            break;
        case "wallet-switch":
            printKeyValueBlock("Wallet Switched", [
                ["Message", result.message],
                ["Name", result.name],
                ["Address", result.address],
                ["Source Wallet File", result.sourceWalletFile],
                ["Active Wallet File", result.activeWalletFile]
            ]);
            break;
        case "wallet-export":
            printKeyValueBlock("Wallet Export", [
                ["Address", result.address],
                ["Public Key", result.publicKey],
                ["Private Key", result.privateKey],
                ["Mnemonic Type", result.mnemonicType ?? dim("none")],
                ["Word Count", result.mnemonicWordCount ?? 0]
            ]);
            if (result.mnemonic) {
                printSection("Recovery Phrase");
                console.log(result.mnemonic);
            }
            break;
        case "wallet-import":
            printKeyValueBlock("Wallet Import", [
                ["Message", result.message],
                ["Address", result.address],
                ["Wallet File", result.walletFile],
                ["Named Wallet File", result.namedWalletFile]
            ]);
            break;
        case "wallet-seed-import":
            printKeyValueBlock("Mnemonic Wallet Import", [
                ["Message", result.message],
                ["Address", result.address],
                ["Wallet File", result.walletFile],
                ["Named Wallet File", result.namedWalletFile],
                ["Mnemonic Type", result.mnemonicType],
                ["Word Count", result.mnemonicWordCount]
            ]);
            break;
        case "address":
            printKeyValueBlock("Address", [
                ["Address", result.address],
                ["Wallet File", result.walletFile]
            ]);
            break;
        case "network":
            printKeyValueBlock("Network", [
                ["Name", result.networkName],
                ["Symbol", result.symbol],
                ["Decimals", String(result.decimals)],
                ["Chain ID", String(result.chainId)],
                ["Protocol Version", String(result.protocolVersion)],
                ["Block Version", String(result.blockVersion)],
                ["Consensus", result.consensus],
                ["Address Format", result.addressFormat],
                ["Genesis ID", result.genesisId]
            ]);
            break;
        case "node-info":
            renderNodeInfo(result);
            break;
        case "status":
            renderStatus(result);
            break;
        case "stats":
            renderStats(result);
            break;
        case "sync-status":
            renderSyncStatus(result);
            break;
        case "state":
            renderStateSnapshot(result);
            break;
        case "state-pending":
            renderStateSnapshot(result);
            break;
        case "state-get":
            renderStateKey(result);
            break;
        case "state-get-pending":
            renderStateKey(result);
            break;
        case "state-history":
            renderStateHistory(result);
            break;
        case "apps":
            renderApps(result);
            break;
        case "action-policies":
            renderActionPolicies(result);
            break;
        case "counter-list":
            renderCounterList(result);
            break;
        case "counter-list-pending":
            renderCounterList(result);
            break;
        case "counter-get":
            renderCounterEntry(result);
            break;
        case "counter-get-pending":
            renderCounterEntry(result);
            break;
        case "registry-list":
            renderRegistryList(result);
            break;
        case "registry-list-pending":
            renderRegistryList(result);
            break;
        case "registry-get":
            renderRegistryEntry(result);
            break;
        case "registry-get-pending":
            renderRegistryEntry(result);
            break;
        case "profile-get":
            renderProfileEntry(result);
            break;
        case "profile-get-pending":
            renderProfileEntry(result);
            break;
        case "todo-list":
            renderTodoList(result);
            break;
        case "todo-list-pending":
            renderTodoList(result);
            break;
        case "note-list":
            renderNoteList(result);
            break;
        case "note-list-pending":
            renderNoteList(result);
            break;
        case "note-get":
            renderNoteEntry(result);
            break;
        case "note-get-pending":
            renderNoteEntry(result);
            break;
        case "balance":
            printKeyValueBlock("Balance", [
                ["Address", result.address],
                ["Confirmed", result.confirmedBalance],
                ["Available", result.availableBalance],
                ["Next Nonce", result.nextNonce]
            ]);
            break;
        case "send":
            printKeyValueBlock("Transaction Sent", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "transfer"],
                ["Amount", result.transaction.amount],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            if (result.transaction.payload) {
                printJsonBlock("Transaction Payload", result.transaction.payload);
            }
            break;
        case "send-data":
            printKeyValueBlock("Payload Transaction Sent", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Amount", result.transaction.amount],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            break;
        case "send-action":
            printKeyValueBlock("Action Transaction Sent", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Amount", result.transaction.amount],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            break;
        case "todo-create":
        case "todo-toggle":
        case "todo-delete":
            printKeyValueBlock("Todo App Transaction", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            printHint("This app transaction is pending until it is mined. Use `duglas todo-list-pending <owner>` or `duglas mine`.");
            break;
        case "note-set":
        case "note-delete":
            printKeyValueBlock("Notes App Transaction", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            printHint("This app transaction is pending until it is mined. Use `duglas note-list-pending <owner>` or `duglas mine`.");
            break;
        case "profile-set":
        case "profile-delete":
            printKeyValueBlock("Profile App Transaction", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            printHint("This app transaction is pending until it is mined. Use `duglas profile-get-pending <owner>` or `duglas mine`.");
            break;
        case "registry-set":
        case "registry-delete":
            printKeyValueBlock("Registry App Transaction", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            printHint("This app transaction is pending until it is mined. Use `duglas registry-list-pending` or `duglas mine`.");
            break;
        case "counter-create":
        case "counter-add":
        case "counter-sub":
        case "counter-delete":
            printKeyValueBlock("Counter App Transaction", [
                ["Message", result.message],
                ["TxId", result.transaction.txId],
                ["Type", result.transaction.type ?? "data"],
                ["Fee", result.transaction.fee],
                ["Nonce", result.transaction.nonce],
                ["To", result.transaction.to]
            ]);
            printJsonBlock("Transaction Payload", result.transaction.payload);
            printHint("This app transaction is pending until it is mined. Use `duglas counter-list-pending <owner>` or `duglas mine`.");
            break;
        case "mine":
            printKeyValueBlock("Mining Result", [
                ["Message", result.message],
                ["Miner", result.miner],
                ["Block Hash", result.block.hash],
                ["Transactions", result.block.transactions.length]
            ]);
            break;
        case "faucet":
            printKeyValueBlock("Faucet", [
                ["Message", result.message],
                ["Address", result.address],
                ["Amount", result.amount],
                ["Block Hash", result.block.hash]
            ]);
            break;
        case "faucet-status":
            renderFaucetStatus(result);
            break;
        case "blocks":
            printTable(
                "Blocks",
                [
                    { key: "height", label: "Height" },
                    { key: "txs", label: "Txs" },
                    { key: "fees", label: "Fees" },
                    { key: "reward", label: "Reward" },
                    { key: "difficulty", label: "Diff" },
                    { key: "hash", label: "Hash" }
                ],
                result.slice().reverse().map(blockSummaryRow)
            );
            break;
        case "blocks-full":
            printTable(
                "Blocks",
                [
                    { key: "height", label: "Height" },
                    { key: "txs", label: "Txs" },
                    { key: "fees", label: "Fees" },
                    { key: "reward", label: "Reward" },
                    { key: "difficulty", label: "Diff" },
                    { key: "hash", label: "Hash" }
                ],
                result.slice().reverse().map(blockFullRow)
            );
            break;
        case "block":
            printJsonBlock("Block", result);
            break;
        case "tx":
            renderTransactionLookup(result);
            break;
        case "receipt":
            renderTransactionReceipt(result);
            break;
        case "activity":
            renderAddress(result);
            break;
        case "mempool":
            printTable(
                "Mempool",
                [
                    { key: "status", label: "Status" },
                    { key: "type", label: "Type" },
                    { key: "amount", label: "Amount" },
                    { key: "fee", label: "Fee" },
                    { key: "nonce", label: "Nonce" },
                    { key: "from", label: "From" },
                    { key: "to", label: "To" },
                    { key: "txId", label: "TxId" }
                ],
                result.map(transaction => transactionRow(transaction))
            );
            break;
        case "mempool-full":
            printTable(
                "Mempool",
                [
                    { key: "status", label: "Status" },
                    { key: "type", label: "Type" },
                    { key: "amount", label: "Amount" },
                    { key: "fee", label: "Fee" },
                    { key: "nonce", label: "Nonce" },
                    { key: "from", label: "From" },
                    { key: "to", label: "To" },
                    { key: "txId", label: "TxId" }
                ],
                result.map(transaction => transactionFullRow(transaction))
            );
            break;
        case "peers":
            printKeyValueBlock("Peers", [["Connected Peers", result.connectedPeers]]);
            break;
        case "peers-full":
            renderPeerDetails(result);
            break;
        default:
            console.log(JSON.stringify(result, null, 2));
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === "help") {
        printUsage(args[1] || null);
        return;
    }

    if (command === "overview") {
        const baseUrl = resolveBaseUrl(args, 1);
        const overview = await loadOverview(baseUrl);
        renderOverview(baseUrl, overview);
        return;
    }

    if (command === "watch") {
        const baseUrl = resolveBaseUrl(args, 1);
        const intervalMs = Number(args[2] || DEFAULT_WATCH_INTERVAL_MS);
        await runWatch(baseUrl, intervalMs);
        return;
    }

    if (command === "reset:state") {
        runLocalCommand(
            "Local Reset",
            process.execPath,
            [path.join(PROJECT_ROOT, "scripts", "reset_state.js")]
        );
        return;
    }

    if (command === "reset:local") {
        runLocalCommand(
            "Local Reset",
            process.execPath,
            [path.join(PROJECT_ROOT, "scripts", "reset_state.js"), "--wallets"]
        );
        return;
    }

    if (command === "testnet:up") {
        runLocalCommand("Docker Testnet", "docker", ["compose", "up", "--build"]);
        return;
    }

    if (command === "testnet:down") {
        runLocalCommand("Docker Testnet", "docker", ["compose", "down"]);
        return;
    }

    if (command === "testnet:reset") {
        runLocalCommand("Docker Testnet", "docker", ["compose", "down", "-v"]);
        return;
    }

    let result;

    switch (command) {
        case "wallet":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/wallet");
            break;
        case "wallet-list":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/wallets");
            break;
        case "wallet-new":
            result = await requestJson(
                "POST",
                args[1] && !args[1].startsWith("http") ? resolveBaseUrl(args, 2) : resolveBaseUrl(args, 1),
                "/wallet/new",
                args[1] && !args[1].startsWith("http") ? { name: args[1] } : {}
            );
            break;
        case "wallet-seed-new":
            result = await requestJson(
                "POST",
                args[1] && !args[1].startsWith("http") ? resolveBaseUrl(args, 2) : resolveBaseUrl(args, 1),
                "/wallet/mnemonic/new",
                args[1] && !args[1].startsWith("http") ? { name: args[1] } : {}
            );
            break;
        case "wallet-save":
            if (!args[1]) {
                throw new Error("Usage: duglas wallet-save <filePath> [baseUrl]");
            }

            result = await requestJson(
                "POST",
                resolveBaseUrl(args, 2),
                "/wallet/save",
                { filePath: args[1] }
            );
            break;
        case "wallet-save-name":
            if (!args[1]) {
                throw new Error("Usage: duglas wallet-save-name <name> [baseUrl]");
            }

            result = await requestJson(
                "POST",
                resolveBaseUrl(args, 2),
                "/wallet/save",
                { name: args[1] }
            );
            break;
        case "wallet-load":
            if (!args[1]) {
                throw new Error("Usage: duglas wallet-load <filePath> [baseUrl]");
            }

            result = await requestJson(
                "POST",
                resolveBaseUrl(args, 2),
                "/wallet/load",
                { filePath: args[1] }
            );
            break;
        case "wallet-switch":
            if (!args[1]) {
                throw new Error("Usage: duglas wallet-switch <name> [baseUrl]");
            }

            result = await requestJson(
                "POST",
                resolveBaseUrl(args, 2),
                "/wallet/switch",
                { name: args[1] }
            );
            break;
        case "wallet-export":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/wallet/export");
            break;
        case "wallet-import":
            if (!args[1]) {
                throw new Error("Usage: duglas wallet-import <privateKey> [baseUrl]");
            }

            {
                const maybeName = args[2];
                const hasName = maybeName !== undefined && !String(maybeName).startsWith("http");
                const baseUrl = hasName ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2);
                const body = hasName
                    ? { privateKey: args[1], name: maybeName }
                    : { privateKey: args[1] };

                result = await requestJson(
                    "POST",
                    baseUrl,
                    "/wallet/import",
                    body
                );
            }
            break;
        case "wallet-seed-import":
            if (!args[1]) {
                throw new Error("Usage: duglas wallet-seed-import \"word1 ...\" [name] [baseUrl]");
            }

            {
                const maybeName = args[2];
                const hasName = maybeName !== undefined && !String(maybeName).startsWith("http");
                const baseUrl = hasName ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2);
                const body = hasName
                    ? { mnemonic: args[1], name: maybeName }
                    : { mnemonic: args[1] };

                result = await requestJson(
                    "POST",
                    baseUrl,
                    "/wallet/mnemonic/import",
                    body
                );
            }
            break;
        case "address":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/address");
            break;
        case "network":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/network");
            break;
        case "action-policies":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/action-policies");
            break;
        case "node-info":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/node-info");
            break;
        case "status":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/status");
            break;
        case "stats":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/stats");
            break;
        case "sync-status":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/sync-status");
            break;
        case "state":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/state");
            break;
        case "state-pending":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/state/pending");
            break;
        case "state-get":
            if (!args[1]) {
                throw new Error("Usage: duglas state-get <key> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/state/${encodeURIComponent(args[1])}`);
            break;
        case "state-get-pending":
            if (!args[1]) {
                throw new Error("Usage: duglas state-get-pending <key> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/state/${encodeURIComponent(args[1])}?view=pending`
            );
            break;
        case "state-history":
            if (!args[1]) {
                throw new Error("Usage: duglas state-history <key> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/state/${encodeURIComponent(args[1])}/history`);
            break;
        case "apps":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/apps");
            break;
        case "counter-list":
            if (!args[1]) {
                throw new Error("Usage: duglas counter-list <owner> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/apps/counter/${encodeURIComponent(args[1])}`);
            break;
        case "counter-list-pending":
            if (!args[1]) {
                throw new Error("Usage: duglas counter-list-pending <owner> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/apps/counter/${encodeURIComponent(args[1])}?view=pending`
            );
            break;
        case "counter-get":
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas counter-get <owner> <id> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 3),
                `/apps/counter/${encodeURIComponent(args[1])}/${encodeURIComponent(args[2])}`
            );
            break;
        case "counter-get-pending":
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas counter-get-pending <owner> <id> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 3),
                `/apps/counter/${encodeURIComponent(args[1])}/${encodeURIComponent(args[2])}?view=pending`
            );
            break;
        case "counter-create": {
            if (!args[1] || args[2] === undefined) {
                throw new Error("Usage: duglas counter-create <id> <initialValue> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                "/apps/counter",
                { id: args[1], initialValue: Number(args[2]), fee }
            );
            break;
        }
        case "counter-add": {
            if (!args[1] || args[2] === undefined) {
                throw new Error("Usage: duglas counter-add <id> <delta> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/counter/${encodeURIComponent(args[1])}/add`,
                { delta: Number(args[2]), fee }
            );
            break;
        }
        case "counter-sub": {
            if (!args[1] || args[2] === undefined) {
                throw new Error("Usage: duglas counter-sub <id> <delta> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/counter/${encodeURIComponent(args[1])}/sub`,
                { delta: Number(args[2]), fee }
            );
            break;
        }
        case "counter-delete": {
            if (!args[1]) {
                throw new Error("Usage: duglas counter-delete <id> [fee] [baseUrl]");
            }

            const maybeFee = args[2];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2);

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/counter/${encodeURIComponent(args[1])}/delete`,
                { fee }
            );
            break;
        }
        case "registry-list":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/apps/registry");
            break;
        case "registry-list-pending":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/apps/registry?view=pending");
            break;
        case "registry-get":
            if (!args[1]) {
                throw new Error("Usage: duglas registry-get <name> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/apps/registry/${encodeURIComponent(args[1])}`);
            break;
        case "registry-get-pending":
            if (!args[1]) {
                throw new Error("Usage: duglas registry-get-pending <name> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/apps/registry/${encodeURIComponent(args[1])}?view=pending`
            );
            break;
        case "registry-set": {
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas registry-set <name> <record> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                "/apps/registry",
                { name: args[1], record: args[2], fee }
            );
            break;
        }
        case "registry-delete": {
            if (!args[1]) {
                throw new Error("Usage: duglas registry-delete <name> [fee] [baseUrl]");
            }

            const maybeFee = args[2];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2);

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/registry/${encodeURIComponent(args[1])}/delete`,
                { fee }
            );
            break;
        }
        case "profile-get":
            if (!args[1]) {
                throw new Error("Usage: duglas profile-get <owner> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/apps/profile/${encodeURIComponent(args[1])}`);
            break;
        case "profile-get-pending":
            if (!args[1]) {
                throw new Error("Usage: duglas profile-get-pending <owner> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/apps/profile/${encodeURIComponent(args[1])}?view=pending`
            );
            break;
        case "profile-set": {
            if (!args[1]) {
                throw new Error("Usage: duglas profile-set <displayName> [bio] [fee] [baseUrl]");
            }

            let bio = "";
            let nextIndex = 2;

            if (
                args[2] !== undefined &&
                !String(args[2]).startsWith("http") &&
                Number.isNaN(Number(args[2]))
            ) {
                bio = args[2];
                nextIndex = 3;
            }

            const maybeFee = args[nextIndex];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, nextIndex + 1) : resolveBaseUrl(args, nextIndex);

            result = await requestJson(
                "POST",
                baseUrl,
                "/apps/profile",
                { displayName: args[1], bio, fee }
            );
            break;
        }
        case "profile-delete": {
            const maybeFee = args[1];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 2) : resolveBaseUrl(args, 1);

            result = await requestJson(
                "POST",
                baseUrl,
                "/apps/profile/delete",
                { fee }
            );
            break;
        }
        case "todo-list":
            if (!args[1]) {
                throw new Error("Usage: duglas todo-list <owner> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/apps/todo/${encodeURIComponent(args[1])}`);
            break;
        case "todo-list-pending":
            if (!args[1]) {
                throw new Error("Usage: duglas todo-list-pending <owner> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/apps/todo/${encodeURIComponent(args[1])}?view=pending`
            );
            break;
        case "note-list":
            if (!args[1]) {
                throw new Error("Usage: duglas note-list <owner> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/apps/notes/${encodeURIComponent(args[1])}`);
            break;
        case "note-list-pending":
            if (!args[1]) {
                throw new Error("Usage: duglas note-list-pending <owner> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/apps/notes/${encodeURIComponent(args[1])}?view=pending`
            );
            break;
        case "note-get":
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas note-get <owner> <id> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 3),
                `/apps/notes/${encodeURIComponent(args[1])}/${encodeURIComponent(args[2])}`
            );
            break;
        case "note-get-pending":
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas note-get-pending <owner> <id> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 3),
                `/apps/notes/${encodeURIComponent(args[1])}/${encodeURIComponent(args[2])}?view=pending`
            );
            break;
        case "note-set": {
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas note-set <id> <content> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                "/apps/notes",
                { id: args[1], content: args[2], fee }
            );
            break;
        }
        case "note-delete": {
            if (!args[1]) {
                throw new Error("Usage: duglas note-delete <id> [fee] [baseUrl]");
            }

            const maybeFee = args[2];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2);

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/notes/${encodeURIComponent(args[1])}/delete`,
                { fee }
            );
            break;
        }
        case "todo-create": {
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas todo-create <id> <text> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                "/apps/todo",
                { id: args[1], text: args[2], fee }
            );
            break;
        }
        case "todo-toggle": {
            if (!args[1]) {
                throw new Error("Usage: duglas todo-toggle <id> [done|undone] [fee] [baseUrl]");
            }

            const maybeMode = args[2];
            const hasMode = maybeMode === "done" || maybeMode === "undone";
            const maybeFee = hasMode ? args[3] : args[2];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasMode
                ? (hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3))
                : (hasFee ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2));
            const body = { fee };

            if (hasMode) {
                body.done = maybeMode === "done";
            }

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/todo/${encodeURIComponent(args[1])}/toggle`,
                body
            );
            break;
        }
        case "todo-delete": {
            if (!args[1]) {
                throw new Error("Usage: duglas todo-delete <id> [fee] [baseUrl]");
            }

            const maybeFee = args[2];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 3) : resolveBaseUrl(args, 2);

            result = await requestJson(
                "POST",
                baseUrl,
                `/apps/todo/${encodeURIComponent(args[1])}/delete`,
                { fee }
            );
            break;
        }
        case "balance": {
            const maybeAddress = args[1];
            const maybeBaseUrl = args[2];
            const baseUrl = maybeAddress && maybeAddress.startsWith("http")
                ? maybeAddress
                : (maybeBaseUrl || DEFAULT_BASE_URL);
            const path = maybeAddress && !maybeAddress.startsWith("http")
                ? `/balance?address=${encodeURIComponent(maybeAddress)}`
                : "/balance";
            result = await requestJson("GET", baseUrl, path);
            break;
        }
        case "send": {
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas send <to> <amount> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);

            result = await requestJson(
                "POST",
                baseUrl,
                "/transactions",
                { to: args[1], amount: Number(args[2]), fee }
            );
            break;
        }
        case "send-data": {
            if (!args[1] || !args[2]) {
                throw new Error("Usage: duglas send-data <to> <jsonPayload> [fee] [baseUrl]");
            }

            const maybeFee = args[3];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 4) : resolveBaseUrl(args, 3);
            let payload;

            try {
                payload = JSON.parse(args[2]);
            } catch {
                throw new Error("Payload must be valid JSON");
            }

            result = await requestJson(
                "POST",
                baseUrl,
                "/transactions",
                { to: args[1], amount: 0, fee, type: "data", payload }
            );
            break;
        }
        case "send-action": {
            if (!args[1] || !args[2] || !args[3] || !args[4]) {
                throw new Error("Usage: duglas send-action <to> <app> <action> <jsonParams> [fee] [baseUrl]");
            }

            const maybeFee = args[5];
            const hasFee = maybeFee !== undefined && !String(maybeFee).startsWith("http");
            const fee = hasFee ? Number(maybeFee) : 0;
            const baseUrl = hasFee ? resolveBaseUrl(args, 6) : resolveBaseUrl(args, 5);
            let params;

            try {
                params = JSON.parse(args[4]);
            } catch {
                throw new Error("Params must be valid JSON");
            }

            result = await requestJson(
                "POST",
                baseUrl,
                "/transactions",
                {
                    to: args[1],
                    amount: 0,
                    fee,
                    type: "data",
                    payload: {
                        app: args[2],
                        action: args[3],
                        params
                    }
                }
            );
            break;
        }
        case "mine":
            result = await requestJson("POST", resolveBaseUrl(args, 1), "/mine", {});
            break;
        case "faucet": {
            const maybeAddress = args[1];
            const baseUrl = maybeAddress && maybeAddress.startsWith("http")
                ? maybeAddress
                : resolveBaseUrl(args, 2);
            const body = maybeAddress && !maybeAddress.startsWith("http")
                ? { address: maybeAddress }
                : {};
            result = await requestJson("POST", baseUrl, "/faucet", body);
            break;
        }
        case "faucet-status":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/faucet/status");
            break;
        case "blocks":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/blocks");
            break;
        case "blocks-full":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/blocks");
            break;
        case "block":
            if (!args[1]) {
                throw new Error("Usage: duglas block <hash> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/blocks/${args[1]}`);
            break;
        case "tx":
            if (!args[1]) {
                throw new Error("Usage: duglas tx <txId> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/transactions/${args[1]}`);
            break;
        case "receipt":
            if (!args[1]) {
                throw new Error("Usage: duglas receipt <txId> [baseUrl]");
            }

            result = await requestJson("GET", resolveBaseUrl(args, 2), `/transactions/${args[1]}/receipt`);
            break;
        case "activity":
            if (!args[1]) {
                throw new Error("Usage: duglas activity <address> [baseUrl]");
            }

            result = await requestJson(
                "GET",
                resolveBaseUrl(args, 2),
                `/addresses/${args[1]}/transactions`
            );
            break;
        case "mempool":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/mempool");
            break;
        case "mempool-full":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/mempool");
            break;
        case "peers":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/peers");
            break;
        case "peers-full":
            result = await requestJson("GET", resolveBaseUrl(args, 1), "/peers/full");
            break;
        default:
            throw new Error(`Unknown command: ${command}`);
    }

    printResult(command, result);
}

main().catch(error => {
    console.error(red(error.message || "Command failed"));
    process.exitCode = 1;
});
