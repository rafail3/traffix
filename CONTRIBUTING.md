# Contributing to Traffix

Thanks for helping. This page is everything you need, in the order you need it.

## 1. Set up

```bash
git clone https://github.com/<you>/traffix.git   # your fork
cd traffix
npm ci
npm run dev
```

Node 24 or newer. Android Studio is optional: CI builds the Android app for every pull request.

## 2. Make the change

- Branch from `main`: `git switch -c feat/short-name`.
- Keep one idea per pull request; small ones get merged faster.
- New logic in `lib/` comes with a test next to it (`*.test.ts`).

## 3. Check before you push

```bash
npx tsc --noEmit
npm test
npm run build
```

## 4. Open the pull request

The **title** becomes the commit on `main` and decides the next version, so it follows [Conventional Commits](https://www.conventionalcommits.org/), in English:

| Title | What happens |
| --- | --- |
| `feat: add a brand search` | new minor version, new APK |
| `fix: keep counts after reload` | new patch version, new APK |
| `feat(web): add a stats card on laptop` | new version, **same APK** (website only) |
| `docs:`, `ci:`, `chore:`, `test:`, `build:` | no release |
| `feat!:` | new major version |

> [!TIP]
> Use the `web` scope only for things the Android app never shows, such as the laptop side panels or the website menu. When in doubt, leave the scope out: a missing scope only rebuilds the APK, it never ships a stale one.

`main` accepts changes only through pull requests, squash-merged, after these checks pass: **Types, tests, build**, **Android debug build** and **Conventional Commit title**.

## 5. Keep secrets out

> [!IMPORTANT]
> This repository is public. Never commit `.env` files, keys, keystores, tokens or passwords, and never paste them into an issue or pull request. Release signing happens only in CI, with keys stored as GitHub secrets.

## Reporting

- Bugs and ideas: [open an issue](https://github.com/rafail3/traffix/issues/new/choose).
- Security problems: report them privately, see [SECURITY.md](SECURITY.md).

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
