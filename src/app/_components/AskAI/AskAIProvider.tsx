"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AskAIContext } from "./AskAIContext";
import AskAIPanel from "./AskAIPanel";

/**
 * Owns whether the drawer is open and renders it. The page content goes in as
 * `children`; the drawer is a portaled sibling rather than part of it, so the
 * exit transition's clone of the page never contains a copy of the chat.
 */
export default function AskAIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openAskAI = useCallback(() => setOpen(true), []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ open, openAskAI }), [open, openAskAI]);

  return (
    <AskAIContext value={value}>
      {children}
      <AskAIPanel open={open} onClose={close} />
    </AskAIContext>
  );
}
