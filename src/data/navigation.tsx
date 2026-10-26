import {
  Board24Regular,
  BookOpen24Regular,
  DataTrending24Regular,
  Home24Regular,
  TargetArrow24Regular,
  VideoClip24Regular,
} from "@fluentui/react-icons";
import type { ReactElement } from "react";
import { loadUiState } from "../lib/storage";
import type { View } from "../types";

export function AssistantGlyph() {
  return <span className="assistant-glyph" aria-hidden="true">✦</span>;
}

export const navItems: Array<{ id: View; label: string; icon: ReactElement }> = [
  { id: "today", label: "今天", icon: <Home24Regular /> },
  { id: "goals", label: "任务", icon: <TargetArrow24Regular /> },
  { id: "studio", label: "发布", icon: <VideoClip24Regular /> },
  { id: "analytics", label: "复盘", icon: <DataTrending24Regular /> },
  { id: "knowledge", label: "知识库", icon: <BookOpen24Regular /> },
  { id: "canvas", label: "画布", icon: <Board24Regular /> },
  { id: "ai", label: "AI 管家", icon: <AssistantGlyph /> },
];

export function viewFromHash(): View {
  const candidate = window.location.hash.replace("#", "") as View;
  if (navItems.some((item) => item.id === candidate)) return candidate;
  const stored = loadUiState().view;
  return navItems.some((item) => item.id === stored) ? stored! : "today";
}
