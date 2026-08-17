import { useEffect, useState } from "react";
import {
  ApiError,
  createAdminUser,
  loadToken,
  updateAdminUser,
  updateAdminUserRole,
  type AdminRole,
  type AdminUser,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPen, UserPlus } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create new user; otherwise edit this user. */
  user: AdminUser | null;
  isSuperAdmin: boolean;
  onSaved: () => void;
  onSessionExpired: () => void;
};

export function AdminUserDialog({
  open,
  onOpenChange,
  user,
  isSuperAdmin,
  onSaved,
  onSessionExpired,
}: Props) {
  const isEdit = user !== null;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [role, setRole] = useState<AdminRole>("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setIsActive(user?.is_active ?? true);
    setRole(user?.role ?? "user");
    setError(null);
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tok = loadToken();
    if (!tok) {
      onSessionExpired();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isEdit && user) {
        const patch: {
          name?: string | null;
          email?: string;
          password?: string;
          is_active?: boolean;
        } = {};
        if (name !== (user.name ?? "")) patch.name = name || null;
        if (email !== (user.email ?? "")) patch.email = email;
        if (password) patch.password = password;
        if (isActive !== user.is_active) patch.is_active = isActive;
        if (Object.keys(patch).length > 0) await updateAdminUser(tok, user.id, patch);
        if (isSuperAdmin && role !== user.role) {
          await updateAdminUserRole(tok, user.id, role);
        }
      } else {
        await createAdminUser(tok, {
          email,
          password,
          name: name || null,
          role: isSuperAdmin ? role : undefined,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessionExpired();
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update account details and access."
              : "Create a new account. Admins can be given scope to manage it later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-user-name">Name</Label>
            <Input
              id="admin-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Driver"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-user-email">Email</Label>
            <Input
              id="admin-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-user-password">
              {isEdit ? "New password (leave blank to keep)" : "Password"}
            </Label>
            <Input
              id="admin-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "••••••••" : "At least 6 characters"}
              required={!isEdit}
              minLength={isEdit ? undefined : 6}
            />
          </div>
          {isSuperAdmin && (
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {isEdit && (
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Account active</p>
                <p className="text-xs text-muted-foreground">
                  Disabling blocks sign-in and existing tokens.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                <UserPen className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isEdit ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
