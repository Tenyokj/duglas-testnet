# CLI Guide

The Duglas CLI is both a terminal explorer and an operator toolkit for your local blockchain testnet.

You can use it in two equivalent ways:

- repository mode: `npm run cli -- <command>`
- linked or installed mode: `duglas <command>`

Examples in this guide use `duglas`.

## Command Model

Most commands follow one of these patterns:

- inspect local node state
- inspect a specific address, block, or transaction
- perform a wallet operation
- submit a transaction
- mine the next block
- inspect state or app-layer data
- manage local development/testnet environments

Many commands can target another node by passing a base URL as the last argument:

```bash
duglas status http://localhost:3002
duglas balance 0xADDRESS http://localhost:3003
duglas watch http://localhost:3001 2000
```

The last argument pattern matters:

- if the final argument looks like `http://...`, the CLI treats it as the target node
- some commands also accept an interval before the URL, such as `watch`

## Help

Start here if you want command discovery.

```bash
duglas help
duglas help send
duglas help wallet
```

Use `help` when:

- you forgot arguments
- you are not sure whether a command is local-only or network-backed
- you want to compare related commands quickly

## Local Utility Commands

These commands manage your local development environment rather than chain state itself.

```bash
duglas reset:state
duglas reset:local
duglas testnet:up
duglas testnet:down
duglas testnet:reset
```

### `reset:state`

Deletes local persisted chain state such as `state-*.json`.
Use this when you want to restart your local chain from genesis.

### `reset:local`

Deletes local chain state and local wallet files.
Use this when you want a completely clean local environment.

### `testnet:up`

Starts the Docker-based three-node Duglas local network.

### `testnet:down`

Stops containers but keeps Docker volumes.
That means chain history survives restarts.

### `testnet:reset`

Stops containers and removes Docker volumes.
Use this when you want a fresh Docker testnet.

## Overview and Monitoring

These commands are the main terminal explorer surface.

```bash
duglas overview
duglas watch
duglas watch http://localhost:3002 5000
```

### `overview`

Shows a compact snapshot of:

- network identity
- local node info
- chain stats
- active wallet balances
- latest blocks
- mempool state

This is the best command for everyday use.

### `watch`

Refreshes overview periodically.
Use it when you want a live console dashboard while mining or sending transactions.

## Wallet Commands

```bash
duglas wallet
duglas wallet-list
duglas wallet-new
duglas wallet-new alice
duglas wallet-seed-new alice
duglas wallet-save ./backup-wallet.json
duglas wallet-save-name alice
duglas wallet-load ./backup-wallet.json
duglas wallet-switch alice
duglas wallet-export
duglas wallet-import PRIVATE_KEY_HEX
duglas wallet-seed-import "word1 word2 ... word16" alice
```

### `wallet`

Shows the currently active wallet for the node.

### `wallet-list`

Shows saved named wallets available for switching.

### `wallet-new`

Creates a new private-key-backed wallet.

### `wallet-seed-new`

Creates a mnemonic-based wallet using the Duglas `custom-v1` mnemonic format.

### `wallet-save`

Exports the active wallet to a specific file path.

### `wallet-save-name`

Stores the active wallet under a friendly local name in the wallet registry.

### `wallet-load`

Loads a wallet from an exported wallet file.

### `wallet-switch`

Switches the active node wallet to a named saved wallet.

### `wallet-export`

Prints secret wallet material.
Use carefully and never commit or publish the output.

### `wallet-import`

Imports a private key directly.

### `wallet-seed-import`

Imports a mnemonic wallet using the project-specific mnemonic format.

## Network and Diagnostics Commands

```bash
duglas address
duglas network
duglas action-policies
duglas node-info
duglas status
duglas stats
duglas sync-status
duglas peers
duglas peers-full
duglas faucet-status
```

### `address`

Prints the active wallet address exposed by the node.

### `network`

Prints chain identity:

- name
- symbol
- decimals
- chain ID
- protocol version
- genesis ID

### `action-policies`

