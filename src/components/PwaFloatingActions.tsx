import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwa } from "@/hooks/use-pwa";

export function PwaFloatingActions() {
  const { canInstall, install } = usePwa();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:w-auto sm:p-0 sm:pb-0">
      <Button
        type="button"
        size="lg"
        className="w-full gap-2 rounded-full bg-gradient-hero shadow-elevated sm:w-auto sm:px-5"
        onClick={() => void install()}
      >
        <Download className="h-4 w-4 shrink-0" />
        Install app
      </Button>
    </div>
  );
}
