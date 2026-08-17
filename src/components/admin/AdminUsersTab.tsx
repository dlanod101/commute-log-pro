import { useEffect, useState } from "react";
import { ApiError, deleteAdminUser, fetchAdminUsers, loadToken, type AdminUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminUserDialog } from "./AdminUserDialog";
import { RoleBadge, StatusBadge } from "./shared";

const PAGE_SIZE = 20;

type Props = {
  isSuperAdmin: boolean;
  onSessionExpired: () => void;
};

export function AdminUsersTab({ isSuperAdmin, onSessionExpired }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setLoading(true);
    fetchAdminUsers(tok, {
      search: search || undefined,
      role: roleFilter || undefined,
      is_active: statusFilter ? statusFilter === "true" : undefined,
      offset,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setUsers(res.users ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          onSessionExpired();
          toast.error("Session expired — sign in again");
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
  }, [search, roleFilter, statusFilter, offset, refreshTick, onSessionExpired]);

  const reloadFromSave = () => {
    setOffset(0);
    setSearchInput("");
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setRefreshTick((t) => t + 1);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteAdminUser(tok, deleting.id);
      toast.success("User deleted");
      setDeleting(null);
      setOffset(0);
      setUsers((u) => u.filter((x) => x.id !== deleting.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
      } else {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or email…"
              className="pl-8"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="superadmin">Superadmin</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
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
        <Button
          type="button"
          className="gap-1.5 self-start sm:self-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                  {u.unit_id}
                </TableCell>
                <TableCell>
                  <StatusBadge active={u.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit"
                      onClick={() => {
                        setEditing(u);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleting(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} user{total === 1 ? "" : "s"} · page {page} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      <AdminUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editing}
        isSuperAdmin={isSuperAdmin}
        onSaved={reloadFromSave}
        onSessionExpired={onSessionExpired}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleting?.email || deleting?.name}</strong> and all
              of their recorded data, observations, and assignments. This cannot be undone. Consider
              disabling the account instead for a reversible option.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
