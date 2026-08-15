export function CodeBlock({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      /* A code block that scrolls sideways and cannot be focused is
         unreachable by keyboard: everything past the right edge does not
         exist for anyone not using a mouse. */
      tabIndex={0}
      className={
        className ??
        "text-[11.5px] overflow-x-auto p-3 rounded-xl bg-[#060b12] border border-[rgba(255,255,255,0.08)] text-ink-soft m-0 font-mono leading-relaxed"
      }
    >
      {children}
    </pre>
  );
}
