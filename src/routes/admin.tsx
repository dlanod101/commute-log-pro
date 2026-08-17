import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { requireAuth } from "@/lib/auth-guard";
import { ApiError, fetchAdminUsers, fetchAdmins, loadToken, saveToken } from "@/lib/api";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  ShieldAlert,
  Loader2,
  LogOut,
  ArrowLeft,
  Users,
  Route as RouteIcon,
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
        </div>
      </div>
    );
  }

  if (access.status === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your account doesn't have admin privileges. Ask a superadmin to assign you access.
        </p>
        <Button className="mt-6 gap-1.5" onClick={() => navigate({ to: "/app" })}>
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-20 border-b bg-background/80 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Shield className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-none sm:text-base">
                Admin console
              </h1>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                {access.isSuperAdmin ? "Superadmin" : "Admin"} · DeyGo fleet management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden gap-1 text-xs sm:inline-flex"
              onClick={() => navigate({ to: "/app" })}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to app
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-6 pb-safe sm:px-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "users" | "trips" | "admins")}>
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-3">
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden min-[360px]:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="trips" className="gap-1.5">
              <RouteIcon className="h-4 w-4" />
              <span className="hidden min-[360px]:inline">Trips</span>
            </TabsTrigger>
            {access.isSuperAdmin && (
              <TabsTrigger value="admins" className="gap-1.5">
                <Shield className="h-4 w-4" />
                <span className="hidden min-[360px]:inline">Admins</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="mt-5">
            <AdminUsersTab
              isSuperAdmin={access.isSuperAdmin}
              onSessionExpired={handleSessionExpired}
            />
          </TabsContent>
          <TabsContent value="trips" className="mt-5">
            <AdminTripsTab onSessionExpired={handleSessionExpired} />
          </TabsContent>
          {access.isSuperAdmin && (
            <TabsContent value="admins" className="mt-5">
              <AdminAdminsTab onSessionExpired={handleSessionExpired} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
