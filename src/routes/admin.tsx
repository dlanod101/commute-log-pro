import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { requireAuth } from "@/lib/auth-guard";
import { ApiError, fetchAdminUsers, fetchAdmins, loadToken, saveToken } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldAlert,
  Loader2,
  LogOut,
  ArrowLeft,
  Users,
  Route as RouteIcon,
  Crown,
} from "lucide-react";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminTripsTab } from "@/components/admin/AdminTripsTab";
import { AdminAdminsTab } from "@/components/admin/AdminAdminsTab";

export const Route = createFileRoute("/admin")({
  beforeLoad: requireAuth,
  component: AdminPage,
});

type AccessState =
  { status: "checking" } | { status: "authorized"; isSuperAdmin: boolean } | { status: "denied" };

function AdminPage() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<AccessState>({ status: "checking" });
  const [tab, setTab] = useState<"users" | "trips" | "admins">("users");

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      navigate({ to: "/" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await fetchAdminUsers(token, { limit: 1 });
        let isSuperAdmin = false;
        try {
          await fetchAdmins(token);
          isSuperAdmin = true;
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 403)) throw err;
        }
        if (!cancelled) setAccess({ status: "authorized", isSuperAdmin });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          saveToken(null);
          navigate({ to: "/" });
          return;
        }
        if (!cancelled) setAccess({ status: "denied" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const signOut = () => {
    saveToken(null);
    navigate({ to: "/" });
  };

  const handleSessionExpired = () => {
    saveToken(null);
    navigate({ to: "/" });
  };

  if (access.status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium">Verifying admin access…</p>
            <p className="text-xs text-muted-foreground">Connecting to DeyGo console</p>
          </div>
        </div>
      </div>
    );
  }

  if (access.status === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-3">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold sm:text-2xl">Admin access required</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
          Your account doesn't have administrative privileges. Contact a fleet superadmin to request
          access.
        </p>
        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs sm:flex-row sm:justify-center">
          <Button className="gap-2 w-full sm:w-auto" onClick={() => navigate({ to: "/app" })}>
            <ArrowLeft className="h-4 w-4" /> Back to field app
          </Button>
          <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  const isSuper = access.isSuperAdmin;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />

      {/* Responsive sticky header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pt-safe">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Left: Branding & Role */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold sm:text-base">Admin Console</span>
                <Badge
                  variant={isSuper ? "default" : "secondary"}
                  className="hidden text-[10px] uppercase font-semibold tracking-wider min-[420px]:inline-flex px-1.5 py-0"
                >
                  {isSuper ? (
                    <>
                      <Crown className="mr-0.5 h-2.5 w-2.5" /> Superadmin
                    </>
                  ) : (
                    "Admin"
                  )}
                </Badge>
              </div>
              <p className="hidden text-[11px] text-muted-foreground sm:block truncate">
                DeyGo paratransit fleet management
              </p>
            </div>
          </div>

          {/* Right: Quick Navigation Actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
              onClick={() => navigate({ to: "/app" })}
              title="Return to Field App"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden min-[480px]:inline">Back to app</span>
              <span className="min-[480px]:hidden">App</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm text-muted-foreground hover:text-foreground"
              onClick={signOut}
              title="Sign out of console"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main dashboard container */}
      <main className="mx-auto max-w-6xl px-3 py-4 pb-28 sm:px-6 sm:py-6 sm:pb-safe">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "users" | "trips" | "admins")}
          className="space-y-4"
        >
          {/* Responsive Segmented Tabs */}
          <div className="w-full">
            <TabsList
              className={`grid w-full ${isSuper ? "grid-cols-3" : "grid-cols-2"} sm:w-auto sm:inline-grid h-11 p-1`}
            >
              <TabsTrigger value="users" className="gap-1.5 h-9 text-xs sm:text-sm font-medium">
                <Users className="h-4 w-4 shrink-0" />
                <span>Users</span>
              </TabsTrigger>
              <TabsTrigger value="trips" className="gap-1.5 h-9 text-xs sm:text-sm font-medium">
                <RouteIcon className="h-4 w-4 shrink-0" />
                <span>Trips</span>
              </TabsTrigger>
              {isSuper && (
                <TabsTrigger value="admins" className="gap-1.5 h-9 text-xs sm:text-sm font-medium">
                  <Shield className="h-4 w-4 shrink-0" />
                  <span>Admins</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="users" className="mt-0 outline-none">
            <AdminUsersTab isSuperAdmin={isSuper} onSessionExpired={handleSessionExpired} />
          </TabsContent>

          <TabsContent value="trips" className="mt-0 outline-none">
            <AdminTripsTab onSessionExpired={handleSessionExpired} />
          </TabsContent>

          {isSuper && (
            <TabsContent value="admins" className="mt-0 outline-none">
              <AdminAdminsTab onSessionExpired={handleSessionExpired} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
