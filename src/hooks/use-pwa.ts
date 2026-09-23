import { useCallback, useEffect, useRef, useState } from "react";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Version stamped into the deployed service worker by `scripts/stamp-sw.mjs`.
 * It changes on every deploy, so a difference means a new release is live.
 */
const SW_VERSION_PATTERN = /SW_VERSION\s*=\s*"([^"]+)"/;

/**
 * Read the version of the service worker the server is serving right now.
 *
 * `no-store` plus a cache-busting query is deliberate: the browser (and any
 * CDN) will happily hand back a stale copy of /sw.js, which is the usual reason
 * a PWA never notices a new deployment.
 */
async function fetchDeployedSwVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/sw.js?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.text()).match(SW_VERSION_PATTERN)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function usePwa() {
  const [canInstall, setCanInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  const markWaitingWorker = useCallback((reg: ServiceWorkerRegistration) => {
    if (reg.waiting) {
      waitingWorkerRef.current = reg.waiting;
      setUpdateAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setInstalled(isStandalone());
    setReady(true);

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

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;

      if (import.meta.env.DEV) {
        const stale = await navigator.serviceWorker.getRegistrations();
        await Promise.all(stale.map((reg) => reg.unregister()));
      }

      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        // Never let the HTTP cache satisfy the update check for /sw.js — a
        // cached script means a release can silently go unnoticed.
        updateViaCache: "none",
      });

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

    // Registration/update can reject when the script can't be fetched (e.g. a
    // flaky network or a deploy in progress). Swallow it so it doesn't surface
    // as an uncaught promise rejection in the console.
    void registerServiceWorker().catch(() => {});

    // Two independent detection paths:
    //  1. the service-worker update check (fires `updatefound`), and
    //  2. reading the deployed /sw.js directly with `no-store`.
    // Path 2 is essential: browsers routinely serve a cached copy of /sw.js, so
    // path 1 never sees the new release and the popup would never show.
    let runVersion: string | null = null;

    const checkForUpdate = async () => {
      try {
        await navigator.serviceWorker?.ready.then((reg) => reg.update());
      } catch {
        /* offline, or a deploy in flight — the next tick retries */
      }

      const deployed = await fetchDeployedSwVersion();
      if (!deployed) return;
      if (runVersion === null) {
        // First successful read = the release this page is running.
        runVersion = deployed;
        return;
      }
      if (deployed !== runVersion) setUpdateAvailable(true);
    };

    void checkForUpdate();
    const updateInterval = setInterval(
      () => void checkForUpdate(),
      import.meta.env.DEV ? 15_000 : 5 * 60 * 1000,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(updateInterval);
    };
  }, [markWaitingWorker]);

  const install = useCallback(async () => {
    const prompt = installPromptRef.current;
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    installPromptRef.current = null;
    // The deferred prompt is one-shot: clear the flag so any later tap falls
    // back to the manual install instructions.
    setCanInstall(false);
    if (outcome === "accepted") setInstalled(true);
    return true;
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingWorkerRef.current;
    if (!waiting) {
      // Nothing staged yet — a reload is still enough, because the service
      // worker serves the app shell network-first.
      window.location.reload();
      return;
    }

    // Ask the new worker to activate, then reload once it takes control. The
    // timeout covers the case where `controllerchange` never fires.
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(reload, 2000);
  }, []);

  return {
    canInstall: canInstall && !installed,
    installed,
    ready,
    updateAvailable,
    install,
    applyUpdate,
  };
}
