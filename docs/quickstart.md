# Quickstart

This guide is the fastest route from zero to a working Duglas node with real transactions, balances, mining, and receipts.

If you want the short version:

1. install dependencies
2. start a node
3. fund a wallet
4. send a transaction
5. mine a block
6. inspect the result

## Prerequisites

You need:

- Node.js `18+`
- npm
- Docker Desktop if you want the multi-node local testnet

## Install the project

If you are using the repository directly:

```bash
git clone <your-repo-url>
cd blockchainJS
npm install
```

If you want the `duglas` command available globally on your machine during local development:

```bash
npm link
```

After that:

```bash
duglas help
```

If you do not link the package, every CLI example in this guide can also be run as:

```bash
npm run cli -- <command>
```

Example:

```bash
npm run cli -- overview
```

## Quick Start: Single Node

### 1. Start your first node

```bash
npm run start:node1
```

This starts:

- HTTP API on `http://localhost:3001`
- P2P node on `ws://localhost:6001`

Keep this terminal open.

### 2. Open the terminal explorer

In another terminal:

```bash
duglas overview
```

That gives you a compact live snapshot of:

- network identity
- active node info
- wallet balance
- latest blocks
- current mempool view

### 3. Check the active wallet

```bash
duglas wallet
duglas address
```

The node always has an active wallet.
That wallet is the sender for faucet and transaction commands unless you switch to another one.

### 4. Fund the active wallet

```bash
duglas faucet
duglas balance
```

The faucet gives test coins to the active wallet so you can immediately use the chain.

Save this wallet under a stable name:

```bash
duglas wallet-save-name alice
```

This is strongly recommended because the rest of the examples become much easier to follow.

### 5. Create a second wallet

```bash
duglas wallet-seed-new bob
duglas wallet-list
```

Now you have:

- `alice`: funded sender
- `bob`: receiver

### 6. Switch back to the funded wallet

```bash
duglas wallet-switch alice
```

### 7. Send a transaction

Use Bob's address from `duglas wallet-list` or `duglas wallet`.

```bash
duglas send 0xBOB_ADDRESS 10 1
```

Arguments:

- `0xBOB_ADDRESS`: receiver
- `10`: amount
- `1`: fee

The CLI prints a `TxId`.
That is the transaction identifier used by:

- `duglas tx`
- `duglas receipt`
- receipts in explorer views
- block inspection

### 8. Inspect the pending transaction

```bash
duglas tx TX_ID
duglas receipt TX_ID
duglas mempool
```

At this point the transaction is valid, signed, and in the mempool, but not yet confirmed.

That means:

- sender available balance is lower
- sender confirmed balance is unchanged
- receiver confirmed balance is still unchanged
- receipt status is `pending`

### 9. Mine a block

```bash
duglas mine
```

Mining confirms the pending transaction and adds a new block to the chain.

### 10. Verify the final result

```bash
duglas receipt TX_ID
duglas blocks
duglas wallet-switch bob
duglas balance
```

Now the receiver should have confirmed balance, and the receipt should point to a block hash and block height.

## Quick Start: Multi-Node Local Testnet

If you want a more realistic local network, use Docker.

### 1. Start the testnet

```bash
duglas testnet:up
```

This brings up three nodes.

By default:

- node 1: `http://localhost:3001`
- node 2: `http://localhost:3002`
- node 3: `http://localhost:3003`

### 2. Query different nodes

```bash
duglas overview http://localhost:3001
duglas overview http://localhost:3002
duglas overview http://localhost:3003
```

You can also query a specific command against another node by appending the base URL:

```bash
duglas stats http://localhost:3002
duglas peers http://localhost:3003
duglas blocks http://localhost:3002
```

### 3. Stop or reset the testnet

Stop containers but keep Docker volumes:

```bash
duglas testnet:down
```

Stop containers and wipe the Docker volumes:

```bash
duglas testnet:reset
```

## Wallet Workflow

The intended wallet flow is:

1. fund the default wallet
2. save it under a name
3. create more wallets
4. switch between them
5. export only when needed

Useful commands:

```bash
duglas wallet
duglas wallet-list
duglas wallet-save-name alice
duglas wallet-seed-new bob
duglas wallet-switch bob
duglas wallet-export
```

Important note:

- `wallet-export` reveals secret material
- never commit exported private keys or mnemonic phrases
- never publish wallet JSON files from your local machine

## Transaction Lifecycle

The easiest way to understand Duglas is to follow one transaction through its lifecycle.

### Step 1: Create it

```bash
duglas send 0xADDRESS 10 1
```

### Step 2: See it in the mempool

```bash
duglas mempool
duglas tx TX_ID
duglas receipt TX_ID
```

### Step 3: Mine it

```bash
duglas mine
```

