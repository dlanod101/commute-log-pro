import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getMe, login, register, saveToken } from "@/lib/api";
import { LogIn, UserPlus } from "lucide-react";

export function AuthPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Email and password required");
      return;
    }
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
    if (!regEmail.trim() || !regPassword) {
      toast.error("Email and password required");
      return;
    }
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
    <Card className="p-6 shadow-card">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>
        <TabsContent value="login" className="mt-4">
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={busy}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="register" className="mt-4">
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-name">Name</Label>
              <Input
                id="reg-name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={busy}>
              <UserPlus className="h-4 w-4" /> Create account
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
