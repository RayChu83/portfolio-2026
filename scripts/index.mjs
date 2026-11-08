/**
 * Offline RAG indexer: documents -> chunks -> embeddings -> Upstash Vector.
 *
 * Usage: npm run index -- [dir] [--dry-run]
 *   dir        documents directory, relative to cwd (default ./knowledge)
 *   --dry-run  load and chunk only; no API calls, no env vars required
 *
 * `dir` is the whole corpus. Re-runs converge: every chunk is embedded first,
 * then upserted, then any vector not in the corpus (shrunken or deleted
 * documents) is removed. An embedding failure leaves the index untouched.
 */
import { resolve } from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { Index } from "@upstash/vector";
import { embedMany } from "ai";
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from "../src/lib/rag/config.ts";
import { loadCorpus } from "./lib/chunk.mjs";

const UPSERT_BATCH = 100;
const RANGE_PAGE = 1000;
const REQUIRED_ENV = ["OPENAI_API_KEY", "UPSTASH_VECTOR_REST_URL", "UPSTASH_VECTOR_REST_TOKEN"];

const args = process.argv.slice(2);
const dir = resolve(process.cwd(), args.find((a) => !a.startsWith("--")) ?? "rag");
const dryRun = args.includes("--dry-run");

function printDryRun(docs) {
  for (const doc of docs) {
    console.log(`${doc.id}  (${doc.chunks.length} chunks)`);
    for (const c of doc.chunks) {
      const preview = c.text.replace(/\s+/g, " ").slice(0, 70);
      console.log(`  #${c.chunkIndex} [${c.heading || "-"}] ${c.text.length}ch  ${preview}`);
    }
  }
  const chars = docs.flatMap((d) => d.chunks).reduce((n, c) => n + c.embedInput.length, 0);
  const total = docs.reduce((n, d) => n + d.chunks.length, 0);
  console.log(`\nDry run: ${docs.length} files, ${total} chunks, ~${Math.ceil(chars / 4)} tokens`);
}

async function deleteStale(index, keep) {
  let cursor = "0";
  let removed = 0;
  do {
    const page = await index.range({ cursor, limit: RANGE_PAGE });
    const stale = page.vectors.map((v) => String(v.id)).filter((id) => !keep.has(id));
    if (stale.length) await index.delete(stale);
    removed += stale.length;
    cursor = page.nextCursor;
  } while (cursor);
  return removed;
}

async function main() {
  const started = Date.now();
  const docs = await loadCorpus(dir);
  if (dryRun) return printDryRun(docs);

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);

  const chunks = docs.flatMap((doc) => doc.chunks.map((chunk) => ({ doc, chunk })));
  if (!chunks.length) throw new Error(`No chunks produced from ${dir}`);

  const index = new Index();
  const info = await index.info();
  if (info.dimension !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Index dimension is ${info.dimension}, but ${EMBEDDING_MODEL} produces ${EMBEDDING_DIMENSION}`,
    );
  }

  const { embeddings } = await embedMany({
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).embedding(EMBEDDING_MODEL),
    values: chunks.map(({ chunk }) => chunk.embedInput),
    maxParallelCalls: 2,
  });

  const records = chunks.map(({ doc, chunk }, i) => ({
    id: chunk.id,
    vector: embeddings[i],
    metadata: {
      source: doc.id,
      title: doc.title,
      heading: chunk.heading,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
    },
  }));
  for (let i = 0; i < records.length; i += UPSERT_BATCH) {
    await index.upsert(records.slice(i, i + UPSERT_BATCH));
  }
  const removed = await deleteStale(index, new Set(records.map((r) => r.id)));

  console.log(
    `Done: ${docs.length} files, ${records.length} vectors upserted, ${removed} stale removed, ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
