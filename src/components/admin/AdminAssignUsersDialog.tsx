import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, CheckSquare, Loader2, Save, Search, Square, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "./shared";

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
  const [filterText, setFilterText] = useState("");

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
    setFilterText("");
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

  const filteredCandidates = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.unit_id && u.unit_id.toLowerCase().includes(q)),
    );
  }, [candidates, filterText]);

  const selectAllFiltered = () => {
    const filteredIds = filteredCandidates.map((u) => u.id);
    setSelected((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredCandidates.map((u) => u.id));
    setSelected((prev) => prev.filter((id) => !filteredIds.has(id)));
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
      toast.success(
        `${selected.length} user${selected.length === 1 ? "" : "s"} assigned to ${admin.name || admin.email}`,
      );
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
      <DialogContent className="max-w-md w-full p-4 sm:p-6 max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg">Assign users to admin</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Select drivers for <strong>{admin?.name || admin?.email}</strong> to oversee.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Bulk selection bar */}
        <div className="space-y-2 mt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search unassigned drivers…"
              className="pl-8 pr-7 h-9 text-xs"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span>
              {selected.length} selected
              {candidates.length > 0 && ` (${candidates.length} available)`}
            </span>
            {filteredCandidates.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-primary hover:underline font-medium text-xs"
                >
                  Select all
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="text-muted-foreground hover:underline text-xs"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto space-y-1 rounded-lg border p-1 mt-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading candidate users…</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              All regular users are already assigned to this admin.
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No unassigned users match "{filterText}".
            </div>
          ) : (
            filteredCandidates.map((u) => {
              const isChecked = selected.includes(u.id);
              return (
                <label
                  key={u.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md p-2 transition-colors select-none ${
                    isChecked ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle(u.id)}
                    className="h-4 w-4 rounded shrink-0"
                  />
                  <UserAvatar
                    name={u.name}
                    email={u.email}
                    active={u.is_active}
                    className="scale-75 origin-center"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {u.name || "Unnamed"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {u.email || "No email"}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[9px] shrink-0 px-1 py-0">
                    {u.unit_id}
                  </Badge>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-3 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="w-full sm:w-auto text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={busy || selected.length === 0}
            className="w-full sm:w-auto gap-1.5 text-xs font-medium"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Assign {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
