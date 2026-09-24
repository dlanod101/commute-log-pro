/// <reference types="vite/client" />

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

interface Window {
  /**
   * `beforeinstallprompt` event captured by the bootstrap script in
   * `src/routes/__root.tsx` before React hydrated. `usePwa()` consumes it.
   */
  __deferredInstallPrompt?: BeforeInstallPromptEvent;
}
