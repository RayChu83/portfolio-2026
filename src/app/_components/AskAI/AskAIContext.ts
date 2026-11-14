"use client";

import { createContext, useContext } from "react";

export type AskAIContextValue = {
  open: boolean;
  openWith: (text?: string) => void;
  close: () => void;
};

export const AskAIContext = createContext<AskAIContextValue>({
  open: false,
  openWith: () => {},
  close: () => {},
});

export const useAskAI = () => useContext(AskAIContext);
