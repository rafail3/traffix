# Traffix

Count the cars you pass, brand by brand. Tap a brand and its number goes up; save the game and see it later in your history. The brand list learns from your saved games, so the brands you see most move to the top.

- Web: https://traffix-rafa.vercel.app
- Android: [latest APK](https://github.com/rafail3/traffix/releases/latest/download/traffix.apk) (Android 7+)

Everything stays on your device; there are no accounts yet.

## Development

Requires Node 24+.

```bash
npm ci
npm run dev   # http://localhost:3000
npm test      # ranking tests
```

The Android app is the same web app packaged with Capacitor (`android/`). CI builds it on every pull request; release builds are signed in CI only.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).
