/**
 * Generates src/lib/rag/sections.generated.json: one { id, description } per
 * rag/ document, built from its frontmatter title and `## ` headings.
 *
 * Run by predev and prebuild, so the list is never edited by hand.
 * Run with: node scripts/generate-sections.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorpus } from "./lib/chunk.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "src/lib/rag/sections.generated.json");

const docs = await loadCorpus(resolve(root, "rag"));

const sections = docs.map(({ id, title, chunks }) => {
  const headings = [...new Set(chunks.map((c) => c.heading.split(" > ")[1]).filter(Boolean))];
  const description = headings.length ? `${title}. Covers: ${headings.join("; ")}.` : `${title}.`;
  return { id, description };
});

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(sections, null, 2)}\n`);
console.log(`Wrote ${sections.length} sections to ${OUT.replace(`${root}/`, "")}`);
