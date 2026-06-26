<p align="center">

  <img src="https://img.shields.io/badge/Node.js-20+-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white">

  <img src="https://img.shields.io/badge/Consensus-Proof--of--Work-6F42C1?style=for-the-badge">

  <img src="https://img.shields.io/badge/P2P-Network-8A2BE2?style=for-the-badge">

  <img src="https://img.shields.io/badge/HTTP-API-9146FF?style=for-the-badge">

  <img src="https://img.shields.io/badge/CLI-Terminal-7C3AED?style=for-the-badge">

</p>

<p align="center">

  <img src="https://img.shields.io/github/license/Tenyokj/duglas-testnet?style=flat-square">

  <img src="https://img.shields.io/github/stars/Tenyokj/duglas-testnet?style=flat-square">

  <img src="https://img.shields.io/github/issues/Tenyokj/duglas-testnet?style=flat-square">

  <img src="https://img.shields.io/github/last-commit/Tenyokj/duglas-testnet?style=flat-square">

</p>

<p align="center">
  <!-- Logo -->
  <img src="./docs/assets/duglas-logo.png" alt="Duglas Testnet" width="380">
</p>

---

# Duglas Testnet

Duglas Testnet is a learning-oriented blockchain testnet built in Node.js.
It is designed to help you understand how a blockchain works from the inside by running your own small network with real chain mechanics:

- Proof-of-Work block production
- signed transactions and fees
- mempool validation and replacement rules
- wallet creation, import, export, and switching
- P2P block and transaction propagation
- persistent node state
- a terminal explorer and CLI operator toolkit
- an HTTP API
- a confirmed key-value state layer
- app-like modules built on top of signed payload transactions

This project is not a mainnet and not real money.
It is a realistic custom testnet with test coins, real signatures, real mining, real balances, and real node synchronization.

## What This Project Is

Duglas is a custom blockchain runtime.
It is not an Ethereum fork, not a Hardhat wrapper, and not a JSON-RPC clone.

The project goal is:

`build a serious educational blockchain testnet with a node runtime, wallet toolkit, CLI explorer, mempool, mining, P2P sync, state layer, and app-layer transactions`

That makes it useful for:

- learning blockchain internals
- portfolio and demo work
- experimenting with fees, mining, wallets, and P2P sync
- building a future execution layer on top of a custom chain
- understanding the difference between a blockchain runtime and an application layer

## Current Network Identity

- Network name: `Duglas Testnet`
- Symbol: `DUG`
- Decimals: `4`
- Chain ID: `180322`
- Protocol version: `1`
- Block version: `1`
- Consensus: `pow-sha256`
- Address format: `evm-like-0x`
- Genesis model: deterministic custom genesis

Notes:

- addresses are Ethereum-like checksum `0x...` addresses
- private keys can be recognized by EVM tooling because the chain also uses `secp256k1`
- mnemonic wallets currently use the project-specific `custom-v1` format, not BIP39
- MetaMask can import the private key format, but Duglas is not an Ethereum-compatible RPC chain

## Repository Layout

The project now uses a cleaner product-style structure:

```text
bin/
  duglas.js           CLI entrypoint
src/
  core/               blockchain, wallet, transaction, storage, rate limiting
  network/            P2P networking
  node/               HTTP node runtime
scripts/
  reset_state.js      local reset utility
  smoke_cli.js        CLI smoke test
  attack.js           learning/demo script
tests/                automated tests
docs/                 user and operator documentation
```

This keeps runtime code, CLI code, helper scripts, and tests separated instead of mixing everything in the repository root.

## What Exists Today

- PoW mining with adjustable difficulty
- signed transactions with sender nonces
- transaction receipts with pending and confirmed lifecycle states
- fee-aware mempool prioritization
- sender-level anti-spam controls for data transactions
- fee floor and payload-size fee rules for data transactions
- confirmed key-value state derived from payload transactions
- pending state preview before mining
- app-layer modules for `counter`, `registry`, `profile`, `todo`, and `notes`
- P2P block and transaction propagation
- node sync diagnostics
- faucet support for local testing
- persistent chain state on disk
- terminal explorer style CLI
- HTTP API for automation and external tooling
- Docker-based 3-node local testnet
- automated unit tests and a CLI smoke test

## What It Is Not Yet

Today Duglas does not include:

- smart contracts
- a VM
- gas metering
- bytecode deployment
- Ethereum JSON-RPC compatibility
- MetaMask-native RPC support
- public validator economics
- market-priced assets

