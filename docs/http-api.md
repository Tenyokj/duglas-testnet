# HTTP API

Each Duglas node exposes an HTTP API, usually on `http://localhost:3001`.

The API is the automation surface behind the CLI.
If you want to build scripts, bots, dashboards, or external tools for the chain, this is the interface to use.

## API Model

The API is organized into a few areas:

- node and network inspection
- wallet management
- chain and transaction inspection
- transaction submission and mining
- state layer inspection
- app-layer endpoints
- faucet support

The API is intentionally simple and testnet-friendly.
It is not trying to imitate Ethereum JSON-RPC.

## Base URLs

Typical local URLs:

- node 1: `http://localhost:3001`
- node 2: `http://localhost:3002`
- node 3: `http://localhost:3003`

Important:

- ports `3001`, `3002`, `3003` are HTTP API ports
- ports `6001`, `6002`, `6003` are P2P WebSocket ports

If you hit a `600x` port with HTTP, you will usually get protocol mismatch errors such as `Upgrade Required`.

## Response Style

Most endpoints return JSON objects.

Typical patterns:

- status objects
- entity details
- lists with summary data
- created transaction responses
- receipt objects

The CLI formats these JSON responses into tables and terminal blocks.

## Core Endpoints

### Node and network

- `GET /status`
- `GET /network`
- `GET /action-policies`
- `GET /node-info`
- `GET /stats`
- `GET /sync-status`
- `GET /peers`
- `GET /peers/full`

### Wallet

- `GET /address`
- `GET /wallet`
- `GET /wallets`
- `GET /wallet/export`
- `POST /wallet/new`
- `POST /wallet/mnemonic/new`
- `POST /wallet/save`
- `POST /wallet/load`
- `POST /wallet/switch`
- `POST /wallet/import`
- `POST /wallet/mnemonic/import`

### Chain and transactions

- `GET /balance`
- `GET /chain`
- `GET /blocks`
- `GET /blocks/:hash`
- `GET /mempool`
- `GET /state`
- `GET /state/pending`
- `GET /state/:key`
- `GET /state/:key/history`
- `GET /transactions/:txId`
- `GET /transactions/:txId/receipt`
- `GET /addresses/:address/transactions`
- `POST /transactions`
- `POST /mine`

### App layer

- `GET /apps`
- `GET /apps/counter/:owner`
- `GET /apps/counter/:owner?view=pending`
- `GET /apps/counter/:owner/:id`
- `GET /apps/counter/:owner/:id?view=pending`
- `POST /apps/counter`
- `POST /apps/counter/:id/add`
- `POST /apps/counter/:id/sub`
- `POST /apps/counter/:id/delete`
- `GET /apps/registry`
- `GET /apps/registry?view=pending`
- `GET /apps/registry/:name`
- `GET /apps/registry/:name?view=pending`
- `POST /apps/registry`
- `POST /apps/registry/:name/delete`
- `GET /apps/profile/:owner`
- `GET /apps/profile/:owner?view=pending`
- `POST /apps/profile`
- `POST /apps/profile/delete`
- `GET /apps/todo/:owner`
- `GET /apps/todo/:owner?view=pending`
- `POST /apps/todo`
- `POST /apps/todo/:id/toggle`
- `POST /apps/todo/:id/delete`
- `GET /apps/notes/:owner`
- `GET /apps/notes/:owner?view=pending`
- `GET /apps/notes/:owner/:id`
- `GET /apps/notes/:owner/:id?view=pending`
- `POST /apps/notes`
- `POST /apps/notes/:id/delete`

### Faucet

- `GET /faucet/status`
- `POST /faucet`

## Node and Network Endpoints

### `GET /status`

Returns a compact node health and chain summary.

Example:

```bash
curl http://localhost:3001/status
```

Use this for:

- basic connectivity checks
- health checks
- quick automation probes

### `GET /network`

Returns network identity:

- name
- symbol
- decimals
- chain ID
- protocol version
- block version
- consensus
- address format
- genesis ID

