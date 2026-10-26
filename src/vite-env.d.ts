/// <reference types="vite/client" />

type WorkstationSavedMedia = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

interface Window {
  workstation?: {
    chooseVaultFolder: () => Promise<string | null>;
    saveMedia: (input: { name: string; type: string; bytes: ArrayBuffer }) => Promise<WorkstationSavedMedia>;
    removeMedia: (id: string) => Promise<{ ok: boolean }>;
    createDesktopShortcut: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  };
}
