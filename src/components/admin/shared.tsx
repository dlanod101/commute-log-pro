import { Badge } from "@/components/ui/badge";
import type { AdminRole } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<AdminRole, string> = {
  user: "border-transparent bg-secondary text-secondary-foreground",
  admin: "border-transparent bg-primary text-primary-foreground",
  superadmin: "border-transparent bg-signal text-signal-foreground",
};

export function RoleBadge({ role }: { role: AdminRole }) {
  return <Badge className={cn(ROLE_STYLES[role] ?? ROLE_STYLES.user, "capitalize")}>{role}</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        active ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-success" : "bg-destructive")} />
      {active ? "Active" : "Disabled"}
    </Badge>
  );
}
