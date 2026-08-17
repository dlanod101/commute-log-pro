import { useEffect, useState } from "react";
import {
  ApiError,
  assignUsersToAdmin,
  fetchAdminAssignedUsers,
  fetchAdminUsers,
  loadToken,
  type AdminUser,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

type Props = {
  admin: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onSessionExpired: () => void;
};

export function AdminAssignUsersDialog({
  admin,
  open,
  onOpenChange,
  onSaved,
  onSessionExpired,
}: Props) {
  const [candidates, setCandidates] = useState<AdminUser[]>([]);
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !admin) return;
    let cancelled = false;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setLoading(true);
    setSelected([]);
    Promise.all([
      fetchAdminUsers(tok, { role: "user", limit: 500 }),
      fetchAdminAssignedUsers(tok, admin.id),
    ])
      .then(([all, assigned]) => {
        if (cancelled) return;
        const assignedList = Array.isArray(assigned) ? assigned : [];
        setAssignedIds(assignedList.map((u) => u.id));
        const ids = new Set(assignedList.map((u) => u.id));
        setCandidates((all.users ?? []).filter((u) => !ids.has(u.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onSessionExpired();
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to load users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, admin, onSessionExpired]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!admin) return;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one user to assign");
      return;
    }
    setBusy(true);
    try {
      await assignUsersToAdmin(tok, admin.id, [...assignedIds, ...selected]);
      toast.success("Users assigned");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
      } else {
        toast.error(err instanceof Error ? err.message : "Assign failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign users</DialogTitle>
          <DialogDescription>
            Choose regular users for <strong>{admin?.name || admin?.email}</strong> to manage.
            Already-assigned users are excluded.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
            </div>
          ) : candidates.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No unassigned regular users available.
            </p>
          ) : (
            candidates.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
              >
                <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{u.name || "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {u.email || "No email"}
                  </span>
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {u.unit_id}
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={busy || selected.length === 0}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Assign {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
