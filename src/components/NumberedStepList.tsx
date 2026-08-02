export function NumberedStepList({
  steps,
  variant = "cards",
}: {
  steps: string[] | { title: string; body?: string }[];
  variant?: "cards" | "sections";
}) {
  return (
    <ol className="flex flex-col gap-3 list-none p-0 m-0">
      {steps.map((step, i) => {
        const title = typeof step === "string" ? step : step.title;
        const body = typeof step === "string" ? undefined : step.body;
        if (variant === "sections") {
          return (
            <li
              key={`${i}-${title.slice(0, 24)}`}
              className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4 spotlight"
            >
              <div className="flex gap-3.5 items-start">
                <span className="w-[26px] h-[26px] shrink-0 rounded-full grad-bg text-[#06121A] flex items-center justify-center font-black text-[13px]">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-extrabold text-[15px]">{title}</div>
                  {body && (
                    <p className="text-[14px] text-ink-soft leading-relaxed mt-2 mb-0 whitespace-pre-line">{body}</p>
                  )}
                </div>
              </div>
            </li>
          );
        }
        return (
          <li
            key={`${i}-${title.slice(0, 24)}`}
            className="flex gap-3.5 items-start rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4 spotlight"
          >
            <span className="w-[26px] h-[26px] shrink-0 rounded-full grad-bg text-[#06121A] flex items-center justify-center font-black text-[13px]">
              {i + 1}
            </span>
            <span className="text-[14.5px] leading-relaxed">{title}</span>
          </li>
        );
      })}
    </ol>
  );
}
