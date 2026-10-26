import { webDarkTheme, webLightTheme } from "@fluentui/react-components";

/* Windows / Android / Linux 优先，Apple 设备自动回退到系统字体。 */
const fontFamilyBase =
  '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif';
const fontFamilyMonospace =
  '"Cascadia Code", "Cascadia Mono", Consolas, "SFMono-Regular", "JetBrains Mono", "Courier New", monospace';

/* Brand palette: indigo-violet primary with a magenta accent.
   Neutrals carry a faint violet cast so surfaces read as one family. */
export const workstationLightTheme = {
  ...webLightTheme,
  colorBrandBackground: "#6e56f8",
  colorBrandBackgroundHover: "#5a42e8",
  colorBrandBackgroundPressed: "#4a33d4",
  colorBrandBackgroundSelected: "#f0edff",
  colorBrandForeground1: "#5a42e8",
  colorBrandForeground2: "#4a33d4",
  colorBrandForegroundLink: "#5a42e8",
  colorBrandBackground2: "#f0edff",
  colorBrandStroke1: "#6e56f8",
  colorBrandStroke2: "#c3b6ff",
  colorNeutralBackground1: "#ffffff",
  colorNeutralBackground2: "#f7f6fb",
  colorNeutralBackground3: "#f1eef8",
  colorNeutralBackground4: "#ece8f5",
  colorNeutralForeground1: "#191428",
  colorNeutralForeground2: "#4a4459",
  colorNeutralForeground3: "#6f6981",
  colorNeutralForeground4: "#8d889e",
  colorNeutralStroke1: "#d9d4e6",
  colorNeutralStroke2: "#e8e4f2",
  colorNeutralStroke3: "#f1eef8",
  colorCompoundBrandStroke: "#6e56f8",
  colorCompoundBrandStrokeHover: "#5a42e8",
  colorCompoundBrandStrokePressed: "#4a33d4",
  fontFamilyBase,
  fontFamilyMonospace,
};

export const workstationDarkTheme = {
  ...webDarkTheme,
  colorBrandBackground: "#7d68ff",
  colorBrandBackgroundHover: "#8f7bff",
  colorBrandBackgroundPressed: "#6e56f8",
  colorBrandBackgroundSelected: "#241f3d",
  colorBrandForeground1: "#a08cff",
  colorBrandForeground2: "#b8a7ff",
  colorBrandForegroundLink: "#a08cff",
  colorBrandBackground2: "#241f3d",
  colorBrandStroke1: "#7d68ff",
  colorBrandStroke2: "#43386e",
  colorNeutralBackground1: "#201d2b",
  colorNeutralBackground2: "#14121c",
  colorNeutralBackground3: "#292536",
  colorNeutralBackground4: "#2f2b3d",
  colorNeutralForeground1: "#f4f2f8",
  colorNeutralForeground2: "#cfc9dd",
  colorNeutralForeground3: "#a09ab2",
  colorNeutralForeground4: "#8d879f",
  colorNeutralStroke1: "#454055",
  colorNeutralStroke2: "#322d42",
  colorNeutralStroke3: "#292536",
  colorCompoundBrandStroke: "#7d68ff",
  colorCompoundBrandStrokeHover: "#8f7bff",
  colorCompoundBrandStrokePressed: "#6e56f8",
  fontFamilyBase,
  fontFamilyMonospace,
};
