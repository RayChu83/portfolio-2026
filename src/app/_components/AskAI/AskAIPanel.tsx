"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { RxArrowUp } from "react-icons/rx";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { MAX_QUESTION_LENGTH } from "@/lib/rag/config";
import { useMediaQuery } from "../../_hooks/useMediaQuery";
import { useScrollLock } from "../../_hooks/useScrollLock";
import ChatLog from "./ChatLog";
import { useAskChat, type AskChat } from "./useAskChat";

type Props = {
  open: boolean;
  prefill: { text: string; nonce: number };
  onClose: () => void;
};

/**
 * `lg` and up: a fixed column on the right, laid over the page. The page is not
 * resized or shifted for it. Below `lg`: the shadcn drawer.
 */
export default function AskAIPanel(props: Props) {
  const desktop = useMediaQuery("(min-width: 756px)");
  const chat = useAskChat();

  return desktop ? (
    <SidePanel {...props} chat={chat} />
  ) : (
    <BottomDrawer {...props} chat={chat} />
  );
}

type PanelProps = Props & { chat: AskChat };

function SidePanel({ open, prefill, onClose, chat }: PanelProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useScrollLock(open);
  const [dragX, setDragX] = useState<number | null>(null);
  const drag = useRef<{ startX: number; startTime: number } | null>(null);

  const onHandleDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startTime: event.timeStamp };
    setDragX(0);
  };
  const onHandleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setDragX(Math.max(0, event.clientX - drag.current.startX));
  };
  const onHandleUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = Math.max(0, event.clientX - drag.current.startX);
    const velocity = dx / Math.max(1, event.timeStamp - drag.current.startTime);
    drag.current = null;
    setDragX(null);
    // Dragged far enough, or flicked: close. Otherwise it springs back.
    if (dx > 120 || (dx > 20 && velocity > 0.5)) onClose();
  };

  useEffect(() => {
    if (!open) return;
    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
      returnFocusRef.current = null;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Dims the page and takes outside clicks, so the sidebar reads as modal. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-99 bg-black/40 backdrop-blur-sm transition-opacity duration-400 motion-reduce:transition-none",
          dragX !== null && "transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={
          dragX !== null ? { opacity: Math.max(0, 1 - dragX / 400) } : undefined
        }
      />
      <aside
        id="ask-ai-panel"
        data-ask-ai-panel
        aria-label="Ask AI"
        inert={!open}
        aria-hidden={!open}
        style={
          dragX !== null ? { transform: `translateX(${dragX}px)` } : undefined
        }
        className={cn(
          "fixed inset-y-5 right-5 z-100 flex w-[400px] max-w-[calc(100%-2.5rem)] flex-col overflow-hidden rounded-[28px] [corner-shape:squircle] border border-border bg-white shadow-[0_12px_48px_-12px_rgba(0,0,0,0.12)] transition-transform duration-400 ease-[cubic-bezier(0.76,0,0.24,1)] motion-reduce:transition-none",
          dragX !== null && "transition-none",
          open
            ? "translate-x-0"
            : "pointer-events-none translate-x-[calc(100%+2.5rem)]",
        )}
      >
        {/* The notch: drag it right to close. The hit area is wider than the pill. */}
        <div
          data-slot="ask-ai-swipe-handle"
          aria-hidden
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          className="absolute top-1/2 left-0 z-10 flex h-28 w-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center select-none after:block after:h-[100px] after:w-1.5 after:rounded-full after:bg-muted active:cursor-grabbing"
        />
        <ChatLog messages={chat.messages} pending={chat.pending} />
        <Suggestions chat={chat} />
        {/* Remounted per prefill so a new selection replaces the draft without an effect syncing state. */}
        <Composer
          key={prefill.nonce}
          initialValue={prefill.text}
          chat={chat}
          focusOnOpen={open}
        />
      </aside>
    </>
  );
}

/**
 * The shadcn drawer: 85% of the screen, with a swipe handle and a title. The
 * input is not focused on open, since that would raise the keyboard over a
 * drawer the user has not yet read.
 */
function BottomDrawer({ open, prefill, onClose, chat }: PanelProps) {
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
        className="z-100 mx-auto w-[min(48rem,calc(100%-2.5rem))] rounded-[28px] [corner-shape:squircle] shadow-[0_12px_48px_-12px_rgba(0,0,0,0.12)] [--drawer-content-height:85dvh] [--drawer-content-max-height:calc(100dvh-2.5rem)] [--drawer-inset:1.25rem]"
      >
        <DrawerTitle className="sr-only">Ask me anything</DrawerTitle>
        <ChatLog messages={chat.messages} pending={chat.pending} />
        <Suggestions chat={chat} />
        {/* Remounted per prefill so a new selection replaces the draft without an effect syncing state. */}
        <Composer key={prefill.nonce} initialValue={prefill.text} chat={chat} />
      </DrawerContent>
    </Drawer>
  );
}

const SUGGESTIONS = [
  "What is Ray's tech stack?",
  "What projects has Ray built?",
];

/** Starter questions, shown only until the first message is sent. */
function Suggestions({ chat }: { chat: AskChat }) {
  if (chat.messages.length > 0 || chat.pending) return null;

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 px-6 pb-1">
      {SUGGESTIONS.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => void chat.send(question)}
          className="cursor-pointer rounded-lg py-1.5 text-left text-sm text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900 motion-reduce:transition-none"
        >
          {question}
        </button>
      ))}
    </div>
  );
}

function Composer({
  initialValue,
  chat,
  focusOnOpen = false,
}: {
  initialValue: string;
  chat: AskChat;
  focusOnOpen?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusOnOpen) ref.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(resize, [value]);

  const submit = () => {
    const question = value.trim();
    if (!question || chat.pending) return;
    setValue("");
    void chat.send(question);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
    >
      <div className="relative rounded-[24px] [corner-shape:squircle] bg-neutral-200 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] transition-colors duration-200 focus-within:bg-neutral-300/70 hover:bg-neutral-300/70 motion-reduce:transition-none">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_QUESTION_LENGTH}
          aria-label="Message"
          placeholder="Summarize Rays work experience"
          className="block max-h-40 w-full resize-none overflow-y-auto border-0 bg-transparent py-4 pr-14 pl-5 text-sm text-neutral-600 outline-none placeholder:text-neutral-500"
        />
        <button
          type="submit"
          disabled={!value.trim() || chat.pending}
          aria-label="Send"
          className="absolute right-2.5 bottom-2.5 grid size-8 cursor-pointer place-items-center rounded-[14px] [corner-shape:squircle] bg-neutral-900 text-white transition-opacity disabled:cursor-default disabled:opacity-20"
        >
          <RxArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