Lists the formal app/action policy registry.
This shows:

- supported apps
- supported actions
- legacy operation aliases
- parameter expectations

Use this to understand what structured payload actions the node accepts.

### `node-info`

Shows node-local runtime information such as ports and wallet identity.

### `status`

Returns a compact health and chain summary.

### `stats`

Shows aggregate network-style metrics such as height, supply, reward, fees, and difficulty.

### `sync-status`

Shows synchronization-oriented details and can help when comparing nodes.

### `peers`

Compact peer list.

### `peers-full`

Verbose peer details.

### `faucet-status`

Shows faucet configuration and availability.

## Transaction Commands

```bash
duglas balance
duglas balance 0xADDRESS
duglas faucet
duglas faucet 0xADDRESS
duglas send 0xADDRESS 10 2
duglas send-data 0xADDRESS '{"op":"kv:set","key":"theme","value":"blue"}' 1
duglas send-action 0xADDRESS kv set '{"key":"theme","value":"blue"}' 1
duglas mine
duglas mempool
duglas mempool-full
duglas tx TX_ID
duglas receipt TX_ID
duglas activity 0xADDRESS
```

### `balance`

Shows:

- confirmed balance
- available balance
- next nonce

If you omit an address, it uses the active wallet.

### `faucet`

Requests test coins.
If you omit an address, it funds the active wallet.

### `send`

Creates a signed value transfer transaction.

Arguments:

- receiver address
- amount
- fee

The output includes the `TxId`.

### `send-data`

Creates a raw typed `data` transaction with a JSON payload.

Example:

```bash
duglas send-data 0xADDRESS '{"op":"kv:set","key":"theme","value":"blue"}' 1
```

### `send-action`

Creates a structured app-layer payload transaction.

Example:

```bash
duglas send-action 0xADDRESS kv set '{"key":"theme","value":"blue"}' 1
```

This is the preferred format for new stateful features because it uses:

```json
{
  "app": "kv",
  "action": "set",
  "params": {
    "key": "theme",
    "value": "blue"
  }
}
```

### `mine`

Mines the next block on the selected node.

Important:

- mempool transactions are not confirmed until they are mined
- receipts stay `pending` until block inclusion
- receiver confirmed balance does not change until mining

### `mempool`

Compact mempool listing.

### `mempool-full`

Verbose mempool listing including more transaction metadata.

### `tx`

Shows the transaction object known by the node.

### `receipt`

Shows lifecycle state:

- pending
- confirmed block info
- settlement details

If a transaction is unmined, fields such as block hash or block height remain pending or unavailable.

### `activity`

Shows address-related transaction history.

## State Commands

```bash
duglas state
duglas state-pending
duglas state-get greeting
duglas state-get-pending greeting
duglas state-history greeting
```

### `state`

Shows confirmed key-value state summary and preview rows.

### `state-pending`

Shows how the current mempool would affect state if mined now.

### `state-get`

Shows one confirmed state key.

### `state-get-pending`

Shows one state key through the pending-state lens.

### `state-history`

Shows the historical updates applied to a specific key.

## App Commands

The app layer proves that Duglas can carry structured application actions on top of the blockchain.

### App discovery

```bash
duglas apps
```

### Counter app

```bash
duglas counter-list 0xOWNER_ADDRESS
duglas counter-list-pending 0xOWNER_ADDRESS
duglas counter-get 0xOWNER_ADDRESS score
duglas counter-get-pending 0xOWNER_ADDRESS score
duglas counter-create score 10 1
duglas counter-add score 5 1
duglas counter-sub score 3 1
duglas counter-delete score 1
```

Use this to model numeric state owned by an address.

### Registry app

```bash
duglas registry-list
duglas registry-list-pending
duglas registry-get duglas
duglas registry-get-pending duglas
duglas registry-set duglas "https://testnet.duglas.local" 1
duglas registry-delete duglas 1
```

Use this for global key-to-record mappings.

### Profile app

