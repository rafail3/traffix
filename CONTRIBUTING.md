# Contributing

Thanks for helping. A few rules keep `main` releasable at all times.

## Pull requests

- Branch from `main`, open a pull request; `main` accepts changes only through pull requests, squash-merged.
- The pull request title becomes the commit on `main`, so it must follow [Conventional Commits](https://www.conventionalcommits.org/) in English: `feat: …`, `fix: …`, `docs: …`, `ci: …`, `chore: …`.
- Versions are automatic: `feat` → minor, `fix`/`perf` → patch, `!` → major. Every release ships an Android APK.
- Changes that affect only the website and never the app (for example laptop side panels or the site menu) use the `web` scope: `feat(web): …`. Their release reuses the previous APK instead of building a new one. If unsure, leave the scope out.
- CI must pass: types, tests, build and the Android debug build.

## Before you push

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
```

## Never commit secrets

This repository is public. No `.env` files, keys, keystores, tokens or passwords, not even in examples or PR text. Release signing keys live only in GitHub Actions secrets.