Example:

```bash
curl http://localhost:3001/network
```

### `GET /action-policies`

Returns the formal action registry supported by the state/app layer.

Example:

```bash
curl http://localhost:3001/action-policies
```

Use this when building tools that want to know:

- supported apps
- supported actions
- expected parameter shapes
- legacy operation aliases

### `GET /node-info`

Returns node-local details such as ports and active wallet identity.

Example:

```bash
curl http://localhost:3001/node-info
```

### `GET /stats`

Returns chain-wide summary metrics such as:

- height
- supply
- reward
- difficulty
- pending fee totals

Example:

```bash
curl http://localhost:3001/stats
```

### `GET /sync-status`

Returns synchronization-oriented node information.

Example:

```bash
curl http://localhost:3001/sync-status
```

### `GET /peers` and `GET /peers/full`

Returns peer connectivity data.

Examples:

```bash
curl http://localhost:3001/peers
curl http://localhost:3001/peers/full
```

## Wallet Endpoints

### `GET /address`

Returns the active wallet address exposed by the node.

```bash
curl http://localhost:3001/address
```

This is the node's current sender identity, not a generic address directory.

### `GET /wallet`

Returns active wallet metadata.

```bash
curl http://localhost:3001/wallet
```

### `GET /wallets`

Returns saved local wallets known to the node.

```bash
curl http://localhost:3001/wallets
```

### `GET /wallet/export`

Returns secret wallet material.
Treat this as sensitive.

```bash
curl http://localhost:3001/wallet/export
```

### `POST /wallet/new`

Creates a new private-key-backed wallet.

```bash
curl -X POST http://localhost:3001/wallet/new \
  -H "Content-Type: application/json" \
  -d '{"name":"alice"}'
```

### `POST /wallet/mnemonic/new`

Creates a new mnemonic-based wallet using the Duglas `custom-v1` format.

```bash
curl -X POST http://localhost:3001/wallet/mnemonic/new \
  -H "Content-Type: application/json" \
  -d '{"name":"alice"}'
```

### `POST /wallet/save`

Saves the active wallet to a named file path.

```bash
curl -X POST http://localhost:3001/wallet/save \
  -H "Content-Type: application/json" \
  -d '{"filePath":"./backup-wallet.json"}'
```

### `POST /wallet/load`

Loads a wallet from a file path.

```bash
curl -X POST http://localhost:3001/wallet/load \
  -H "Content-Type: application/json" \
  -d '{"filePath":"./backup-wallet.json"}'
```

### `POST /wallet/switch`

Switches active wallet to a saved named wallet.

```bash
curl -X POST http://localhost:3001/wallet/switch \
  -H "Content-Type: application/json" \
  -d '{"name":"alice"}'
```

### `POST /wallet/import`

Imports a raw private key.

```bash
curl -X POST http://localhost:3001/wallet/import \
  -H "Content-Type: application/json" \
  -d '{"privateKey":"PRIVATE_KEY_HEX","name":"alice"}'
```

### `POST /wallet/mnemonic/import`

Imports a `custom-v1` mnemonic wallet.

```bash
curl -X POST http://localhost:3001/wallet/mnemonic/import \
  -H "Content-Type: application/json" \
  -d '{"mnemonic":"word1 word2 ... word16","name":"alice"}'
```

## Transaction and Chain Endpoints

### `GET /balance`

Returns balance and nonce information for the active wallet or a provided address.

Examples:

```bash
curl http://localhost:3001/balance
curl "http://localhost:3001/balance?address=0xADDRESS"
```

The response distinguishes between:

- `confirmedBalance`
- `availableBalance`
- `nextNonce`

That distinction matters because pending transactions can reduce available balance before mining.

### `GET /chain`

Returns the full chain view known by the node.

```bash
curl http://localhost:3001/chain
```

### `GET /blocks`

Returns a recent or summarized block listing.

```bash
curl http://localhost:3001/blocks
```

### `GET /blocks/:hash`

