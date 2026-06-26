# Architecture

Duglas Testnet is a custom blockchain runtime.
It is not an Ethereum compatibility layer and it is not trying to pretend to be one.

The project is intentionally built to show how a blockchain node, wallet model, mempool, mining loop, and deterministic state derivation can fit together in a compact codebase.

## Architectural Goal

The core architectural goal is:

`custom blockchain first, execution platform later`

That means the current system prioritizes:

- chain validity
- transaction flow
- wallet UX
- mempool rules
- mining and rewards
- node synchronization
- deterministic state derivation
- operator tooling

Instead of prioritizing:

- smart contracts
- bytecode
- gas metering
- Ethereum JSON-RPC compatibility

## High-Level Components

The project is built from a few core runtime areas:

- `src/node/index.js`: node runtime and HTTP API
- `src/core/blockchain.js`: chain state, mempool, mining, receipts, state derivation, app logic
- `src/core/transaction.js`: transaction hashing, signing, normalization, typing
- `src/core/wallet.js`: wallet creation, import/export, checksum addresses, mnemonic support
- `src/network/p2p.js`: node-to-node propagation and synchronization
- `src/core/storage.js`: on-disk persistence helpers
- `src/core/rate_limiter.js`: HTTP-side request protections
- `bin/duglas.js`: terminal explorer and operator interface
- `scripts/reset_state.js`: local state reset utility
- `tests/`: automated test suite

## Runtime Layers

The easiest way to understand Duglas is as four stacked layers.

### 1. Chain layer

Responsible for:

- block structure
- previous-hash linking
- Proof-of-Work validity
- cumulative chain work
- chain replacement rules

This is the base ledger layer.

### 2. Transaction layer

Responsible for:

- sender identity
- signatures
- nonces
- fees
- typed transactions
- mempool admission
- double-spend-style prevention through nonce and balance validation

This is the movement and intent layer.

### 3. State derivation layer

Responsible for:

- deriving deterministic key-value state from confirmed data transactions
- building a pending-state preview from mempool contents
- storing state history

This is where the chain starts becoming a platform rather than only a payment log.

### 4. App layer

Responsible for:

- defining action semantics for `counter`, `registry`, `profile`, `todo`, and `notes`
- mapping structured payloads into deterministic state changes
- exposing higher-level domain concepts over generic transactions

This is the bridge toward future execution or contract-like features.

## Node Runtime

The node runtime lives in `src/node/index.js`.

It combines:

- blockchain state
- wallet context
- HTTP API
- P2P connectivity
- persistence

Typical runtime responsibilities include:

- start the HTTP server
- start the WebSocket P2P server
- create or load node state
- load or initialize wallet material
- accept user/API transactions
- broadcast valid transactions to peers
- accept chain updates from peers
- persist local state after changes

## Block Model

At a high level, each block carries:

- block version
- height
- previous block hash
- timestamp
- difficulty
- nonce
- transaction list
- miner reward semantics

The block hash represents the committed identity of the block and is produced through the PoW mining process.

## Consensus Model

Duglas currently uses:

`pow-sha256`

This means:

- miners search for a nonce that produces a valid block hash
- the valid chain is chosen by work, not by wall-clock recency alone
- nodes may replace their current chain with a heavier valid chain

This is intentionally simple and local-testnet friendly, but it still teaches the right core ideas:

- proof search
- block validity
- competing histories
- heavier-chain replacement

## Transaction Model

Duglas transactions are signed and typed.

Core properties include:

- `from`
- `to`
- `amount`
- `fee`
- `timestamp`
- `nonce`
- `txId`
- `signature`
- optional `type`
- optional `payload`

### Standard value transactions

Used for coin transfers between addresses.

### Data transactions

Used for structured payloads and future higher-level behavior.

This is a major architectural decision.
Instead of introducing a VM immediately, Duglas first introduces:

- typed transactions
- structured payloads
- deterministic state effects

That keeps the system understandable while still moving toward platform capabilities.

## Wallet Model

The wallet layer is built around `secp256k1`.

Current capabilities:

- generate a private-key wallet
- generate a mnemonic-backed wallet
- derive checksum `0x...` addresses
- import and export private keys
- import and export mnemonic-backed wallets
- save named local wallets
- switch active wallet identity per node

Important distinction:

- Duglas addresses look EVM-like
- Duglas is not an Ethereum RPC chain

The address format is a usability choice, not a compatibility promise.

## Balance Model

The chain exposes both:

- confirmed balance
- available balance

Why both matter:

- confirmed balance comes from mined chain state
- available balance accounts for pending outgoing transactions in the mempool

This helps teach a real transaction lifecycle:

- user creates a transaction
- mempool reserves spendability
- block inclusion settles the final confirmed result

## Nonce Model

Each sender uses nonce sequencing to maintain valid transaction order.

This prevents several classes of inconsistent behavior:

