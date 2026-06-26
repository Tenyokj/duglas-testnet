# Publishing Guide

This guide explains how to turn Duglas into a proper npm-distributed CLI package and how users consume it after publication.

## Publishing Goal

The packaging goal is:

- users install the project from npm
- the `duglas` command becomes available
- only runtime files are shipped
- local development artifacts never leak into the package

That is already wired through `package.json`:

```json
"name": "duglas-testnet",
"bin": {
  "duglas": "./bin/duglas.js"
}
```

The important consequence is:

- npm package name: `duglas-testnet`
- terminal command after install: `duglas`

Those are intentionally different.

## How Users Will Use the Package

### Global install

This is the normal end-user path.

```bash
npm install -g duglas-testnet
duglas help
duglas overview
```

### One-off execution with `npx`

This is useful if the user does not want a permanent global install.

```bash
npx duglas-testnet help
npx duglas-testnet overview
```

### Local development with `npm link`

This is useful while building the project from the repository.

```bash
npm install
npm link
duglas help
```

`npm link` uses the same `bin` entry but points it at your local working copy.

## What the Package Should Contain

The package should contain only what users need to run Duglas as a product:

- CLI entrypoint
- node runtime
- transaction, wallet, storage, and networking logic
- docs
- Docker helpers
- README and LICENSE

That boundary is controlled by the `files` field in `package.json`.

Current publish list:

- `bin/`
- `src/`
- `scripts/reset_state.js`
- `README.md`
- `docs`
- `LICENSE`
- `Dockerfile`
- `docker-compose.yml`

## What Should Not Be Published

Never publish:

- `state-*.json`
- `wallet-*.json`
- `wallets-*`
- `tmp-*.json`
- `node_modules`
- generated `.tgz` tarballs
- exported secret wallet material
- ad hoc audit files
- development-only scratch scripts unless intentionally part of the runtime

## Pre-Publish Checklist

Before every release:

```bash
npm test
npm run smoke:cli
npm run pack:preview
```

What each step does:

- `npm test`: validates unit and integration-style test coverage
- `npm run smoke:cli`: validates common CLI flows
- `npm run pack:preview`: shows exactly what npm would publish

## Inspect the Package Before Publishing

Run:

```bash
npm run pack:preview
```

That executes:

```bash
npm pack --dry-run
```

Check that:

- the expected runtime files are present
- tests are not accidentally shipped
- local state files are not included
- no secrets or wallet exports are included

If you want the actual local tarball:

```bash
npm pack
```

This produces a `.tgz` file you can install locally for final verification.

## Test the Packed Artifact Locally

One useful release rehearsal is:

```bash
npm pack
npm install -g ./duglas-testnet-1.0.0.tgz
duglas help
duglas overview
```

After testing, remove the temporary tarball if you do not want it lying around.

## npm Account Preparation

Before publishing publicly, make sure you are logged in:

```bash
npm login
npm whoami
```

Also confirm that the package name is available if this is the first publication.

## Versioning

Use semantic versioning.

Typical flows:

```bash
npm version patch
npm version minor
npm version major
```

Recommended interpretation:

- `patch`: docs, fixes, polish, small backward-compatible improvements
- `minor`: new commands, new API surfaces, new state/app features
- `major`: breaking CLI/API changes or architectural repackaging

## Publish Command

When ready:

```bash
npm publish --access public
```

Use `--access public` for a public scoped or first-time package publication where needed.

## Suggested Release Flow

This is a strong default release sequence:

1. update code and docs
2. run tests
3. run smoke checks
4. run `npm run pack:preview`
5. bump the version
6. publish
7. verify `npx duglas-testnet help`

Concrete example:

```bash
npm test
npm run smoke:cli
npm run pack:preview
npm version patch
npm publish --access public
npx duglas-testnet help
```

## Git Repository Versus npm Package

These are not the same thing.

### Git repository

Purpose:

- full development source of truth
- history
- tests
- architecture
- contribution surface

### npm package

Purpose:

- installable runtime
- CLI distribution
- end-user execution surface

That distinction is healthy.
The repo can contain development assets and history.
The npm package should be lean and intentional.

## Recommended Release Philosophy

Do not publish just because the CLI runs once.
Publish when all three are true:

- the commands feel stable
- the docs match the actual product
- the package boundary is clean

That is exactly the stage Duglas is moving toward.

## After Publishing

The two most important user-facing commands become:

```bash
npm install -g duglas-testnet
duglas help
```

And for no-install usage:

```bash
npx duglas-testnet overview
```

For repository rules and ignore boundaries, also read:

- [Repository Guide](./repository-guide.md)
