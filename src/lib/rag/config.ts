/** Shared so the composer's `maxLength` and the route's validation cannot drift. */
export const MAX_QUESTION_LENGTH = 500;

/** Returned verbatim, so they are machine-checkable: REFUSAL for an invalid ask, MISSING for an in-scope question the corpus cannot answer. */
export const REFUSAL_MESSAGE =
  "I'm not sure about that. Try asking a different question.";
export const MISSING_MESSAGE =
  "Sorry, I couldn't find what you're looking for. Try asking a different question.";

/** One earlier question and its answer. Sent by the client, so the server treats it as untrusted. */
export type Exchange = { question: string; answer: string };

export const MAX_HISTORY_TURNS = 4;
export const MAX_HISTORY_ANSWER_LENGTH = 1000;
/** Cost backstop on the whole history, applied after the turn cap. Fits two maximum-size exchanges. */
export const MAX_HISTORY_CHARS = 3000;
