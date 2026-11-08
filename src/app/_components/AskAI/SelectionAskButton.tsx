"use client";

import { useEffect, useRef, useState } from "react";
import { useAskAI } from "./AskAIContext";

type Anchor = { x: number; y: number; below: boolean; text: string };

const MAX_CHARS = 500;

/**
 * A small "Ask AI" button that appears above the user's text selection and
 * opens the panel with that text in the input. Shown only once the pointer
 * is released so it does not chase a drag.
 */
export default function SelectionAskButton() {
  const { openWith } = useAskAI();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const pointerDown = useRef(false);

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!selection || selection.rangeCount === 0 || !text) return setAnchor(null);

      const node = selection.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      if (element?.closest("[data-ask-ai-panel], [data-ask-ai-ignore]")) return setAnchor(null);

      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return setAnchor(null);
      const below = rect.top < 56;
      setAnchor({
        x: Math.min(Math.max(rect.left + rect.width / 2, 48), window.innerWidth - 48),
        y: below ? rect.bottom + 8 : rect.top - 8,
        below,
        text: text.slice(0, MAX_CHARS),
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest("[data-ask-selection]")) return;
      pointerDown.current = true;
      setAnchor(null);
    };
    const onPointerUp = () => {
      pointerDown.current = false;
      window.setTimeout(update, 0);
    };
    const onSelectionChange = () => {
      if (!pointerDown.current) update();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!anchor) return null;

  return (
    <button
      type="button"
      data-ask-selection
      // Keep the selection alive through the click.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        openWith(anchor.text);
        window.getSelection()?.removeAllRanges();
        setAnchor(null);
      }}
      className="fixed z-96 cursor-pointer rounded-full bg-neutral-900 px-3 py-1.5 font-aeonik-medium text-sm text-white shadow-lg"
      style={{
        left: anchor.x,
        top: anchor.y,
        transform: anchor.below ? "translateX(-50%)" : "translate(-50%, -100%)",
      }}
    >
      Ask AI
    </button>
  );
}
