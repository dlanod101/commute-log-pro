import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { loadToken } from "@/lib/api";
import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  beforeLoad: redirectIfAuthenticated,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (loadToken()) {
      navigate({ to: "/app" });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Toaster richColors position="top-center" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-3 py-8 pb-safe sm:px-4 sm:py-12">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="DeyGo logo" className="mx-auto mb-4 h-16 w-auto object-contain" />
          <h1 className="text-2xl font-semibold tracking-tight">DeyGo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage paratransit trips and observations.
          </p>
        </div>
        <AuthPanel />
      </div>
    </div>
  );
}
