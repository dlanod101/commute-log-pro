type Props = { label: string; value: string; accent?: boolean };

export function TripStatBadge({ label, value, accent }: Props) {
  return (
    <div
      className={`rounded-xl border p-2.5 sm:p-3 ${
        accent ? "bg-gradient-signal text-signal-foreground border-transparent" : "bg-card"
      }`}
    >
      <div className="text-[9px] uppercase tracking-widest opacity-70 sm:text-[10px]">{label}</div>
      <div className="font-mono text-base font-semibold tabular-nums sm:text-lg">{value}</div>
    </div>
  );
}
