import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("dist/nodes/Nilyo", { recursive: true });
copyFileSync("nodes/Nilyo/nilyo.svg", "dist/nodes/Nilyo/nilyo.svg");
