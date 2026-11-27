import { openai } from "@ai-sdk/openai";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import type { Retrieved } from "./answer.ts";
import { standaloneQuery } from "./condense.ts";
import { EMBEDDING_MODEL, MIN_SCORE, TOP_K, type ChunkMetadata, type Exchange } from "./config.ts";

export async function retrieveChunks(
  question: string,
  history: Exchange[],
  signal: AbortSignal,
): Promise<Retrieved[]> {
  const query = await standaloneQuery(question, history, signal);
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: query,
    maxRetries: 1,
    abortSignal: signal,
  });
  // Unset would make the client fall back to the read-write token.
  const token = process.env.UPSTASH_VECTOR_REST_READ_ONLY_TOKEN;
  if (!token) throw new Error("UPSTASH_VECTOR_REST_READ_ONLY_TOKEN is not set");
  // The function form makes the client rethrow on abort instead of faking a 200.
  const index = new Index<ChunkMetadata>({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token,
    signal: () => signal,
    retry: { retries: 1 },
  });
  const matches = await index.query({ vector: embedding, topK: TOP_K, includeMetadata: true });
  return matches.flatMap(({ score, metadata }) =>
    metadata && score >= MIN_SCORE ? [{ ...metadata, score }] : [],
  );
}
