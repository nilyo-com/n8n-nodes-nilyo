import { copyFileSync, mkdirSync } from "node:fs";
// The icon and the codex files are not emitted by tsc. n8n reads <Node>.node.json next to the
// compiled node: it is what fills the categories and the alias list the integrations directory
// searches on, so a missing codex means the listing has no categories and matches nothing but
// its own name.
mkdirSync("dist/nodes/Nilyo", { recursive: true });
for (const file of ["nilyo.svg", "Nilyo.node.json", "NilyoTrigger.node.json"]) {
  copyFileSync(`nodes/Nilyo/${file}`, `dist/nodes/Nilyo/${file}`);
}
