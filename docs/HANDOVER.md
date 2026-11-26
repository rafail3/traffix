# Handover: Numărătoare mașini → web app + APK

## Ce e proiectul
Contor de mărci auto: listă cu cele mai populare mărci din România. Fiecare rând are un număr în dreapta (pornește de la 0).
- Tap pe marcă: +1. Butonul „−” scade cu 1.
- Ultimul rând e un input: scrii o marcă, apeși Enter și se adaugă un rând nou, iar focusul trece pe noul input.
- Apăsare lungă (~380 ms) + drag: reordonezi rândurile (pointer events, auto-scroll la margini, vibrație scurtă).
- „Editează lista” (redenumire, ștergere, Enter inserează un rând sub cel curent), „Sortează după număr”, „Resetează” (cu confirmare la al doilea tap), total sus.
- Datele se salvează în localStorage, cheia `numaratoare-masini-v1`, format `[{ name, n }]`.

Codul actual e în `artifact-original.html`, din acest folder: un singur fișier HTML, cu CSS și JS vanilla, fără dependențe. Fonturi: Saira Condensed, Barlow și JetBrains Mono, de la Google Fonts. Are temă light și dark (`prefers-color-scheme` + `data-theme`).

## Ce vrea Rafail
1. **Nume nou** pentru app: simplu și profesionist (ceva în stilul „Number the cars”). Propune 4–5 variante și lasă-l să aleagă înainte să creezi repo-ul.
2. **Proiect în folderul ăsta** (`C:\My Folders\IT + Coding\<nume-app>`), cu `git init` și commituri curate.
3. **Repo GitHub** (public sau privat: întreabă-l) și push.
4. **Deploy pe Vercel.** Pe laptop are mai multe configurări Vercel (`~/.vercel-personal`, `~/.vercel-hartiromania`). Întreabă pe ce cont publică, probabil personal.
5. **Arată bine pe laptop și pe telefon.** Acum layout-ul e o coloană de max 560px: pe desktop trebuie gândit mai bine (de exemplu panou lateral cu total, statistici și acțiuni).
6. **APK Android** care se poate descărca de pe site (buton „Descarcă pentru Android” pe pagină, cu APK-ul servit din `/public` sau din GitHub Releases).
7. **Câteva îmbunătățiri.** Propune-le și confirmă cu el înainte să le implementezi.

## Recomandări tehnice
- Stack: Vite + vanilla JS/TS (sau React, dacă vrea). Păstrează logica existentă și împarte-o în module.
- PWA: manifest, service worker, iconițe. App-ul merge offline și se poate instala.
- APK: **Capacitor** (`@capacitor/android`), build cu Gradle (pe laptop există `~/.android` și `~/.gradle`, deci SDK-ul pare instalat). Alternativ, TWA cu Bubblewrap, care cere însă `assetlinks.json` pe domeniu. Capacitor e mai simplu și merge offline.
- Semnează APK-ul cu un keystore propriu. **Nu-l pune în git**: adaugă-l în `.gitignore`.
- Platforma e Windows: dă comenzi PowerShell sau cmd.

## Idei de îmbunătățiri de propus
- Export/import date (JSON, copiere în clipboard): necesar și ca să-și mute numerele din artifact pe noul domeniu, pentru că localStorage nu se transferă între domenii.
- Undo pentru ultima apăsare (toast „Anulează”).
- Mai multe sesiuni sau liste (de exemplu „Parcare Mall 26 nov”), cu istoric.
- Procente și bară de proporție pe fiecare rând, top 3 evidențiat.
- Logo-uri sau culori per marcă (doar nume și culori generice, fără logo-uri oficiale).
- Haptic feedback pe tap (Capacitor Haptics în APK).
- Mod „ecran mereu pornit” (Wake Lock) cât timp numără.

## Atenție
- Datele din artifact (claude.ai) rămân în browserul în care le-a numărat. Pentru migrare e nevoie de export/import, vezi mai sus.
- În `C:\My Folders\IT + Coding` există un `client_secret_*.json`. Să nu ajungă în niciun repo.
