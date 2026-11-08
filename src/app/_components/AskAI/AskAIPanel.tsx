"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { RxArrowLeft, RxArrowUp } from "react-icons/rx";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

type Props = {
  open: boolean;
  prefill: { text: string; nonce: number };
  onClose: () => void;
  slideMs: number;
};

export default function AskAIPanel({ desktop, ...props }: Props & { desktop: boolean }) {
  return desktop ? <SidePanel {...props} /> : <BottomDrawer {...props} />;
}

/** `lg` and up: a fixed `--ask-ai-width` column on the right that the page squishes for. */
function SidePanel({ open, prefill, onClose, slideMs }: Props) {
  return (
    <aside
      id="ask-ai-panel"
      data-ask-ai-panel
      aria-label="Ask AI"
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-100 flex h-dvh w-(--ask-ai-width) flex-col border-l border-border bg-white transition-transform ease-[cubic-bezier(0.76,0,0.24,1)] motion-reduce:transition-none",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      style={{ transitionDuration: `${slideMs}ms` }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Ask AI"
          className="cursor-pointer rounded-md p-1.5 text-neutral-900 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          <RxArrowLeft className="size-5" aria-hidden />
        </button>
        <h2 className="font-aeonik-medium text-sm text-neutral-900">Ask AI</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" />

      {/* Remounted per prefill so a new selection replaces the draft without an effect syncing state. */}
      <Composer key={prefill.nonce} open={open} initialValue={prefill.text} focusOnOpen />
    </aside>
  );
}

/**
 * Below `lg`: the shadcn bottom drawer, 85% of the screen, with a swipe
 * handle and no heading. The input is not focused on open, since that would
 * raise the keyboard over a drawer the user has not yet read.
 */
function BottomDrawer({ open, prefill, onClose }: Props) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      showSwipeHandle
    >
      <DrawerContent
        id="ask-ai-panel"
        data-ask-ai-panel
        aria-label="Ask AI"
        className="z-100 rounded-t-3xl rounded-b-none border-x-0 border-b-0 [--drawer-content-height:85dvh] [--drawer-content-max-height:85dvh] [--drawer-inset:0px]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto" />
        <Composer key={prefill.nonce} open={open} initialValue={prefill.text} />
      </DrawerContent>
    </Drawer>
  );
}

function Composer({
  open,
  initialValue,
  focusOnOpen = false,
}: {
  open: boolean;
  initialValue: string;
  focusOnOpen?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && focusOnOpen) ref.current?.focus({ preventScroll: true });
  }, [open, focusOnOpen]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(resize, [value]);

  // Submitting is deliberately a no-op in this pass; the backend is not built.
  const onSubmit = (event: FormEvent) => event.preventDefault();

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          aria-label="Message"
          placeholder="Summarize Rays work experience"
          className="block w-full resize-none border-0 bg-white py-5 pr-14 pl-4 text-sm text-neutral-600 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send"
          className="absolute right-3 bottom-3 grid size-8 cursor-pointer place-items-center rounded-full bg-neutral-900 text-white transition-opacity disabled:cursor-default disabled:opacity-20"
        >
          <RxArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
