import { Badge } from "@/components/ui/badge";
import type { AdminRole } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const ROLE_STYLES: Record<AdminRole, string> = {
  user: "border-transparent bg-secondary text-secondary-foreground font-medium",
  admin: "border-transparent bg-primary text-primary-foreground font-medium",
  superadmin: "border-transparent bg-signal text-signal-foreground font-medium",
};

export function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <Badge className={cn(ROLE_STYLES[role] ?? ROLE_STYLES.user, "capitalize text-xs")}>
      {role}
    </Badge>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-xs font-medium px-2 py-0.5",
        active
          ? "border-success/40 bg-success/10 text-success dark:bg-success/20"
          : "border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          active ? "bg-success" : "bg-destructive",
        )}
      />
      {active ? "Active" : "Disabled"}
    </Badge>
  );
}

export function TripStatusBadge({ status }: { status?: string | null }) {
  const isCompleted = status?.toLowerCase() === "completed";
  const isOngoing = status?.toLowerCase() === "ongoing";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-xs font-medium px-2 py-0.5 capitalize shrink-0",
        isCompleted && "border-success/40 bg-success/10 text-success dark:bg-success/20",
        isOngoing && "border-signal/50 bg-signal/15 text-signal-foreground animate-pulse",
        !isCompleted && !isOngoing && "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          isCompleted && "bg-success",
          isOngoing && "bg-signal",
          !isCompleted && !isOngoing && "bg-muted-foreground",
        )}
      />
      {status || "Unknown"}
    </Badge>
  );
}

export function UserAvatar({
  name,
  email,
  active,
  className,
}: {
  name?: string | null;
  email?: string | null;
  active?: boolean;
  className?: string;
}) {
  const initials = (name || email || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary select-none">
        {initials}
      </div>
      {active !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            active ? "bg-success" : "bg-destructive",
          )}
          title={active ? "Active" : "Disabled"}
        />
      )}
    </div>
  );
}

export function StatMetric({
  icon: Icon,
  label,
  value,
  sublabel,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sublabel?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const isClickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-xl border bg-card p-3 transition-colors",
        isClickable && "cursor-pointer hover:bg-muted/50 active:scale-[0.99]",
        active && "ring-2 ring-primary border-transparent bg-primary/5",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground truncate">{sublabel}</p>}
      </div>
    </div>
  );
}
