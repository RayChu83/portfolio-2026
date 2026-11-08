"use client";

import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Message, MessageContent, MessageGroup } from "@/components/ui/message";
import StreamedText from "./StreamedText";
import type { AskChat } from "./useAskChat";

export default function ChatLog({ messages, pending }: Pick<AskChat, "messages" | "pending">) {
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(scrollToEnd, [messages, pending, scrollToEnd]);

  return (
    <div role="log" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
      <MessageGroup className="gap-6">
        {messages.map(({ id, role, text, failed }) => (
          <Message key={id} align={role === "user" ? "end" : "start"}>
            <MessageContent>
              <p
                className={cn(
                  "whitespace-pre-wrap",
                  role === "user"
                    ? "self-end max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-3.5 py-2 text-white"
                    : "text-neutral-800",
                  failed && "text-red-600",
                )}
              >
                {role === "assistant" ? <StreamedText id={id} text={text} onGrow={scrollToEnd} /> : text}
              </p>
            </MessageContent>
          </Message>
        ))}
        {pending && (
          <Message>
            <MessageContent>
              <p className="animate-pulse text-neutral-400">Thinking…</p>
            </MessageContent>
          </Message>
        )}
      </MessageGroup>
      <div ref={endRef} />
    </div>
  );
}
