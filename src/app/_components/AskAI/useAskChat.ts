"use client";

import { useCallback, useState } from "react";
import { MAX_HISTORY_TURNS, REFUSAL_MESSAGE, type Exchange } from "@/lib/rag/config";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  /** Small talk carries nothing to refer back to, so it must not take a history slot. */
  smallTalk?: boolean;
};

const FALLBACK_ERROR = "Something went wrong. Please try again.";

/** Refusals are left out so the model is not primed to repeat them, small talk so it cannot evict a real question. */
function recentHistory(messages: ChatMessage[]): Exchange[] {
  const exchanges = messages.flatMap((message, i) => {
    const prev = messages[i - 1];
    const usable =
      message.role === "assistant" &&
      prev?.role === "user" &&
      !message.failed &&
      !message.smallTalk &&
      message.text !== REFUSAL_MESSAGE;
    return usable ? [{ question: prev.text, answer: message.text }] : [];
  });
  return exchanges.slice(-MAX_HISTORY_TURNS);
}

/** Only the small-talk gate reads this, so it includes small talk that history leaves out. */
function lastAnswer(messages: ChatMessage[]): string | undefined {
  return messages.findLast((m) => m.role === "assistant" && !m.failed)?.text;
}

async function ask(
  question: string,
  history: Exchange[],
  previousAnswer: string | undefined,
): Promise<{ answer: string; smallTalk?: boolean }> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history, previousAnswer }),
  });
  const body: { answer?: string; smallTalk?: boolean; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.answer !== "string") {
    throw new Error(body.error ?? FALLBACK_ERROR);
  }
  return { answer: body.answer, smallTalk: body.smallTalk };
}

/** Owns the conversation. Lives above the side panel and the drawer so resizing across `lg` keeps it. */
export function useAskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (question: string) => {
      if (pending) return;
      const history = recentHistory(messages);
      const previousAnswer = lastAnswer(messages);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: question }]);
      setPending(true);
      let reply: Omit<ChatMessage, "id">;
      try {
        const { answer, smallTalk } = await ask(question, history, previousAnswer);
        reply = { role: "assistant", text: answer, smallTalk };
      } catch (error) {
        const text = error instanceof Error ? error.message : FALLBACK_ERROR;
        reply = { role: "assistant", text, failed: true };
      }
      setMessages((m) => [...m, { id: crypto.randomUUID(), ...reply }]);
      setPending(false);
    },
    [messages, pending],
  );

  return { messages, pending, send };
}

export type AskChat = ReturnType<typeof useAskChat>;