Returns one block by hash.

```bash
curl http://localhost:3001/blocks/BLOCK_HASH
```

### `GET /mempool`

Returns the current mempool.

```bash
curl http://localhost:3001/mempool
```

### `GET /transactions/:txId`

Returns a transaction by ID.

```bash
curl http://localhost:3001/transactions/TX_ID
```

### `GET /transactions/:txId/receipt`

Returns the transaction receipt.

```bash
curl http://localhost:3001/transactions/TX_ID/receipt
```

Pending transactions can legitimately show incomplete fields such as:

- block hash
- block height
- confirmations

### `GET /addresses/:address/transactions`

Returns address activity/history.

```bash
curl http://localhost:3001/addresses/0xADDRESS/transactions
```

### `POST /transactions`

Creates a new transaction.

#### Normal value transfer

```bash
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{"to":"0xRECEIVER","amount":10,"fee":2}'
```

#### Raw data transaction

```bash
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{"to":"0xRECEIVER","type":"data","payload":{"op":"kv:set","key":"greeting","value":"hello"},"fee":1}'
```

#### Structured action transaction

```bash
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{"to":"0xRECEIVER","type":"data","payload":{"app":"kv","action":"set","params":{"key":"greeting","value":"hello"}},"fee":1}'
```

Data transaction notes:

- they require a minimum fee
- larger payloads may require a higher fee
- per-sender pending data caps may apply

### `POST /mine`

Mines the next block.

```bash
curl -X POST http://localhost:3001/mine \
  -H "Content-Type: application/json" \
  -d '{}'
```

This includes:

- pending transactions
- miner reward
- collected fees

## State Endpoints

### `GET /state`

Returns confirmed state summary and entries.

```bash
curl http://localhost:3001/state
```

### `GET /state/pending`

Returns the pending-state preview derived from mempool contents.

```bash
curl http://localhost:3001/state/pending
```

### `GET /state/:key`

Returns one state key.

Confirmed view:

```bash
curl http://localhost:3001/state/greeting
```

Pending view:

```bash
curl http://localhost:3001/state/greeting?view=pending
```

### `GET /state/:key/history`

Returns update history for one state key.

```bash
curl http://localhost:3001/state/greeting/history
```

## App Layer Endpoints

The app layer is built on top of structured data transactions and deterministic state derivation.

Use these endpoints when you want domain-specific workflows instead of raw payload submission.

### App registry

```bash
curl http://localhost:3001/apps
```

### Counter app

Read:

```bash
curl http://localhost:3001/apps/counter/0xOWNER_ADDRESS
curl http://localhost:3001/apps/counter/0xOWNER_ADDRESS?view=pending
curl http://localhost:3001/apps/counter/0xOWNER_ADDRESS/score
curl http://localhost:3001/apps/counter/0xOWNER_ADDRESS/score?view=pending
```

Write:

```bash
curl -X POST http://localhost:3001/apps/counter \
  -H "Content-Type: application/json" \
  -d '{"id":"score","initialValue":10,"fee":1}'

curl -X POST http://localhost:3001/apps/counter/score/add \
  -H "Content-Type: application/json" \
  -d '{"delta":5,"fee":1}'

curl -X POST http://localhost:3001/apps/counter/score/sub \
  -H "Content-Type: application/json" \
  -d '{"delta":3,"fee":1}'

curl -X POST http://localhost:3001/apps/counter/score/delete \
  -H "Content-Type: application/json" \
  -d '{"fee":1}'
```

### Registry app

Read:

```bash
curl http://localhost:3001/apps/registry
curl http://localhost:3001/apps/registry?view=pending
curl http://localhost:3001/apps/registry/duglas
curl http://localhost:3001/apps/registry/duglas?view=pending
```

Write:

```bash
curl -X POST http://localhost:3001/apps/registry \
  -H "Content-Type: application/json" \
  -d '{"name":"duglas","record":"https://testnet.duglas.local","fee":1}'

curl -X POST http://localhost:3001/apps/registry/duglas/delete \
  -H "Content-Type: application/json" \
  -d '{"fee":1}'
```