- duplicate transaction ordering
- accidental replay in the local mempool context
- conflicting pending sender actions

The next nonce is surfaced by both API and CLI so users can reason about sender state.

## Mempool Model

The mempool is not just a temporary array of transactions.
It is one of the most important teaching surfaces in the project.

Current mempool behavior includes:

- transaction validation before admission
- nonce-aware sender ordering
- balance-aware checks
- fee-aware replacement behavior
- anti-spam limits for data transactions
- payload-size-based fee rules for data transactions

### Why this matters

Without mempool policy, a blockchain demo easily becomes unrealistic.
By treating the mempool as a real subsystem, Duglas becomes much more useful as a learning project.

## Receipt Model

Every transaction can be inspected through a receipt lifecycle.

A receipt can describe:

- pending state
- confirmed block inclusion
- settlement details
- effective debit and credit
- block height and block hash

This is especially valuable because it gives a user-facing trace of:

- accepted but unmined work
- final block confirmation

## Mining and Rewards

Mining does two things:

- confirms pending transactions
- creates block rewards for the miner

The reward model includes:

- base reward
- fee collection
- halving behavior

This gives Duglas an internal token issuance mechanism suitable for a local educational chain.

## Persistence Model

Duglas persists local state to disk.

This includes chain-related runtime state so that:

- restarting the node does not wipe progress
- a local testnet feels like an actual evolving chain
- users can inspect continuing block history over time

This is why blocks still exist after:

- `Ctrl+C`
- `npm start`
- `duglas testnet:down`

Resetting is an explicit action, not an accidental side effect.

## Networking Model

The P2P layer is implemented over WebSockets.

Responsibilities include:

- connect to peers
- exchange block and transaction data
- synchronize chain history
- propagate newly mined blocks
- propagate newly accepted transactions

This makes Duglas a networked blockchain runtime rather than a single-process toy.

## API Model

The HTTP API is an operator and automation surface.

It exposes:

- network identity
- node diagnostics
- balances
- blocks
- mempool
- state
- app-layer data
- wallet operations
- faucet operations
- transaction submission
- mining

The CLI is effectively a structured terminal client on top of this API.

## CLI Model

The CLI is one of the project's strongest product features.

It acts as:

- a terminal explorer
- an operator tool
- a learning interface
- a release-distributed binary via the `duglas` command

This is important architecturally because it means Duglas is not only a codebase.
It is also a usable developer-facing product.

## State Layer Design

The state layer is derived, not free-floating.

That means:

- the chain stores signed transactions
- confirmed state is recomputed from accepted confirmed actions
- pending state is simulated from mempool contents
- history can be traced back to specific transactions

This gives the system several strong properties:

- deterministic reconstruction
- inspectable provenance
- no silent hidden writes
- clear distinction between pending and confirmed state

## Formal Action Envelope

The recommended structured payload form is:

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

Why this matters:

- it separates app identity from raw payload encoding
- it allows policy validation
- it makes future execution routing cleaner
- it supports a stable tooling contract for CLI and HTTP clients

The `action-policies` endpoint and CLI command expose the currently supported action surface.

## App Layer Design

The current apps are deliberately small:

- `counter`
- `registry`
- `profile`
- `todo`
- `notes`

They are not the final product.
They are architectural proof.

What they prove:

- the chain can carry typed application intents
- state keys can be deterministic and namespaced
- reads can be built over derived state
- pending and confirmed application views can coexist
- the project can evolve beyond pure value transfers

## Why This Is Not Yet a Smart-Contract Platform

Duglas does not yet have:

- arbitrary user-deployed logic
- bytecode
- gas accounting
- execution traces
- a VM

So today it should be thought of as:

`blockchain runtime + deterministic state engine + fixed app modules`

Not:

`general-purpose contract platform`

## What Makes the Current Project Serious

Even before a VM exists, Duglas already teaches and demonstrates:

- chain persistence
- PoW mining
- P2P synchronization
- wallet identity
- signed transactions
- nonce ordering
- receipts
- mempool policy
- deterministic state derivation
- operator UX through CLI and HTTP tooling

That is already much more meaningful than a fake demo with hardcoded balances or pre-scripted outputs.

## Current Scope Boundary

The chain is real in the sense that it really runs.
The chain is limited in the sense that it is still a testnet.

It is honest to describe Duglas as:

`a real custom blockchain testnet and developer/operator learning platform`

## Next Natural Architectural Step

Once the current testnet layer feels complete, the next phase can be an execution layer.

That could eventually include:

- richer payload schemas
- account-owned state partitions
- deployment-like actions
- isolated module execution rules
- contract-like semantics

But the correct order is:

1. finish the custom chain and operator platform
2. harden docs, flows, packaging, and testnet UX
3. then build execution features on top

For practical usage flows, continue with:

- [Quickstart](./quickstart.md)
- [CLI Guide](./cli.md)
- [User Flows](./user-flows.md)
