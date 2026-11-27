"use client";

import { useEffect, useState } from "react";

const STEP_MS = 40;
const MAX_TOTAL_MS = 3000;

// Messages that already played their reveal. Survives the panel/drawer remount on resize.
const revealed = new Set<string>();

const isWord = (token: string) => token !== "" && !/^\s+$/.test(token);

/**
 * Mounts words one at a time so the message grows with what is shown; each
 * word fades and un-blurs as it mounts. Plays once per message id.
 * `onGrow` fires after each word so the log can follow the new height.
 */
export default function StreamedText({
  id,
  text,
  onGrow,
}: {
  id: string;
  text: string;
  onGrow: () => void;
}) {
  const tokens = text.split(/(\s+)/);
  const total = tokens.filter(isWord).length;
  const [animate] = useState(() => !revealed.has(id));
  const [shown, setShown] = useState(animate ? 0 : total);

  useEffect(() => {
    revealed.add(id);
  }, [id]);

  useEffect(() => {
    if (shown >= total) return;
    const step = Math.min(STEP_MS, MAX_TOTAL_MS / total);
    const timer = window.setTimeout(() => setShown((n) => n + 1), step);
    return () => window.clearTimeout(timer);
  }, [shown, total]);

  useEffect(onGrow, [shown, onGrow]);

  if (!animate) return <>{text}</>;

  let words = 0;
  const visible: React.ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!isWord(token)) {
      if (words < shown || words === 0) visible.push(token);
      continue;
    }
    if (words++ >= shown) break;
    visible.push(
      <span key={i} className="stream-word">
        {token}
      </span>,
    );
  }
  return <>{visible}</>;
}
