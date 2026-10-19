// UI literal check: views must use design-token roles (bg-card, text-muted-foreground, ...), not palette classes,
// raw colors or arbitrary pixel/rem values. src/components/ui/ (shadcn) is the only place allowed to hold them.
// Zero dependencies on purpose; `npm run lint` runs it after eslint.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGETS = [
  { dir: "src/pages", exts: [".astro"] },
  { dir: "src/components", exts: [".astro", ".tsx"] },
];
const EXCLUDED = [path.join("src", "components", "ui") + path.sep];
const LITERAL =
  /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/g;

const files = TARGETS.flatMap(({ dir, exts }) =>
  readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && exts.includes(path.extname(entry.name)))
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath, entry.name)))
    .filter((file) => !EXCLUDED.some((prefix) => file.startsWith(prefix))),
);

let hits = 0;
for (const file of files) {
  readFileSync(path.join(ROOT, file), "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const match of line.matchAll(LITERAL)) {
        hits += 1;
        console.error(`${file}:${index + 1}: ${match[0]}`);
      }
    });
}

if (hits > 0) {
  console.error(`check-ui-literals: ${hits} hit(s) — use token roles from src/styles/global.css instead`);
  process.exit(1);
}
console.log(`check-ui-literals: 0 hits in ${files.length} files`);
