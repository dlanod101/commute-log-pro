import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { loadToken } from "@/lib/api";
import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { Toaster } from "@/components/ui/sonner";
import { CloudUpload, Database, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: redirectIfAuthenticated,
  component: AuthPage,
});

const FEATURES = [
  {
    icon: MapPin,
    title: "GPS trip recording",
    description: "Track paratransit trips with location data, even offline.",
  },
  {
    icon: CloudUpload,
    title: "Upload to the web",
    description: "Sync completed trips and observations to the cloud.",
  },
  {
    icon: Database,
    title: "My data",
    description: "Review and download your trip records anytime.",
  },
];

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (loadToken()) {
      navigate({ to: "/app" });
    }
  }, [navigate]);

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
        {/* Branding panel — desktop only */}
        <aside className="relative hidden overflow-hidden bg-gradient-hero lg:flex lg:flex-col lg:px-12 lg:py-12 xl:px-16 xl:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-signal opacity-15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          />

          <div className="relative flex items-center gap-3">
            <img
              src="/logo.png"
              alt="DeyGo logo"
              className="h-12 w-auto object-contain drop-shadow"
            />
            <span className="text-2xl font-semibold tracking-tight text-white">DeyGo</span>
          </div>

          <div className="relative my-auto py-12">
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
              Paratransit trip recording, done right.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/75">
              DeyGo helps operators capture trips, observations, and GPS data in the field — even
              when you're offline.
            </p>

            <ul className="mt-10 space-y-6">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                    <feature.icon className="h-5 w-5 text-accent" />
                  </span>
                  <span>
                    <span className="block font-medium text-white">{feature.title}</span>
                    <span className="mt-0.5 block text-sm text-white/70">
                      {feature.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/50">
            © 2026 DeyGo. Field app for paratransit operations.
          </p>
        </aside>

        {/* Form column */}
        <main className="flex min-h-screen flex-col justify-center px-4 py-10 pb-safe sm:px-8 lg:px-12">
          {/* Compact header — mobile / tablet */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <img src="/logo.png" alt="DeyGo logo" className="h-10 w-auto object-contain" />
            <h1 className="text-xl font-semibold tracking-tight">DeyGo</h1>
          </div>

          <div className="mx-auto w-full max-w-md text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome back — manage your paratransit trips and observations.
            </p>
            <AuthPanel />
          </div>
        </main>
      </div>
    </>
  );
}
