// Cover Studio — entry packager for gta6-cover-art-01 (Node 22, standard library only).
//
// What this program does, in plain terms: it gathers the finished web app
// (the app/ folder beside this file) and its screenshots (screenshots/),
// places both into the hand-in directory, and writes dossier.json there —
// the machine-readable summary the make.fun scorer reads, produced by the
// vendored kit library so the scorer and this program agree byte for byte.
//
// The hand-in directory comes from MAKEFUN_OUTPUT_DIR and defaults to
// /output, the path the grader uses. Nothing here touches the network, and
// nothing depends on the time of day or on random values, so running it
// twice over the same repo produces byte-identical output.
//
// Run it locally with:
//   MAKEFUN_OUTPUT_DIR=/tmp/cover-out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Where this file lives on disk: the repository root, since main.ts sits
// at the root next to app/ and screenshots/.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The destination, from the environment when the grader (or a local run)
// sets it, otherwise the grader's standard hand-in path.
const handInDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The scorer's own caps for this bounty (its gate.json): only the text
// cap shapes the dossier's bytes; the rest make this program refuse an
// entry the scorer would refuse anyway — too many or too large
// screenshots, or an app/ too big in files, bytes, or path length.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
} as const;

// Fail loudly, before copying anything, when a folder this program is
// supposed to hand in is missing from the repo.
function requireFolder(name: string): string {
  const folder = join(repoRoot, name);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error(`main.ts: expected a ${name}/ folder beside main.ts, but found none`);
  }
  return folder;
}

// The app is not an app without its entry page: refuse early, with a
// plain message, instead of handing in a folder the scorer would reject.
function requireEntryPage(appDir: string): void {
  const page = join(appDir, 'index.html');
  if (!existsSync(page) || !statSync(page).isFile()) {
    throw new Error('main.ts: app/index.html is missing — the app needs its entry page');
  }
}

const appFolder = requireFolder('app');
const shotsFolder = requireFolder('screenshots');
requireEntryPage(appFolder);

// Mirror one repo folder into the hand-in directory, creating the
// destination first so the copy always has somewhere to land.
function mirrorFolder(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

mkdirSync(handInDir, { recursive: true });
mirrorFolder(appFolder, join(handInDir, 'app'));
mirrorFolder(shotsFolder, join(handInDir, 'screenshots'));

// Build the dossier from exactly what was just handed in, so the summary
// can never drift from the files beside it, and write it as raw bytes.
const dossierBytes = buildDossier(handInDir, dossierCaps);
writeFileSync(join(handInDir, 'dossier.json'), dossierBytes);

console.log(`Cover Studio handed in to ${handInDir} (${dossierBytes.length} bytes of dossier).`);
