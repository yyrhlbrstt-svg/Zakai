import { SpotlightCard } from "@/components/SpotlightCard";

export function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <SpotlightCard className="px-4 py-4 h-full">
      <div className="text-[11px] font-extrabold text-ink-soft uppercase tracking-wide">{label}</div>
      <div className="font-display text-2xl mt-1 grad-text">{value}</div>
      <div className="text-[11.5px] text-ink-soft mt-1 leading-snug">{hint}</div>
    </SpotlightCard>
  );
}
