"use client";

import { useCallback, useState } from "react";
import { isReplyKind, MAX_HISTORY_TURNS, type Exchange, type Reply, type ReplyKind } from "@/lib/rag/config";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Set on a successful assistant reply only. */
  kind?: ReplyKind;
  failed?: boolean;
};

const FALLBACK_ERROR = "Something went wrong. Please try again.";

/**
 * Only answers are kept: refusals and misses would prime the model to repeat them,
 * and small talk would evict a real question from the few turns sent.
 */
function recentHistory(messages: ChatMessage[]): Exchange[] {
  const exchanges = messages.flatMap((message, i) => {
    const prev = messages[i - 1];
    const usable = message.kind === "answer" && prev?.role === "user";
    return usable ? [{ question: prev.text, answer: message.text }] : [];
  });
  return exchanges.slice(-MAX_HISTORY_TURNS);
}

async function ask(question: string, history: Exchange[]): Promise<Reply> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  const body: { kind?: unknown; text?: unknown; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || !isReplyKind(body.kind) || typeof body.text !== "string") {
    throw new Error(body.error ?? FALLBACK_ERROR);
  }
  return { kind: body.kind, text: body.text };
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
        reply = { role: "assistant", ...(await ask(question, history)) };
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
