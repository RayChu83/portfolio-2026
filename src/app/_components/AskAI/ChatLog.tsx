"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Message, MessageContent, MessageGroup } from "@/components/ui/message";
import profileIcon from "../../../../public/icon-192.png";
import StreamedText from "./StreamedText";
import type { AskChat } from "./useAskChat";

/** An ease-in-out white falloff, from the outer edge (1) to nothing, so the tint has no visible start or end. */
const SCRIM_STOPS = [
  [0, 0.85],
  [19, 0.8],
  [34, 0.68],
  [47, 0.52],
  [56, 0.4],
  [65, 0.27],
  [73, 0.17],
  [80, 0.1],
  [86, 0.05],
  [91, 0.02],
  [100, 0],
];

/** A white fade over the scroll area's top or bottom edge, so text is not cut off abruptly. */
function EdgeFade({
  edge,
  visible,
}: {
  edge: "top" | "bottom";
  visible: boolean;
}) {
  const direction = edge === "top" ? "to bottom" : "to top";
  const scrim = SCRIM_STOPS.map(
    ([at, alpha]) => `rgba(255,255,255,${alpha}) ${at}%`,
  ).join(", ");

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-14 transition-opacity duration-300 ease-out motion-reduce:transition-none",
        edge === "top" ? "top-0" : "bottom-0",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ background: `linear-gradient(${direction}, ${scrim})` }}
    />
  );
}

export default function ChatLog({
  messages,
  pending,
}: Pick<AskChat, "messages" | "pending">) {
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(scrollToEnd, [messages, pending, scrollToEnd]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const empty = messages.length === 0 && !pending;

  /** Whether there is more to scroll to above and below, so a fade shows only where text is cut off. */
  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((previous) =>
      previous.top === top && previous.bottom === bottom
        ? previous
        : { top, bottom },
    );
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    // Content growing (streamed text) changes the edges without any scroll event.
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [empty, updateEdges]);

  if (empty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-6">
        <Image
          src={profileIcon}
          alt=""
          aria-hidden
          className="size-16 rounded-full object-cover"
        />
        <p className="font-aeonik-medium text-xl tracking-tight text-neutral-500">
          Ask me anything...
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <EdgeFade edge="top" visible={edges.top} />
      <EdgeFade edge="bottom" visible={edges.bottom} />
      <div
        ref={scrollRef}
        onScroll={updateEdges}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6"
      >
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
                  {role === "assistant" ? (
                    <StreamedText id={id} text={text} onGrow={scrollToEnd} />
                  ) : (
                    text
                  )}
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
    </div>
  );
}
