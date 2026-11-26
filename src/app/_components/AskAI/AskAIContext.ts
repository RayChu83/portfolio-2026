"use client";

import { createContext, useContext } from "react";

export type AskAIContextValue = {
  open: boolean;
  openAskAI: () => void;
};

export const AskAIContext = createContext<AskAIContextValue>({
  open: false,
  openAskAI: () => {},
});

export const useAskAI = () => useContext(AskAIContext);
