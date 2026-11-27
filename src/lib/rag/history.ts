import {
  MAX_HISTORY_ANSWER_LENGTH,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_TURNS,
  MAX_QUESTION_LENGTH,
  type Exchange,
} from "./config.ts";

/** History is optional context, so malformed entries are dropped instead of failing the request. */
export function parseHistory(raw: unknown): Exchange[] {
  if (!Array.isArray(raw)) return [];
  const exchanges = raw.slice(-MAX_HISTORY_TURNS).flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    if (!("question" in item) || !("answer" in item)) return [];
    if (typeof item.question !== "string" || typeof item.answer !== "string") return [];
    const question = item.question.trim().slice(0, MAX_QUESTION_LENGTH);
    const answer = item.answer.trim().slice(0, MAX_HISTORY_ANSWER_LENGTH);
    return question && answer ? [{ question, answer }] : [];
  });
  let used = 0;
  let start = exchanges.length;
  while (start > 0) {
    const { question, answer } = exchanges[start - 1];
    used += question.length + answer.length;
    if (used > MAX_HISTORY_CHARS) break;
    start--;
  }
  return exchanges.slice(start);
}

export function formatHistory(history: Exchange[]): string {
  const turns = history
    .map(({ question, answer }) => `<question>\n${question}\n</question>\n<answer>\n${answer}\n</answer>`)
    .join("\n");
  return `<history>\n${turns}\n</history>`;
}
