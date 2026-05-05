type Props = { label: string; value: string; accent?: boolean };

export function TripStatBadge({ label, value, accent }: Props) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent ? "bg-gradient-signal text-signal-foreground border-transparent" : "bg-card"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