### Step 4: Confirm it

```bash
duglas receipt TX_ID
duglas block BLOCK_HASH
duglas activity 0xADDRESS
```

That one loop teaches most of the important concepts:

- mempool admission
- signed transactions
- pending receipts
- block inclusion
- balance settlement

## State Layer Workflow

Duglas supports payload transactions that can update deterministic on-chain state.

There are two ways to send them.

### Raw payload transaction

```bash
duglas send-data 0xADDRESS '{"op":"kv:set","key":"greeting","value":"hello"}' 1
```

### Formal action transaction

```bash
duglas send-action 0xADDRESS kv set '{"key":"greeting","value":"hello"}' 1
```

The second form is preferred because it is structured as:

```json
{
  "app": "kv",
  "action": "set",
  "params": {
    "key": "greeting",
    "value": "hello"
  }
}
```

### Preview pending state

```bash
duglas state-pending
duglas state-get-pending greeting
```

This shows what the mempool would do to chain-derived state if you mined the next block right now.

### Confirm state

```bash
duglas mine
duglas state
duglas state-get greeting
duglas state-history greeting
```

## App Layer Workflow

The app layer demonstrates that the chain can carry structured application actions.

Current modules:

- `todo`
- `notes`
- `profile`
- `registry`
- `counter`

### Todo example

Create a todo:

```bash
duglas todo-create ship_mvp "Ship the Duglas MVP" 1
```

Preview before mining:

```bash
duglas address
duglas todo-list-pending 0xYOUR_ADDRESS
```

Confirm:

```bash
duglas mine
duglas todo-list 0xYOUR_ADDRESS
duglas todo-toggle ship_mvp done 1
duglas mine
```

### Notes example

Create or update a note:

```bash
duglas note-set roadmap "Ship state layer and notes app" 1
```

Preview:

```bash
duglas address
duglas note-list-pending 0xYOUR_ADDRESS
duglas note-get-pending 0xYOUR_ADDRESS roadmap
```

Confirm:

```bash
duglas mine
duglas note-list 0xYOUR_ADDRESS
duglas note-get 0xYOUR_ADDRESS roadmap
```

### Profile example

```bash
duglas profile-set "Daniil" "Building Duglas Testnet" 1
duglas address
duglas profile-get-pending 0xYOUR_ADDRESS
duglas mine
duglas profile-get 0xYOUR_ADDRESS
```

### Registry example

```bash
duglas registry-set duglas "https://testnet.duglas.local" 1
duglas registry-list-pending
duglas registry-get-pending duglas
duglas mine
duglas registry-get duglas
```

### Counter example

```bash
duglas counter-create score 10 1
duglas counter-add score 5 1
duglas counter-sub score 3 1
duglas address
duglas counter-list-pending 0xYOUR_ADDRESS
duglas mine
duglas counter-get 0xYOUR_ADDRESS score
```

## Useful Inspection Commands

These commands are especially helpful while learning the chain:

```bash
duglas overview
duglas watch
duglas status
duglas stats
duglas network
duglas node-info
duglas sync-status
duglas peers
duglas blocks
duglas blocks-full
duglas block BLOCK_HASH
duglas mempool
duglas mempool-full
duglas tx TX_ID
duglas receipt TX_ID
duglas activity 0xADDRESS
duglas state
duglas state-pending
duglas apps
duglas action-policies
```

## Common Mistakes

### Sending coins and expecting the receiver balance to change immediately

Balances only become confirmed after mining.
Before mining, the transaction is only in the mempool.

### Using the P2P port as the HTTP URL

This is a common one.

Wrong:

```bash
duglas address http://localhost:6001
```

Port `6001` is the WebSocket P2P port, not the HTTP API port.

Use:

```bash
duglas address http://localhost:3001
```

### Stopping the node and expecting the chain to reset automatically

Duglas persists state on purpose.

Use:

```bash
duglas reset:state
```

or:

```bash
duglas testnet:reset
```

### Creating app actions and expecting confirmed state before mining

Use pending views first:

```bash
duglas state-pending
duglas note-list-pending 0xYOUR_ADDRESS
duglas profile-get-pending 0xYOUR_ADDRESS
```

Then mine:

```bash
duglas mine
```

## Recommended Learning Path

If your goal is to really understand the project, this order works best:

1. run one node
2. fund and save a wallet
3. create a second wallet
4. send and mine normal transactions
5. inspect receipts and blocks
6. try key-value state actions
7. try app-layer actions
8. run the Docker testnet
9. compare node views across `3001`, `3002`, and `3003`
10. then read the architecture document

Continue with:

- [CLI Guide](./cli.md)
- [HTTP API](./http-api.md)
- [Architecture](./architecture.md)
- [User Flows](./user-flows.md)
