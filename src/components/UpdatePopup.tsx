import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwa } from "@/hooks/use-pwa";

export function UpdatePopup() {
  const { updateAvailable, applyUpdate } = usePwa();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Open the popup whenever a new version is detected, unless the user
  // dismissed it during this session (it will reappear on the next app open).
  useEffect(() => {
    if (updateAvailable && !dismissed) setOpen(true);
    else if (!updateAvailable) setOpen(false);
  }, [updateAvailable, dismissed]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDismissed(true);
  };

  if (!updateAvailable) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 sm:max-w-sm">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-hero shadow-elevated">
            <img src="/logo.png" alt="Dey Go logo" className="h-11 w-11 object-contain" />
          </div>
          <DialogTitle className="text-lg">A new version is available</DialogTitle>
          <DialogDescription className="mx-auto max-w-[16rem] text-sm">
            Update now to get the latest Dey Go fixes and features.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="w-full gap-2 rounded-full bg-gradient-hero shadow-elevated"
            onClick={() => void applyUpdate()}
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            Update now
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full rounded-full"
            onClick={() => handleOpenChange(false)}
          >
            Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