```bash
duglas profile-get 0xOWNER_ADDRESS
duglas profile-get-pending 0xOWNER_ADDRESS
duglas profile-set "Daniil" "Building Duglas Testnet" 1
duglas profile-delete 1
```

Use this for one profile per address.

### Todo app

```bash
duglas todo-list 0xOWNER_ADDRESS
duglas todo-list-pending 0xOWNER_ADDRESS
duglas todo-create ship_mvp "Ship the Duglas MVP" 1
duglas todo-toggle ship_mvp
duglas todo-toggle ship_mvp done 1
duglas todo-delete ship_mvp 1
```

Use this for namespaced boolean task state under an owner address.

### Notes app

```bash
duglas note-list 0xOWNER_ADDRESS
duglas note-list-pending 0xOWNER_ADDRESS
duglas note-get 0xOWNER_ADDRESS roadmap
duglas note-get-pending 0xOWNER_ADDRESS roadmap
duglas note-set roadmap "Ship state layer and notes app" 1
duglas note-delete roadmap 1
```

Use this for namespaced text storage under an owner address.

## Block Commands

```bash
duglas blocks
duglas blocks-full
duglas block BLOCK_HASH
```

### `blocks`

Shows recent blocks with compact hashes.
This is intentionally concise and optimized for overview-style use.

### `blocks-full`

Shows full hashes when you want exact copy/paste identifiers.

### `block`

Shows one block in detail by hash.

## Reading CLI Output Correctly

A few output conventions matter:

### Compact hashes

Some overview commands shorten long hashes with `...`.
This is expected and intentional.
Use `blocks-full`, `tx`, or `receipt` when you need exact full identifiers.

### Pending versus confirmed

Many Duglas views separate:

- pending mempool effects
- confirmed chain state

That distinction is one of the most important concepts in the project.

### `n/a`

`n/a` usually means:

- the value does not exist yet
- the transaction is pending and not included in a block
- the state object has not been created

It is often normal, not an error.

## Common Command Examples

### Explore node 2

```bash
duglas overview http://localhost:3002
duglas stats http://localhost:3002
duglas peers http://localhost:3002
```

### Send coins to another wallet

```bash
duglas wallet-switch alice
duglas send 0xBOB_ADDRESS 10 1
duglas receipt TX_ID
duglas mine
duglas wallet-switch bob
duglas balance
```

### Create and confirm state

```bash
duglas send-action 0xYOUR_ADDRESS kv set '{"key":"greeting","value":"hello"}' 1
duglas state-pending
duglas mine
duglas state-get greeting
```

### Watch the network live

```bash
duglas watch
duglas watch http://localhost:3003 2000
```

## Troubleshooting

### `Upgrade Required`

This usually means you targeted the WebSocket P2P port instead of the HTTP API port.

Wrong:

```bash
duglas address http://localhost:6001
```

Correct:

```bash
duglas address http://localhost:3001
```

### `Network request failed`

Usually means:

- the node is not running
- the wrong HTTP port was used
- Docker testnet is down

Check:

```bash
duglas status
duglas status http://localhost:3002
```

### Transactions seem stuck

Check:

```bash
duglas mempool
duglas receipt TX_ID
```

Then mine:

```bash
duglas mine
```

### State or app item is missing

Check the pending view first:

```bash
duglas state-pending
duglas todo-list-pending 0xYOUR_ADDRESS
duglas note-list-pending 0xYOUR_ADDRESS
```

If it is there, mine the next block.

## Recommended Command Progression

If you are new to the project, this order works well:

1. `duglas help`
2. `duglas overview`
3. `duglas wallet`
4. `duglas faucet`
5. `duglas balance`
6. `duglas wallet-seed-new bob`
7. `duglas send`
8. `duglas receipt`
9. `duglas mine`
10. `duglas blocks`
11. `duglas state-pending`
12. `duglas send-action`
13. `duglas apps`

For the broader usage story, continue with:

- [Quickstart](./quickstart.md)
- [HTTP API](./http-api.md)
- [User Flows](./user-flows.md)
