# User Flows

This document answers the practical question:

`What can someone actually do with Duglas Testnet, and in what order?`

That matters because Duglas is not just a codebase.
It is a usable blockchain testnet runtime with a CLI and API.

## The Main Product Flows

There are six primary user stories in the current project:

1. start a node or a local testnet
2. create and manage wallets
3. fund wallets with test coins
4. send and confirm transactions
5. inspect chain, mempool, blocks, and receipts
6. submit structured data actions and inspect derived state

## Flow 1: Start the Chain

### Single-node developer flow

Best for:

- first learning session
- local debugging
- code reading while the node is running

Commands:

```bash
npm install
npm run start:node1
duglas overview
```

What you get:

- one active node
- one active wallet
- one HTTP API
- one P2P server
- a local chain starting from genesis

### Multi-node local testnet flow

Best for:

- demonstrating peer sync
- comparing views across nodes
- testing P2P propagation

Commands:

```bash
duglas testnet:up
duglas overview http://localhost:3001
duglas overview http://localhost:3002
duglas overview http://localhost:3003
```

What you get:

- three nodes
- peer connectivity
- synchronized local testnet state

## Flow 2: Wallet Management

This is the first real operator workflow after the node is up.

### Save the funded primary wallet

```bash
duglas faucet
duglas wallet-save-name alice
```

Why:

- the active wallet is useful immediately
- saving it under a name makes later switching easy

### Create another wallet

```bash
duglas wallet-seed-new bob
duglas wallet-list
```

Why:

- one wallet acts as sender
- one wallet acts as receiver
- that makes transaction testing much clearer

### Switch wallets

```bash
duglas wallet-switch alice
duglas wallet-switch bob
```

This changes the local node's active sender identity.

### Export wallet data

```bash
duglas wallet-export
```

Use carefully.
This reveals sensitive material and is for development and backup workflows only.

## Flow 3: Faucet and Test Coin Usage

Duglas includes a faucet because it is a testnet.

### Fund the active wallet

```bash
duglas faucet
duglas balance
```

### Fund another address

```bash
duglas faucet 0xADDRESS
```

This is how test coins enter circulation in the local chain model.

## Flow 4: Send and Confirm a Payment

This is the most important blockchain flow in the project.

### Create a transaction

```bash
duglas send 0xBOB_ADDRESS 10 1
```

What happens:

- the CLI signs a transaction using the active wallet
- the node validates it
- if valid, it enters the mempool
- the output prints a `TxId`

### Inspect the pending state

```bash
duglas tx TX_ID
duglas receipt TX_ID
duglas mempool
duglas balance
```

At this point:

- sender available balance is reduced
- sender confirmed balance is unchanged
- receiver confirmed balance is unchanged
- receipt shows `pending`

### Confirm the transaction

```bash
duglas mine
```

### Verify the confirmation

```bash
duglas receipt TX_ID
duglas blocks
duglas wallet-switch bob
duglas balance
```

This is the single most important learning loop in Duglas.

## Flow 5: Explore the Chain

After sending and mining a few transactions, the natural next step is chain exploration.

### Overview and live watch

```bash
duglas overview
duglas watch
```

### Inspect blocks

```bash
duglas blocks
duglas blocks-full
duglas block BLOCK_HASH
```

### Inspect address history

```bash
duglas activity 0xADDRESS
```

### Inspect the mempool

```bash
duglas mempool
duglas mempool-full
```

### Inspect network identity and sync state

```bash
duglas network
duglas stats
duglas sync-status
duglas peers
```

This flow turns Duglas into a terminal blockchain explorer.

## Flow 6: Use the State Layer

The state layer is where Duglas moves beyond pure payments.

### Submit a raw state payload

```bash
duglas send-data 0xYOUR_ADDRESS '{"op":"kv:set","key":"greeting","value":"hello"}' 1
```

### Submit the same idea as a formal action

```bash
duglas send-action 0xYOUR_ADDRESS kv set '{"key":"greeting","value":"hello"}' 1
```

Why the second form matters:

- cleaner semantics
- app/action separation
- better future extensibility

### Inspect pending state

```bash
duglas state-pending
duglas state-get-pending greeting
```

### Confirm state

```bash
duglas mine
duglas state
duglas state-get greeting
duglas state-history greeting
```

This flow demonstrates deterministic state derivation from signed transactions.

## Flow 7: Use App-Layer Modules

The app layer proves that Duglas can support structured behavior without a full VM yet.

### Todo flow

```bash
duglas todo-create ship_mvp "Ship the Duglas MVP" 1
duglas todo-list-pending 0xYOUR_ADDRESS
duglas mine
duglas todo-list 0xYOUR_ADDRESS
duglas todo-toggle ship_mvp done 1
duglas mine
```

### Notes flow

```bash
duglas note-set roadmap "Ship state layer and notes app" 1
duglas note-list-pending 0xYOUR_ADDRESS
duglas mine
duglas note-get 0xYOUR_ADDRESS roadmap
```

### Profile flow

```bash
duglas profile-set "Daniil" "Building Duglas Testnet" 1
duglas profile-get-pending 0xYOUR_ADDRESS
duglas mine
duglas profile-get 0xYOUR_ADDRESS
```

### Registry flow

```bash
duglas registry-set duglas "https://testnet.duglas.local" 1
duglas registry-get-pending duglas
duglas mine
duglas registry-get duglas
```

### Counter flow

```bash
duglas counter-create score 10 1
duglas counter-add score 5 1
duglas counter-sub score 3 1
duglas counter-list-pending 0xYOUR_ADDRESS
duglas mine
duglas counter-get 0xYOUR_ADDRESS score
```

## Flow 8: Use Duglas as a Product

Once published, the intended end-user experience is not:

```bash
npm run cli -- overview
```

It is:

```bash
duglas overview
```

Or:

```bash
npx duglas-testnet overview
```

That is why packaging matters.
The codebase is the source.
The CLI command is the product surface.

## Who This Project Is For

Duglas is useful for:

- developers learning blockchain internals
- portfolio builders who want a real custom chain project
- people experimenting with wallets, mining, mempool rules, and P2P sync
- future work on higher-level execution features

## What Duglas Is Not For

Duglas is not currently for:

- deploying Solidity contracts
- connecting MetaMask through Ethereum JSON-RPC
- storing market-value assets
- public production token infrastructure

That is not a weakness.
It is a scope choice.

## Recommended End-to-End Demo Flow

If you want to demo the project to someone else, this is a strong sequence:

1. start the Docker testnet
2. show `duglas overview`
3. show `duglas network`
4. create and save two wallets
5. fund the sender
6. send a transaction
7. show the pending receipt
8. mine a block
9. show the confirmed receipt
10. show the receiver balance
11. create a `kv` state action
12. show pending state
13. mine again
14. show confirmed state
15. create one app-layer item such as a todo or note

That one flow tells the whole product story very well.

## The Current Product Story

The cleanest single-sentence description today is:

`Duglas Testnet is a custom blockchain testnet with a usable CLI, HTTP API, wallet system, mining loop, state layer, and app-layer transaction model.`

That is already a coherent and serious outcome for the current phase of the project.
