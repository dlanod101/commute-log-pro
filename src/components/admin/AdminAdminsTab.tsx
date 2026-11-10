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
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  RefreshCw,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminAssignUsersDialog } from "./AdminAssignUsersDialog";
import { RoleBadge, UserAvatar } from "./shared";

type Props = {
  onSessionExpired: () => void;
};

const MAX_PREVIEW_USERS = 8;

function AdminCard({
  admin,
  assignedUsers,
  onAssign,
  onRemove,
  removingKey,
}: {
  admin: AdminUser;
  assignedUsers: AdminUser[];
  onAssign: (admin: AdminUser) => void;
  onRemove: (adminId: number, userId: number) => void;
  removingKey: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = assignedUsers.length;
  const visibleUsers = expanded ? assignedUsers : assignedUsers.slice(0, MAX_PREVIEW_USERS);
  const hasMore = total > MAX_PREVIEW_USERS;

  return (
    <Card className="flex flex-col p-4 shadow-sm border">
      {/* Admin header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <UserAvatar
            name={admin.name}
            email={admin.email}
            active={admin.is_active}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{admin.name || "Unnamed Admin"}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              <Mail className="h-3 w-3 shrink-0" />
              <span>{admin.email || "No email"}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <RoleBadge role={admin.role} />
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                Unit: {admin.unit_id}
              </Badge>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 h-8 text-xs font-medium"
          onClick={() => onAssign(admin)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Assign</span>
        </Button>
      </div>

      {/* Assigned users section */}
      <div className="mt-4 border-t pt-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assigned Users ({total})
          </p>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  +{total - MAX_PREVIEW_USERS} more <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>

        {total === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic">
            No regular users assigned yet. Tap "Assign" to grant access to view drivers.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {visibleUsers.map((u) => {
              const key = `${admin.id}:${u.id}`;
              const isRemoving = removingKey === key;
              return (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 pl-2.5 pr-1.5 py-0.5 text-xs font-medium"
                >
                  <span className="max-w-[11rem] truncate">{u.name || u.email || u.unit_id}</span>
                  <button
                    type="button"
                    title={`Remove ${u.name || u.email} from ${admin.name}`}
                    onClick={() => onRemove(admin.id, u.id)}
                    disabled={removingKey !== null}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                  >
                    {isRemoving ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
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
}

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

  return (
    <div className="space-y-4">
      {/* Header Info & Refresh */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">Admin Assignments</h2>
          <p className="text-xs text-muted-foreground">
            Manage administrative scope and which fleet users each admin oversees.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Refresh admins"
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

      {loading && admins.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium">Loading administrative accounts…</p>
        </Card>
      )}

      {!loading && admins.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Shield className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold">No admins found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No other administrators or superadministrators have been created yet.
          </p>
        </Card>
      )}

      {/* Admins Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {admins.map((admin) => (
          <AdminCard
            key={admin.id}
            admin={admin}
            assignedUsers={assigned[admin.id] ?? []}
            onAssign={setAssigning}
            onRemove={remove}
            removingKey={removingKey}
          />
        ))}
      </div>

      {/* Assign Users Dialog */}
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
