import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchAdminAssignedUsers,
  fetchAdmins,
  loadToken,
  removeAdminAssignment,
  type AdminUser,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AdminAssignUsersDialog } from "./AdminAssignUsersDialog";
import { RoleBadge } from "./shared";

type Props = {
  onSessionExpired: () => void;
};

export function AdminAdminsTab({ onSessionExpired }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [assigned, setAssigned] = useState<Record<number, AdminUser[]>>({});
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [assigning, setAssigning] = useState<AdminUser | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        toast.error("Session expired — sign in again");
        return;
      }
      toast.error(err instanceof Error ? err.message : fallback);
    },
    [onSessionExpired],
  );

  useEffect(() => {
    let cancelled = false;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setLoading(true);
    fetchAdmins(tok)
      .then(async (list) => {
        if (cancelled) return;
        const adminsList = Array.isArray(list) ? list : [];
        setAdmins(adminsList);
        const entries = await Promise.all(
          adminsList.map(async (a) => {
            try {
              const users = await fetchAdminAssignedUsers(tok, a.id);
              return [a.id, Array.isArray(users) ? users : []] as const;
            } catch {
              return [a.id, []] as const;
            }
          }),
        );
        if (!cancelled) setAssigned(Object.fromEntries(entries));
      })
      .catch((err) => {
        if (!cancelled) handleApiError(err, "Failed to load admins");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, onSessionExpired, handleApiError]);

  const remove = async (adminId: number, userId: number) => {
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    const key = `${adminId}:${userId}`;
    setRemovingKey(key);
    try {
      await removeAdminAssignment(tok, adminId, userId);
      setAssigned((prev) => ({
        ...prev,
        [adminId]: (prev[adminId] ?? []).filter((u) => u.id !== userId),
      }));
      toast.success("Assignment removed");
    } catch (err) {
      handleApiError(err, "Failed to remove assignment");
    } finally {
      setRemovingKey(null);
    }
  };

  const reloadFromSave = () => {
    setRefreshTick((t) => t + 1);
  };

  if (loading && admins.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading admins…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage admins and superadmins and the users each one can see.
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Refresh"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {admins.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No admins or superadmins found.
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {admins.map((admin) => {
          const assignedUsers = assigned[admin.id] ?? [];
          return (
            <Card key={admin.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{admin.name || "—"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {admin.email || "No email"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <RoleBadge role={admin.role} />
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {admin.unit_id}
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setAssigning(admin)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Assign users
                </Button>
              </div>

              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Assigned users · {assignedUsers.length}
                </p>
                {assignedUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No users assigned yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedUsers.map((u) => {
                      const key = `${admin.id}:${u.id}`;
                      return (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs"
                        >
                          <span className="max-w-[10rem] truncate">
                            {u.name || u.email || u.unit_id}
                          </span>
                          <button
                            type="button"
                            title="Remove assignment"
                            onClick={() => remove(admin.id, u.id)}
                            disabled={removingKey !== null}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                          >
                            {removingKey === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <AdminAssignUsersDialog
        admin={assigning}
        open={assigning !== null}
        onOpenChange={(open) => {
          if (!open) setAssigning(null);
        }}
        onSaved={reloadFromSave}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
