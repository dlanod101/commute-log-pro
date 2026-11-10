import { useEffect, useState } from "react";
import { ApiError, deleteAdminUser, fetchAdminUsers, loadToken, type AdminUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminUserDialog } from "./AdminUserDialog";
import { RoleBadge, StatusBadge, UserAvatar } from "./shared";

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

  // Debounce search input
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
      toast.success(`User ${deleting.name || deleting.email} deleted`);
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

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setOffset(0);
  };

  const hasFilters = Boolean(search || roleFilter || statusFilter);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      {/* Action and Filter Controls */}
      <div className="flex flex-col gap-3">
        {/* Top line: Search + Add User */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9 pr-8 h-10 text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            type="button"
            className="h-10 gap-1.5 px-3.5 text-xs sm:text-sm shrink-0 font-medium shadow-sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden min-[400px]:inline">Add user</span>
            <span className="min-[400px]:hidden">Add</span>
          </Button>
        </div>

        {/* Filter selectors row */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roleFilter || "all"}
            onValueChange={(v) => {
              setRoleFilter(v === "all" ? "" : v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="h-9 flex-1 min-w-[130px] sm:w-36 text-xs sm:text-sm">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="superadmin">Superadmin</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => {
              setStatusFilter(v === "all" ? "" : v);
              setOffset(0);
            }}
          >
            <SelectTrigger className="h-9 flex-1 min-w-[130px] sm:w-36 text-xs sm:text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="true">Active only</SelectItem>
              <SelectItem value="false">Disabled only</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Refresh users"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Result Count and Page info */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-0.5">
        <span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating…
            </span>
          ) : (
            <>
              Found <strong className="text-foreground">{total}</strong> account
              {total === 1 ? "" : "s"}
            </>
          )}
        </span>
        <span>
          Page {page} of {pageCount}
        </span>
      </div>

      {/* Mobile Users Feed (md:hidden) */}
      <div className="space-y-3 md:hidden">
        {loading && users.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <p className="text-sm font-medium">Loading user accounts…</p>
          </Card>
        )}

        {!loading && users.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold">No users found</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              {hasFilters
                ? "No accounts match the current filter or search criteria."
                : "No accounts exist in the fleet database yet."}
            </p>
            <div className="mt-4 flex gap-2">
              {hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add user
                </Button>
              )}
            </div>
          </Card>
        )}

        {users.map((u) => (
          <Card key={u.id} className="overflow-hidden border p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <UserAvatar name={u.name} email={u.email} active={u.is_active} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {u.name || "Unnamed user"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span>{u.email || "No email"}</span>
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <StatusBadge active={u.is_active} />
            </div>

            {/* Badges row */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t">
              <RoleBadge role={u.role} />
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                Unit: {u.unit_id}
              </Badge>
            </div>

            {/* Actions row */}
            <div className="mt-3 pt-2.5 border-t flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none h-9 text-xs gap-1.5 font-medium"
                onClick={() => {
                  setEditing(u);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                onClick={() => setDeleting(u)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop Users Table (hidden md:block) */}
      <Card className="hidden md:block overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12"></TableHead>
              <TableHead>User / Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead className="w-28">Role</TableHead>
              <TableHead className="w-32">Unit ID</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading users…
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  No users match the search criteria.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="pl-4">
                  <UserAvatar name={u.name} email={u.email} active={u.is_active} />
                </TableCell>
                <TableCell className="font-medium text-sm">{u.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">
                  {u.email || "—"}
                </TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {u.unit_id}
                </TableCell>
                <TableCell>
                  <StatusBadge active={u.is_active} />
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit user"
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
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete user"
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

      {/* Pagination Footer */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-2">
        <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          Showing {users.length > 0 ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)} of{" "}
          {total} users
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs px-3"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-xs font-medium px-2">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1 text-xs px-3"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit/Add Dialog */}
      <AdminUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editing}
        isSuperAdmin={isSuperAdmin}
        onSaved={reloadFromSave}
        onSessionExpired={onSessionExpired}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user account?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will permanently delete <strong>{deleting?.name || deleting?.email}</strong> (
              {deleting?.unit_id}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
