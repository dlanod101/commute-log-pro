import { useCallback, useEffect, useRef, useState } from "react";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function usePwa() {
  const [canInstall, setCanInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const markWaitingWorker = useCallback((reg: ServiceWorkerRegistration) => {
    if (reg.waiting) {
      waitingWorkerRef.current = reg.waiting;
      setUpdateAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setInstalled(isStandalone());

    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      installPromptRef.current = e;
      if (!isStandalone()) setCanInstall(true);
    };

    const onInstalled = () => {
      installPromptRef.current = null;
      setCanInstall(false);
      setInstalled(true);
    };

    const onControllerChange = () => {
      window.location.reload();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    let updateInterval: ReturnType<typeof setInterval> | undefined;

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;

      if (import.meta.env.DEV) {
        const stale = await navigator.serviceWorker.getRegistrations();
        await Promise.all(stale.map((reg) => reg.unregister()));
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      registrationRef.current = reg;

      // An update can already be installing/waiting by the time register()
      // resolves (the updatefound event may have already fired), so cover that
      // state as well as future installs — otherwise a freshly-deployed
      // version can be missed and the update popup never shows.
      const watchWorker = (worker: ServiceWorker) => {
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = reg.waiting ?? worker;
            setUpdateAvailable(true);
          }
        });
      };

      markWaitingWorker(reg);
      if (reg.installing) watchWorker(reg.installing);

      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (worker) watchWorker(worker);
      });

      // Force an immediate update check so the popup appears on the very first
      // load after a release, rather than relying only on the 15-minute poll.
      void reg.update().catch(() => {});
    };

    void registerServiceWorker();

    updateInterval = setInterval(
      () => {
        void navigator.serviceWorker?.ready.then((reg) => reg.update());
      },
      import.meta.env.DEV ? 30_000 : 15 * 60 * 1000,
    );

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, [markWaitingWorker]);

  const install = useCallback(async () => {
    const prompt = installPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    installPromptRef.current = null;
    if (outcome === "accepted") {
      setCanInstall(false);
      setInstalled(true);
    }
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingWorkerRef.current;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    void registrationRef.current?.update().then(() => {
      if (registrationRef.current) markWaitingWorker(registrationRef.current);
    });
  }, [markWaitingWorker]);

  return {
    canInstall: canInstall && !installed,
    updateAvailable,
    install,
    applyUpdate,
  };
}
