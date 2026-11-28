import {
  MAX_QUESTION_LENGTH,
  MISSING_MESSAGE,
  type Exchange,
} from "@/lib/rag/config";
import { answerQuestion } from "@/lib/rag/answer";
import { parseHistory } from "@/lib/rag/history";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { classifyMessage, smallTalkReply } from "@/lib/rag/message-classifier";
import { allowAsk } from "@/lib/server/ask-rate-limit";
import { isCrossSite } from "@/lib/server/network";

export const maxDuration = 30;
/** Leaves headroom under maxDuration so an overrun ends in our 500, not a platform kill. */
const DEADLINE_MS = 25_000;

const RATE_LIMIT_MESSAGE = "Rate limit exceeded";
const ERROR_MESSAGE = "Something went wrong. Please try again.";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

/** A text/plain POST skips the CORS preflight, so any page could otherwise call this route. */
function isJson(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  return mediaType === "application/json";
}

async function parseBody(request: Request): Promise<{
  question: string;
  history: Exchange[];
} | null> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("question" in body))
    return null;
  if (typeof body.question !== "string") return null;
  const question = body.question.trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) return null;
  return {
    question,
    history: parseHistory("history" in body ? body.history : undefined),
  };
}

export async function POST(request: Request) {
  if (isCrossSite(request.headers)) {
    return Response.json(
      { error: "Cross-site requests are not allowed." },
      { status: 403 },
    );
  }
  if (!isJson(request)) {
    return Response.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  const signal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(DEADLINE_MS),
  ]);
  const body = await parseBody(request);
  if (body === null) {
    return badRequest(
      `Send a non-empty question of at most ${MAX_QUESTION_LENGTH} characters.`,
    );
  }
  const { question, history } = body;

  try {
    if (!(await allowAsk(request.headers))) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
    }

    if ((await classifyMessage(question, history, signal)).smallTalk) {
      const reply = await smallTalkReply(question, signal);
      if (reply !== null) return Response.json({ answer: reply, smallTalk: true });
    }

    const chunks = await retrieveChunks(question, history, signal);
    if (!chunks.length) return Response.json({ answer: MISSING_MESSAGE });

    return Response.json({
      answer: await answerQuestion(question, chunks, history, signal),
    });
  } catch (error) {
    console.error("ask route failed", error);
    return Response.json({ error: ERROR_MESSAGE }, { status: 500 });
  }
}
