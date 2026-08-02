export function CodeBlock({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      className={
        className ??
        "text-[11.5px] overflow-x-auto p-3 rounded-xl bg-[#060b12] border border-[rgba(255,255,255,0.08)] text-ink-soft m-0 font-mono leading-relaxed"
      }
    >
      {children}
    </pre>
  );
}
