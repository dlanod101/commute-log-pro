import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwa } from "@/hooks/use-pwa";

export function PwaFloatingActions() {
  const { canInstall, updateAvailable, install, applyUpdate } = usePwa();

  if (!canInstall && !updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {updateAvailable && (
        <Button
          type="button"
          size="lg"
          className="gap-2 rounded-full bg-gradient-hero px-5 shadow-elevated"
          onClick={applyUpdate}
        >
          <RefreshCw className="h-4 w-4" />
          Update app
        </Button>
      )}
      {canInstall && (
        <Button
          type="button"
          size="lg"
          variant={updateAvailable ? "outline" : "default"}
          className={`gap-2 rounded-full px-5 shadow-elevated ${
            updateAvailable ? "bg-background" : "bg-gradient-hero"
          }`}
          onClick={() => void install()}
        >
          <Download className="h-4 w-4" />
          Install app
        </Button>
      )}
    </div>
  );
}
