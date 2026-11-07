"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "../../_hooks/useMediaQuery";
import AskAIPanel from "./AskAIPanel";
import SelectionAskButton from "./SelectionAskButton";

gsap.registerPlugin(ScrollTrigger);

/** Width of the panel at `lg` and above. Below it the panel covers the screen. */
export const PANEL_WIDTH = 356;

/** Matches the `duration-*` on the page wrapper and the panel below. */
const SLIDE_MS = 400;

type Prefill = { text: string; nonce: number };

type AskAIContextValue = {
  open: boolean;
  openWith: (text?: string) => void;
  close: () => void;
};

const AskAIContext = createContext<AskAIContextValue>({
  open: false,
  openWith: () => {},
  close: () => {},
});

export const useAskAI = () => useContext(AskAIContext);

/**
 * Owns whether the panel is open, renders the panel, and squishes the page
 * to make room for it at `lg` and above. The page content goes in as
 * `children`; the panel is a fixed sibling rather than part of it, so the
 * exit transition's clone of the page never contains a copy of the chat.
 */
export default function AskAIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [prefill, setPrefill] = useState<Prefill>({ text: "", nonce: 0 });
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openWith = useCallback((text = "") => {
    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    setPrefill((previous) => ({ text, nonce: previous.nonce + 1 }));
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnFocusRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  /** The page changed width, so every scroll position computed against the old one is stale. */
  useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), SLIDE_MS + 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const value = useMemo(() => ({ open, openWith, close }), [open, openWith, close]);

  return (
    <AskAIContext value={value}>
      <div
        className={cn(
          "transition-[margin] ease-[cubic-bezier(0.76,0,0.24,1)] motion-reduce:transition-none",
          open && "lg:mr-[356px]",
        )}
        style={{ transitionDuration: `${SLIDE_MS}ms` }}
      >
        {children}
      </div>
      <AskAIPanel desktop={desktop} open={open} prefill={prefill} onClose={close} slideMs={SLIDE_MS} />
      <SelectionAskButton />
    </AskAIContext>
  );
}
