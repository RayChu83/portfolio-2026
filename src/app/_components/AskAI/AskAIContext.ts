"use client";

import { createContext, useContext } from "react";

export type AskAIContextValue = {
  open: boolean;
  openWith: (text?: string) => void;
};

export const AskAIContext = createContext<AskAIContextValue>({
  open: false,
  openWith: () => {},
});

export const useAskAI = () => useContext(AskAIContext);
