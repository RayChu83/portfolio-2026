"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AskAIContext } from "./AskAIContext";
import AskAIPanel from "./AskAIPanel";
import SelectionAskButton from "./SelectionAskButton";

type Prefill = { text: string; nonce: number };

/**
 * Owns whether the drawer is open and renders it. The page content goes in as
 * `children`; the drawer is a portaled sibling rather than part of it, so the
 * exit transition's clone of the page never contains a copy of the chat.
 */
export default function AskAIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill>({ text: "", nonce: 0 });

  const openWith = useCallback((text = "") => {
    setPrefill((previous) => ({ text, nonce: previous.nonce + 1 }));
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ open, openWith }), [open, openWith]);

  return (
    <AskAIContext value={value}>
      {children}
      <AskAIPanel open={open} prefill={prefill} onClose={close} />
      <SelectionAskButton />
    </AskAIContext>
  );
}
