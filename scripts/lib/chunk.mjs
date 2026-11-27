/** Pure document loading and chunking for the RAG indexer. No network, no env. */
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";

const DOC_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);
const CHUNK_SIZE = 1000;
const SPLITTERS = ["\n\n", "\n", /(?<=[.?!])\s+/, " "];

export const DOC_GLOB = [...DOC_EXTENSIONS].join("/");

export async function* walk(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (DOC_EXTENSIONS.has(extname(entry.name).toLowerCase())) yield path;
  }
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { body: raw, title: undefined };
  const title = match[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  return { body: raw.slice(match[0].length), title };
}

/** Split at #..#### headings (outside code fences), tracking the heading path. */
function splitSections(body) {
  const sections = [];
  const path = [];
  let firstH1;
  let lines = [];
  let inFence = false;

  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) sections.push({ heading: path.filter(Boolean).join(" > "), text });
    lines = [];
  };

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = inFence ? null : line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      path.length = level - 1;
      path[level - 1] = heading[2];
      if (level === 1) firstH1 ??= heading[2];
    } else {
      lines.push(line);
    }
  }
  flush();
  return { sections, firstH1 };
}

/** Pack `text` into pieces of at most `max` chars, splitting on the coarsest boundary that fits. */
function pack(text, max = CHUNK_SIZE, splitters = SPLITTERS) {
  if (text.length <= max) return [text];
  if (!splitters.length) {
    return Array.from({ length: Math.ceil(text.length / max) }, (_, i) =>
      text.slice(i * max, (i + 1) * max),
    );
  }
  const [splitter, ...finer] = splitters;
  const joiner = typeof splitter === "string" ? splitter : " ";
  const pieces = [];
  let current = "";
  for (const part of text.split(splitter)) {
    if (part.length > max) {
      if (current) pieces.push(current);
      current = "";
      pieces.push(...pack(part, max, finer));
    } else if (current && current.length + joiner.length + part.length > max) {
      pieces.push(current);
      current = part;
    } else {
      current = current ? current + joiner + part : part;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Document id is its path under `dir` without the extension; `#` is reserved for chunk ids. */
export function docId(dir, file) {
  const id = relative(dir, file).split(sep).join("/").replace(/\.[^.]+$/, "");
  if (id.includes("#")) throw new Error(`"#" is reserved in document ids: ${file}`);
  return id;
}

export async function loadAndChunk(dir, file) {
  const id = docId(dir, file);
  const { body, title: frontmatterTitle } = parseFrontmatter(await readFile(file, "utf8"));
  const { sections, firstH1 } = splitSections(body);
  const title = frontmatterTitle ?? firstH1 ?? basename(file, extname(file));

  const chunks = sections
    .flatMap(({ heading, text }) =>
      pack(text)
        .map((piece) => piece.trim())
        .filter(Boolean)
        .map((piece) => ({ heading, text: piece })),
    )
    .map((chunk, chunkIndex) => ({
      ...chunk,
      id: `${id}#${chunkIndex}`,
      chunkIndex,
      embedInput: chunk.heading ? `${chunk.heading}\n\n${chunk.text}` : chunk.text,
    }));
  return { id, title, chunks };
}

/** Load every document under `dir`. Throws on none or on two files mapping to one id. */
export async function loadCorpus(dir) {
  const files = [];
  for await (const file of walk(dir)) files.push(file);
  files.sort();
  if (!files.length) throw new Error(`No ${DOC_GLOB} files in ${dir}`);

  const docs = await Promise.all(files.map((file) => loadAndChunk(dir, file)));
  const seen = new Set();
  for (const { id } of docs) {
    if (seen.has(id)) throw new Error(`Two documents share the id "${id}"`);
    seen.add(id);
  }
  return docs;
}
