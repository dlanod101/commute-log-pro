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
      <DialogContent className="max-w-md w-full p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg">
            {isEdit ? "Edit user account" : "Create new user"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Update profile information, password, and permissions."
              : "Register an account for field operations or administrative access."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-user-name" className="text-xs">
              Full Name
            </Label>
            <Input
              id="admin-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Driver"
              autoComplete="name"
              autoCapitalize="words"
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-user-email" className="text-xs">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="admin-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. driver@deygo.com"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-user-password" className="text-xs">
              {isEdit ? "New Password (leave blank to keep unchanged)" : "Password"}
              {!isEdit && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="admin-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "••••••••" : "Minimum 6 characters"}
              required={!isEdit}
              minLength={isEdit ? undefined : 6}
              autoComplete={isEdit ? "new-password" : "new-password"}
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs">Account Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (Driver / Field Operator)</SelectItem>
                  <SelectItem value="admin">Admin (Fleet Manager)</SelectItem>
                  <SelectItem value="superadmin">Superadmin (Full Control)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isEdit && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium">Account Status</p>
                <p className="text-[11px] text-muted-foreground">
                  Disabling immediately revokes access and signs the user out.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
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
              type="submit"
              size="sm"
              disabled={busy}
              className="w-full sm:w-auto gap-1.5 text-xs font-medium"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isEdit ? (
                <UserPen className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {isEdit ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
