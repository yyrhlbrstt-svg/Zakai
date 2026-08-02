import type { ReactNode } from "react";

export function SectionHeading({
  title,
  description,
  className,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <header className={className ?? "mt-12 mb-4"}>
      <Tag className="font-display text-2xl m-0">{title}</Tag>
      {description && (
        <p className="text-ink-soft text-[14px] leading-relaxed mt-2 mb-0 max-w-[640px]">{description}</p>
      )}
    </header>
  );
}
