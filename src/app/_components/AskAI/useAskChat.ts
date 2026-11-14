"use client";

import { useCallback, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
};

const FALLBACK_ERROR = "Something went wrong. Please try again.";

async function ask(question: string): Promise<string> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const body: { answer?: string; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.answer !== "string") {
    throw new Error(body.error ?? FALLBACK_ERROR);
  }
  return body.answer;
}

/** Owns the conversation. Lives above the side panel and the drawer so resizing across `lg` keeps it. */
export function useAskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (question: string) => {
      if (pending) return;
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: question }]);
      setPending(true);
      let reply: Omit<ChatMessage, "id">;
      try {
        reply = { role: "assistant", text: await ask(question) };
      } catch (error) {
        const text = error instanceof Error ? error.message : FALLBACK_ERROR;
        reply = { role: "assistant", text, failed: true };
      }
      setMessages((m) => [...m, { id: crypto.randomUUID(), ...reply }]);
      setPending(false);
    },
    [pending],
  );

  return { messages, pending, send };
}

export type AskChat = ReturnType<typeof useAskChat>;
