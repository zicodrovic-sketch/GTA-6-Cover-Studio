# Cover Studio — GTA 6 Cover Art Maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/zicodrovic-sketch/GTA-6-Cover-Studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/zicodrovic-sketch/GTA-6-Cover-Studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Cover Studio turns a photo and a caption into GTA 6-style cover art: a
multi-panel poster layout with bold lettering over a sunset-and-neon
Vice City look. Pick a photo (or one of the built-in samples), type a
caption, arrange the panels, and export a print-ready PNG.

Everything runs offline in the browser — no account, no upload, no
network. Export sizes:

- 1080 × 1080 (square)
- 1080 × 1350 (portrait)
- 1920 × 1080 (landscape)

## Run it

Requires Node.js 22 or newer. No install step and no dependencies.

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser.

## How the entry is handed in

`main.ts` (Node standard library only) copies `app/` and `screenshots/`
into the output directory (`MAKEFUN_OUTPUT_DIR`, default `/output`) and
writes `dossier.json` there with the vendored make.fun kit library:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/cover-out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
