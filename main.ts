// Archipelago Airmail — the hand-in program (Node 22, standard library only).
// It copies this repository's game/ and screenshots/ into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library, exactly as the competition's rules require. Run it twice and the
// bytes must match; outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyClean(source, target) {
  if (!existsSync(source)) return;
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  copyClean(join(repoRoot, 'game'), join(outputDir, 'game'));
  copyClean(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

  // The scorer's own caps (from the kit's reference/gate.json): only
  // text_max_bytes shapes the dossier bytes; the rest refuse an entry the
  // scorer would refuse — more than 4 screenshots or one over 256 KiB, more
  // than 993 files in game/ or 48 MiB of game files in all, or a path under
  // game/ over 1000 bytes.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
