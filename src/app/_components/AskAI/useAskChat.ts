"use client";

import { useCallback, useState } from "react";
import { MAX_HISTORY_TURNS, MISSING_MESSAGE, REFUSAL_MESSAGE, type Exchange } from "@/lib/rag/config";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
};

const FALLBACK_ERROR = "Something went wrong. Please try again.";

/** Refusals and misses are left out so the model is not primed to repeat them. */
function recentHistory(messages: ChatMessage[]): Exchange[] {
  const exchanges = messages.flatMap((message, i) => {
    const prev = messages[i - 1];
    const usable =
      message.role === "assistant" &&
      prev?.role === "user" &&
      !message.failed &&
      message.text !== REFUSAL_MESSAGE &&
      message.text !== MISSING_MESSAGE;
    return usable ? [{ question: prev.text, answer: message.text }] : [];
  });
  return exchanges.slice(-MAX_HISTORY_TURNS);
}

async function ask(
  question: string,
  history: Exchange[],
): Promise<string> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  const body: { answer?: string; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.answer !== "string") {
    throw new Error(body.error ?? FALLBACK_ERROR);
  }
  return body.answer;
}

/** Owns the conversation. Lives above the drawer so closing it keeps the chat. */
export function useAskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (question: string) => {
      if (pending) return;
      const history = recentHistory(messages);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: question }]);
      setPending(true);
      let reply: Omit<ChatMessage, "id">;
      try {
        reply = { role: "assistant", text: await ask(question, history) };
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