That is intentional.
The project is currently focused on being a strong custom blockchain testnet first.

## Why It Is Still Real

The chain is educational, but the mechanics are genuine:

- transactions are really signed
- blocks are really mined
- balances really come from chain history
- nonces really enforce transaction ordering
- receipts really track pending versus confirmed state
- multiple nodes really synchronize over P2P
- local node state really persists between restarts

The right mental model is:

`a real custom blockchain testnet with educational scope`

## Installation Modes

There are three good ways to use Duglas.

### 1. Run from the repository

Use this when you want to develop, inspect the code, or contribute.

```bash
git clone <your-repo-url>
cd blockchainJS
npm install
npm run start:node1
```

Then open another terminal:

```bash
npm run cli -- help
npm run cli -- overview
```

### 2. Link the CLI locally as `duglas`

Use this when you are developing locally but want the production-style command name.

```bash
npm install
npm link
duglas help
duglas overview
```

`npm link` registers the package `bin` entry globally on your machine, so `bin/duglas.js` becomes the `duglas` command.

### 3. Install it as an npm package

Use this when the package has been published and you want normal end-user installation.

```bash
npm install -g duglas-testnet
duglas help
```

Or use it without a permanent install:

```bash
npx duglas-testnet help
```

## First Run

The fastest useful first-run flow looks like this.

### Start one node

```bash
npm install
npm run start:node1
```

This starts:

- HTTP API on `http://localhost:3001`
- P2P node on `ws://localhost:6001`

### Open the terminal explorer

In a second terminal:

```bash
npm run cli -- overview
```

Or, if the package is linked:

```bash
duglas overview
```

### Fund the active wallet

```bash
duglas faucet
duglas balance
duglas wallet-save-name alice
```

### Create another wallet

```bash
duglas wallet-seed-new bob
duglas wallet-list
```

### Switch back to the funded wallet

```bash
duglas wallet-switch alice
```

### Send and confirm a transaction

```bash
duglas send 0xBOB_ADDRESS 10 1
duglas receipt TX_ID
duglas mine
duglas receipt TX_ID
duglas wallet-switch bob
duglas balance
```

That is the core Duglas flow:

`fund -> send -> inspect -> mine -> confirm`

## Local Testnet

To boot a 3-node local testnet with Docker:

```bash
duglas testnet:up
```

Available nodes:

- `http://localhost:3001`
- `http://localhost:3002`
- `http://localhost:3003`

Stop the testnet:

```bash
duglas testnet:down
```

Reset the Docker testnet completely, including persistent Docker volumes:

```bash
duglas testnet:reset
```

## Local State Reset

Duglas persists node state so the chain survives restarts.
That is why blocks remain after `Ctrl+C` or `duglas testnet:down`.

Reset options:

- reset local chain state only:

```bash
duglas reset:state
```

- reset local chain state and local wallet files:

```bash
duglas reset:local
```

- reset Docker testnet volumes:

```bash
duglas testnet:reset
```

## Typical User Flows

### Flow 1: Explore the network

```bash
duglas overview
duglas stats
duglas network
duglas peers
duglas blocks
duglas mempool
```

### Flow 2: Use wallets

```bash
duglas wallet
duglas wallet-list
duglas wallet-save-name alice
duglas wallet-seed-new bob
duglas wallet-switch bob
duglas wallet-export
```

### Flow 3: Send coins

```bash
duglas faucet
duglas send 0xRECEIVER 10 1
duglas tx TX_ID
duglas receipt TX_ID
duglas mine
```

### Flow 4: Inspect history

```bash
duglas activity 0xADDRESS
duglas block BLOCK_HASH
duglas blocks-full
```

### Flow 5: Use the state layer

```bash
duglas send-action 0xADDRESS kv set '{"key":"greeting","value":"hello"}' 1
duglas state-pending
duglas state-get-pending greeting
duglas mine
duglas state
duglas state-get greeting
duglas state-history greeting
```

### Flow 6: Use app-layer actions

```bash
duglas todo-create ship_mvp "Ship the Duglas MVP" 1
duglas note-set roadmap "Ship state layer and notes app" 1
duglas profile-set "Daniil" "Building Duglas Testnet" 1
duglas registry-set duglas "https://testnet.duglas.local" 1
duglas counter-create score 10 1
duglas mine
```

