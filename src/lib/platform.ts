/**
 * Windows / Android / Linux 上显示 Ctrl、Enter、Esc 这类标准按键名，
 * 只有在 Apple 设备上才显示 ⌘、↵、⇧ 等 Mac 符号。
 */
export const isAppleDevice =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

export const modifierKey = isAppleDevice ? "⌘" : "Ctrl";
export const enterKey = isAppleDevice ? "↵" : "Enter";
export const escapeKey = isAppleDevice ? "esc" : "Esc";
export const shiftKey = isAppleDevice ? "⇧" : "Shift";

export const searchShortcutLabel = `${modifierKey}+K`;
