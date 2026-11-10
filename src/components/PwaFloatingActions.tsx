import { useEffect, useState } from "react";
import { ArrowUpFromLine, Download, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwa } from "@/hooks/use-pwa";

export function PwaFloatingActions() {
  const { canInstall, installed, ready, install } = usePwa();
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // `appinstalled` only fires for a real installation, so this can't be
  // confused with launching the app from the home screen.
  useEffect(() => {
    const onInstalled = () => {
      setHelpOpen(false);
      toast.success("DeyGo installed — open it from your home screen");
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // Keep the button visible for anyone who hasn't installed the app yet — not
  // just when the browser exposes a `beforeinstallprompt` event. Browsers such
  // as iOS Safari never fire that event, so the button would otherwise be
  // missing there entirely. Wait for `ready` so installed users don't see a
  // flash of the button on first paint.
  if (!ready || installed || dismissed) return null;

  const handleClick = async () => {
    if (canInstall) {
      const prompted = await install();
      if (prompted) return;
    }
    // No native prompt available (iOS, Firefox, or already consumed) — show
    // the manual "add to home screen" steps instead.
    setHelpOpen(true);
  };

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <>
      <div className="fixed bottom-2 left-3 right-3 z-40 flex items-center gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:w-auto sm:p-0 sm:pb-0">
        <Button
          type="button"
          size="lg"
          className="flex-1 gap-2 rounded-full bg-gradient-hero shadow-elevated sm:flex-none sm:px-5"
          onClick={() => void handleClick()}
        >
          <Download className="h-4 w-4 shrink-0" />
          Install app
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full shadow-card sm:hidden bg-background/90 backdrop-blur border text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
          title="Dismiss install banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="gap-5 sm:max-w-sm">
          <DialogHeader className="text-center sm:text-center">
            <img
              src="/logo.png"
              alt="DeyGo logo"
              className="mx-auto mb-3 h-16 w-auto object-contain"
            />
            <DialogTitle className="text-lg">Install DeyGo on your device</DialogTitle>
            <DialogDescription className="mx-auto max-w-[17rem] text-sm">
              Installing lets DeyGo open full-screen and keep working offline.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            {isIos ? (
              <p className="flex items-start gap-2">
                <ArrowUpFromLine className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  Tap the <span className="font-medium">Share</span> button in Safari, then choose{" "}
                  <span className="font-medium">Add to Home Screen</span>.
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2">
                <Menu className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  Open your browser menu, then choose{" "}
                  <span className="font-medium">Install app</span> or{" "}
                  <span className="font-medium">Add to Home screen</span>.
                </span>
              </p>
            )}
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full rounded-full"
            onClick={() => setHelpOpen(false)}
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
