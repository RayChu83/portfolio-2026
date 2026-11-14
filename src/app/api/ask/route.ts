import { openai } from "@ai-sdk/openai";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import {
  EMBEDDING_MODEL,
  MAX_QUESTION_LENGTH,
  MIN_SCORE,
  TOP_K,
  type ChunkMetadata,
} from "@/lib/rag/config";
import { answerQuestion, REFUSAL_MESSAGE, type Retrieved } from "@/lib/rag/answer";
import { allowAsk } from "@/lib/server/ask-rate-limit";

export const maxDuration = 30;
/** Leaves headroom under maxDuration so an overrun ends in our 500, not a platform kill. */
const DEADLINE_MS = 25_000;

const RATE_LIMIT_MESSAGE = "Rate limit exceeded";
const ERROR_MESSAGE = "Something went wrong. Please try again.";

function selectRelevant(
  matches: { score: number; metadata?: ChunkMetadata }[],
): Retrieved[] {
  return matches.flatMap(({ score, metadata }) =>
    metadata && score >= MIN_SCORE ? [{ ...metadata, score }] : [],
  );
}

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

async function parseQuestion(request: Request): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("question" in body)) return null;
  if (typeof body.question !== "string") return null;
  const question = body.question.trim();
  return question && question.length <= MAX_QUESTION_LENGTH ? question : null;
}

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]);
  const question = await parseQuestion(request);
  if (question === null) {
    return badRequest(`Send a non-empty question of at most ${MAX_QUESTION_LENGTH} characters.`);
  }

  try {
    if (!(await allowAsk(request.headers))) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
    }

    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: question,
      maxRetries: 1,
      abortSignal: signal,
    });
    // A plain signal makes the Upstash client fake a 200 on abort; the function form rethrows.
    const index = new Index<ChunkMetadata>({ signal: () => signal, retry: { retries: 1 } });
    const matches = await index.query({
      vector: embedding,
      topK: TOP_K,
      includeMetadata: true,
    });
    const chunks = selectRelevant(matches);
    if (!chunks.length) return Response.json({ answer: REFUSAL_MESSAGE });

    return Response.json({ answer: await answerQuestion(question, chunks, signal) });
  } catch (error) {
    console.error("ask route failed", error);
    return Response.json({ error: ERROR_MESSAGE }, { status: 500 });
  }
}
