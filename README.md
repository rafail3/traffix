<div align="center">

<img src="docs/brand/traffix-logo.svg" alt="" width="112" height="112">

# Traffix

A small game for car trips: count the cars you see, by brand.

[![CI](https://github.com/rafail3/traffix/actions/workflows/ci.yml/badge.svg)](https://github.com/rafail3/traffix/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/rafail3/traffix?label=release&color=1d3f9a)](https://github.com/rafail3/traffix/releases/latest)
[![Android 7+](https://img.shields.io/badge/android-7%2B-1d3f9a?logo=android&logoColor=white)](https://github.com/rafail3/traffix/releases/latest/download/traffix.apk)

[**Web app**](https://traffix-rafa.vercel.app) · [**Android APK**](https://github.com/rafail3/traffix/releases/latest/download/traffix.apk) · [Contributing](CONTRIBUTING.md)

<br>

<img src="docs/screens/desktop.png" alt="Traffix on a laptop, with the Android download card on the right" width="72%">
&nbsp;
<img src="docs/screens/phone.png" alt="Traffix on a phone" width="24.6%">

</div>

<br>

## About

You start with the car brands you see most often in Romania and the rest of Europe. Every time one drives by, you tap it. When the trip is over you save the game, give it a name if you want, and it goes into your history.

After a few saved games the list starts in a different order: the brands you see most on your routes move up. Nothing gets removed, and you can still add, delete or drag brands around yourself.

There are no accounts for now. Everything is kept on your device, and the Android app works offline.

## Running it locally

You need Node 26 or newer.

```bash
npm ci
npm run dev      # http://localhost:3000
npm test
```

## Under the hood

Next.js and React, with plain CSS. The Android app is the same build wrapped with [Capacitor](https://capacitorjs.com), so there is only one codebase. The ordering of the list lives in `lib/rank.ts` (a Bradley–Terry style model where recent games count more) and has tests next to it.

Releases are automatic: [semantic-release](https://semantic-release.gitbook.io) reads the pull request titles merged into `main`, picks the next version and publishes it together with a signed APK.

```text
app/        screens and styles
lib/        brand list, ranking, storage
android/    Capacitor project
.github/    CI and release workflows
```

## Contributing

Pull requests are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). If you found a security problem, please don't open an issue; [SECURITY.md](SECURITY.md) explains how to report it.