These app commands are not random extras.
They prove that Duglas can carry structured application actions on top of the chain and derive deterministic state from them.

## State Layer

Duglas includes a confirmed key-value state layer derived from `data` transactions.

Supported low-level operations:

- `kv:set`
- `kv:delete`
- `kv:increment`

You can submit them in two forms.

### Raw payload form

```bash
duglas send-data 0xADDRESS '{"op":"kv:set","key":"greeting","value":"hello"}' 1
```

### Formal action form

```bash
duglas send-action 0xADDRESS kv set '{"key":"greeting","value":"hello"}' 1
```

`send-action` is the recommended format for new features because it uses the formal envelope:

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

Useful state inspection commands:

```bash
duglas state
duglas state-pending
duglas state-get greeting
duglas state-get-pending greeting
duglas state-history greeting
duglas action-policies
```

## App Layer

Duglas currently exposes five minimal application-style modules:

- `counter`
- `registry`
- `profile`
- `todo`
- `notes`

They serve two purposes:

- they make the state layer concrete and testable
- they establish the architectural path toward a future execution layer

The chain stores signed transactions.
The state layer derives deterministic state from their payloads.
The app layer defines domain-specific semantics on top of that state.

That separation is one of the most important design ideas in the project.

## CLI Packaging

The package is already configured with:

- npm package name: `duglas-testnet`
- executable command: `duglas`

That mapping comes from:

```json
"bin": {
  "duglas": "./bin/duglas.js"
}
```

So after installation, users do not need to run `npm run cli -- ...`.
They can use:

```bash
duglas help
duglas overview
duglas send 0xADDRESS 10 1
```

## How the npm Package Works

The npm package is meant to distribute the runtime and operator tooling:

- CLI
- node runtime
- wallet tooling
- Docker files
- docs

It is not meant to distribute your private local state.

The package publish boundary is controlled by the `files` field in `package.json`.
That means only the selected runtime files are shipped in the published package.

Before publishing, preview the package contents:

```bash
npm run pack:preview
```

This runs:

```bash
npm pack --dry-run
```

That is the safest way to verify exactly what npm will publish.

## What Goes to Git and What Goes to npm

Short version:

- Git repository: source of truth for development
- npm package: installable runtime for users

### Push to the Git repository

Push:

- source folders such as `src/core/`, `src/network/`, `src/node/`, `bin/`, and `scripts/`
- tests
- docs
- `package.json` and `package-lock.json`
- `Dockerfile` and `docker-compose.yml`
- `LICENSE`

Do not push:

- `state-*.json`
- `wallet-*.json`
- `wallets-*`
- `tmp-*.json`
- `node_modules`
- generated `.tgz` package files
- personal backup wallets or exported private keys

### Publish in the npm package

Publish only the files needed for users to run Duglas:

- CLI/runtime source files
- reset scripts
- docs
- Docker files
- `README.md`
- `LICENSE`

Do not publish:

- local chain state
- local wallet state
- temporary JSON artifacts
- development-only scratch files
- accidental private exports

See [Publishing Guide](./docs/publishing.md) and [Repository Guide](./docs/repository-guide.md) for the exact workflow.

## Release Workflow

A clean local release routine looks like this:

```bash
npm test
npm run smoke:cli
npm run pack:preview
```

If that looks good:

```bash
npm version patch
npm publish --access public
```

If you are not logged in yet:

```bash
npm login
npm whoami
```

## Documentation Map

- [Quickstart](./docs/quickstart.md)
- [CLI Guide](./docs/cli.md)
- [HTTP API](./docs/http-api.md)
- [Architecture](./docs/architecture.md)
- [Publishing Guide](./docs/publishing.md)
- [User Flows](./docs/user-flows.md)
- [Repository Guide](./docs/repository-guide.md)

## Tests

Run the automated test suite:

```bash
npm test
```

Run the CLI smoke test:

```bash
npm run smoke:cli
```

## Honest Scope Boundary

Duglas Testnet is already meaningful and serious, but the project goal is not:

`replace Ethereum`

The project goal is:

`build a strong custom blockchain testnet and operator platform that teaches real blockchain internals and supports future higher-level execution features`

That means the right end state for this phase is:

- solid CLI
- solid docs
- solid HTTP API
- stable node/testnet flows
- deterministic state layer
- app-layer transaction model
- clean package and release workflow

Once that base feels complete, the next phase can be an execution layer or richer platform semantics on top of the chain.
