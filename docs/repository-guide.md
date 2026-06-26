# Repository Guide

This guide explains what belongs in the Git repository, what belongs in the npm package, and what should stay local only.

That distinction matters because Duglas is both:

- a development codebase
- an installable CLI product

Those two surfaces overlap, but they are not identical.

## Three Boundaries

Think in three layers:

1. Git repository
2. npm package
3. local machine state

## 1. Git Repository

The Git repository is the development source of truth.

It should contain:

- all runtime source files
- tests
- documentation
- package metadata
- Docker files
- license
- assets intentionally part of the project

In Duglas, that means pushing things like:

- `src/core/blockchain.js`
- `src/node/index.js`
- `bin/duglas.js`
- `src/core/transaction.js`
- `src/core/wallet.js`
- `src/network/p2p.js`
- `src/core/storage.js`
- `src/core/rate_limiter.js`
- `scripts/reset_state.js`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/*`
- `Dockerfile`
- `docker-compose.yml`
- `LICENSE`
- test files in `tests/`

Why push tests and docs:

- they are part of the quality boundary
- they explain intended behavior
- they protect releases

## 2. npm Package

The npm package is the runtime distribution boundary.

Its job is not to mirror the whole repo.
Its job is to give users what they need to install and run Duglas.

That means it should contain:

- CLI entrypoint
- node runtime files
- wallet and transaction logic
- docs useful to installed users
- Docker helpers if they are part of the product experience
- README and LICENSE

It should not contain:

- development-only scratch files
- local chain state
- local wallets
- temporary artifacts
- accidental secrets

In Duglas, the publish boundary is controlled by the `files` field in `package.json`.

That is the authoritative answer to:

`what goes into npm publish`

## 3. Local Machine State

These files should generally stay local only:

- `state-*.json`
- `wallet-*.json`
- `wallets-*`
- `tmp-*.json`
- generated `.tgz` files
- exported private keys
- mnemonic backups

These are:

- user-specific
- machine-specific
- secret or semi-secret
- not part of source control
- not part of published runtime distribution

## Current Ignore Rules

The project already ignores several local-only artifacts through `.gitignore`:

- `node_modules/`
- `.npm-cache/`
- `*.tgz`
- `state-*.json`
- `wallet-*.json`
- `wallets-*/`
- `tmp-*.json`

That is good and should remain.

## What You Should Push to Git

Push:

- all source files needed to build or understand Duglas
- all tests
- all docs
- release metadata
- Docker orchestration files
- assets that are part of the project

Do not push:

- local node state
- wallet exports
- temporary audit files
- private keys
- mnemonic phrases
- generated tarballs
- `node_modules`

## What You Should Publish to npm

Publish:

- CLI/runtime source files required for execution
- reset and utility runtime scripts required by the product
- documentation helpful to installed users
- Docker files if they are part of the supported product flow
- README and LICENSE

Do not publish:

- tests unless you intentionally want them inside the install artifact
- local state
- wallet files
- scratch artifacts
- unpublished secrets

## Why Repo and npm Boundaries Should Differ

A repository serves contributors.
An npm package serves users.

Contributors need:

- tests
- historical context
- internal docs
- architecture detail

Users need:

- a working command
- runtime files
- usage docs

That is why a clean package is usually smaller than the repo.

## Recommended Release Hygiene

Before publishing:

1. run tests
2. run the CLI smoke test
3. run `npm run pack:preview`
4. inspect the file list carefully

Commands:

```bash
npm test
npm run smoke:cli
npm run pack:preview
```

If the preview includes something suspicious, fix the `files` field before publishing.

## Practical Duglas Rule Set

If you want a very direct answer:

### Push to the repo

Push everything that defines the project:

- source
- docs
- tests
- package metadata
- Docker setup

### Publish to npm

Publish only what a user needs to install and run `duglas`.

### Keep local only

Keep anything stateful, temporary, or secret off both Git and npm.

## Example Release Mindset

Good question to ask before every publish:

`If someone installs this from npm on a clean machine, do they get exactly the runtime experience I intend, and nothing private or accidental?`

If the answer is yes, the package boundary is probably healthy.

For the exact publishing commands, continue with:

- [Publishing Guide](./publishing.md)
