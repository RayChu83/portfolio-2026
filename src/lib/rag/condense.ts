import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { MAX_QUESTION_LENGTH, type Exchange } from "./config.ts";
import { formatHistory } from "./history.ts";

const REWRITE_TIMEOUT_MS = 4_000;

const REWRITE_PROMPT = `You rewrite a follow-up question into a standalone search query about the owner of a portfolio website.
- Replace pronouns and references like "he", "there" or "the first one" with the names they refer to in the history, including the owner's name.
- Keep the meaning of the latest question. Do not answer it and do not add facts.
- If the latest question is already standalone, or changes topic, return it unchanged.
- Reply with the query only, on one line.`;

/**
 * The rewrite only steers retrieval. The original question still goes to the answer step,
 * where scope is enforced, so an injected rewrite can at worst fetch different public chunks.
 */
export async function standaloneQuery(
  question: string,
  history: Exchange[],
  abortSignal: AbortSignal,
): Promise<string> {
  if (!history.length) return question;
  try {
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system: REWRITE_PROMPT,
      prompt: `${formatHistory(history)}\n\nLatest question:\n${question}`,
      maxOutputTokens: 200,
      providerOptions: { openai: { reasoningEffort: "minimal" } },
      maxRetries: 0,
      abortSignal: AbortSignal.any([abortSignal, AbortSignal.timeout(REWRITE_TIMEOUT_MS)]),
    });
    const query = text.trim();
    return query && query.length <= MAX_QUESTION_LENGTH ? query : question;
  } catch (error) {
    if (abortSignal.aborted) throw error;
    console.warn("question rewrite failed, searching with the raw question", error);
    return question;
  }
}
