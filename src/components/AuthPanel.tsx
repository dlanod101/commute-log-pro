import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getMe, login, register, saveToken } from "@/lib/api";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

type LoginErrors = { email?: string; password?: string };
type RegisterErrors = { email?: string; name?: string; password?: string };

export function AuthPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPw, setLoginShowPw] = useState(false);
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});

  const [regEmail, setRegEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPw, setRegShowPw] = useState(false);
  const [regErrors, setRegErrors] = useState<RegisterErrors>({});

  const goToApp = async (email: string, password: string) => {
    const token = await login(email, password);
    saveToken(token.access_token);
    try {
      await getMe(token.access_token);
    } catch {
      /* Token is valid; /app will load profile when online */
    }
    navigate({ to: "/app" });
  };

  const clearLoginError = (field: keyof LoginErrors) =>
    setLoginErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const clearRegError = (field: keyof RegisterErrors) =>
    setRegErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const validateLogin = (): boolean => {
    const errors: LoginErrors = {};
    if (!loginEmail.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_RE.test(loginEmail.trim())) {
      errors.email = "Enter a valid email address";
    }
    if (!loginPassword) {
      errors.password = "Password is required";
    }
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegister = (): boolean => {
    const errors: RegisterErrors = {};
    if (!regEmail.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_RE.test(regEmail.trim())) {
      errors.email = "Enter a valid email address";
    }
    if (!regPassword) {
      errors.password = "Password is required";
    } else if (regPassword.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    setBusy(true);
    try {
      await goToApp(loginEmail.trim(), loginPassword);
      toast.success("Signed in");
      setLoginPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setBusy(true);
    try {
      await register(regEmail.trim(), regName.trim(), regPassword);
      await goToApp(regEmail.trim(), regPassword);
      toast.success("Account created — you're signed in");
      setRegPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6 border bg-card p-6 shadow-elevated sm:p-8">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-6">
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  clearLoginError("email");
                }}
                placeholder="you@example.com"
                className="h-10"
                aria-invalid={!!loginErrors.email}
              />
              {loginErrors.email && <p className="text-xs text-destructive">{loginErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button
                  type="button"
                  onClick={() => toast.info("Contact support to reset your password")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={loginShowPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    clearLoginError("password");
                  }}
                  className="h-10 pr-10"
                  aria-invalid={!!loginErrors.password}
                />
                <button
                  type="button"
                  onClick={() => setLoginShowPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={loginShowPw ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {loginShowPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {loginErrors.password && (
                <p className="text-xs text-destructive">{loginErrors.password}</p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-6">
          <form onSubmit={handleRegister} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => {
                  setRegEmail(e.target.value);
                  clearRegError("email");
                }}
                placeholder="you@example.com"
                className="h-10"
                aria-invalid={!!regErrors.email}
              />
              {regErrors.email && <p className="text-xs text-destructive">{regErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-name">Name</Label>
              <Input
                id="reg-name"
                value={regName}
                onChange={(e) => {
                  setRegName(e.target.value);
                  clearRegError("name");
                }}
                placeholder="Your name (optional)"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={regShowPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => {
                    setRegPassword(e.target.value);
                    clearRegError("password");
                  }}
                  className="h-10 pr-10"
                  aria-invalid={!!regErrors.password}
                />
                <button
                  type="button"
                  onClick={() => setRegShowPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={regShowPw ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {regShowPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {regErrors.password ? (
                <p className="text-xs text-destructive">{regErrors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {busy ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
