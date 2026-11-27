# Contributing

Fork the repo, make your change on a branch, open a pull request with a Conventional Commits title. The rest of this page is the detail.

## Setup

```bash
git clone https://github.com/<your-user>/traffix.git
cd traffix
npm ci
npm run dev
```

Node 24 or newer. You don't need Android Studio: CI builds the Android app on every pull request.

## Making a change

Branch off `main` (`git switch -c fix/history-sorting`, for example) and keep each pull request to one thing. If you touch the logic in `lib/`, add or update the test next to it.

Before pushing:

```bash
npx tsc --noEmit
npm test
npm run build
```

## Pull request titles

We squash-merge, so the title of your pull request becomes the commit on `main`, and the release tooling reads it to decide the next version. Write it in English, following [Conventional Commits](https://www.conventionalcommits.org/):

| Title | Result |
| --- | --- |
| `fix: keep counts after reload` | patch release, new APK |
| `feat: search in the brand list` | minor release, new APK |
| `feat(web): stats card on laptop` | minor release, the APK stays the same |
| `docs: …`, `ci: …`, `chore: …`, `test: …`, `build: …` | no release |
| `feat!: …` | major release |

> [!TIP]
> The `web` scope is for things that only exist on the website, like the side panels on wide screens or the site menu. If you're not sure, leave it out. Without it the APK is simply rebuilt.

A pull request can be merged once these checks pass: **Types, tests, build**, **Android debug build** and **Conventional Commit title**.

## Secrets

> [!IMPORTANT]
> The repository is public. Don't commit `.env` files, keys, keystores, tokens or passwords, and don't paste them into issues or pull requests either. The release key exists only as a GitHub secret.

## Issues

Bugs and ideas go in [issues](https://github.com/rafail3/traffix/issues/new/choose). Security problems don't; see [SECURITY.md](SECURITY.md).

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