### Profile app

Read:

```bash
curl http://localhost:3001/apps/profile/0xOWNER_ADDRESS
curl http://localhost:3001/apps/profile/0xOWNER_ADDRESS?view=pending
```

Write:

```bash
curl -X POST http://localhost:3001/apps/profile \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Daniil","bio":"Building Duglas Testnet","fee":1}'

curl -X POST http://localhost:3001/apps/profile/delete \
  -H "Content-Type: application/json" \
  -d '{"fee":1}'
```

### Todo app

Read:

```bash
curl http://localhost:3001/apps/todo/0xOWNER_ADDRESS
curl http://localhost:3001/apps/todo/0xOWNER_ADDRESS?view=pending
```

Write:

```bash
curl -X POST http://localhost:3001/apps/todo \
  -H "Content-Type: application/json" \
  -d '{"id":"ship_mvp","text":"Ship the Duglas MVP","fee":1}'

curl -X POST http://localhost:3001/apps/todo/ship_mvp/toggle \
  -H "Content-Type: application/json" \
  -d '{"done":true,"fee":1}'

curl -X POST http://localhost:3001/apps/todo/ship_mvp/delete \
  -H "Content-Type: application/json" \
  -d '{"fee":1}'
```

### Notes app

Read:

```bash
curl http://localhost:3001/apps/notes/0xOWNER_ADDRESS
curl http://localhost:3001/apps/notes/0xOWNER_ADDRESS?view=pending
curl http://localhost:3001/apps/notes/0xOWNER_ADDRESS/roadmap
curl http://localhost:3001/apps/notes/0xOWNER_ADDRESS/roadmap?view=pending
```

Write:

```bash
curl -X POST http://localhost:3001/apps/notes \
  -H "Content-Type: application/json" \
  -d '{"id":"roadmap","content":"Ship state layer and notes app","fee":1}'

curl -X POST http://localhost:3001/apps/notes/roadmap/delete \
  -H "Content-Type: application/json" \
  -d '{"fee":1}'
```

## Faucet Endpoints

### `GET /faucet/status`

Returns faucet availability and policy information.

```bash
curl http://localhost:3001/faucet/status
```

### `POST /faucet`

Requests test coins.

For the active wallet:

```bash
curl -X POST http://localhost:3001/faucet \
  -H "Content-Type: application/json" \
  -d '{}'
```

For a specific address:

```bash
curl -X POST http://localhost:3001/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"0xADDRESS"}'
```

## Recommended Automation Flows

### Health check

```bash
curl http://localhost:3001/status
curl http://localhost:3001/network
curl http://localhost:3001/stats
```

### Send and confirm payment

```bash
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{"to":"0xRECEIVER","amount":10,"fee":1}'

curl http://localhost:3001/transactions/TX_ID/receipt

curl -X POST http://localhost:3001/mine \
  -H "Content-Type: application/json" \
  -d '{}'

curl http://localhost:3001/transactions/TX_ID/receipt
```

### Create confirmed state

```bash
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{"to":"0xOWNER","type":"data","payload":{"app":"kv","action":"set","params":{"key":"greeting","value":"hello"}},"fee":1}'

curl http://localhost:3001/state/pending

curl -X POST http://localhost:3001/mine \
  -H "Content-Type: application/json" \
  -d '{}'

curl http://localhost:3001/state/greeting
```

## API Limits

The node currently applies a few testnet-friendly protections:

- basic request rate limiting
- faucet cooldown per request source
- request body size limits

These are practical guardrails for a local testnet, not production-grade API hardening.

## Security Notes

- `GET /wallet/export` is sensitive
- wallet import endpoints handle secret material
- local wallet files should never be committed
- faucet endpoints are intended for testing, not public token distribution

For operator-level flows, also see:

- [CLI Guide](./cli.md)
- [Publishing Guide](./publishing.md)
