"use client";

import { useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";

/**
 * What to do now — said once, at the end, in the reader's words.
 *
 * WHAT THIS IS FOR
 *
 * Nineteen tool pages let somebody arrive believing they are owed money and
 * leave holding arithmetic. Measured on a phone, nine of them had no onward
 * path at all: not a link, not an official form, nothing. You would fill in
 * your income, press "prepare the letter", read a letter addressed to the
 * Tax Authority — and the page simply ended. Whoever wrote each one knew what
 * happened next. The reader never did.
 *
 * The rule this exists to keep is already written down in CLAUDE.md: a page
 * gets a path to action — a letter, a check, or an external official tool —
 * and never an empty CTA. Note the third one. Sending somebody to a real
 * government form is a complete answer, not a failure to keep them here, and
 * this renders that as the primary action without apology.
 *
 * DELIBERATELY SMALL
 *
 * Two or three short lines and one button. The screens this lands on already
 * carry four paragraphs of grey small print each; a next step that arrives as
 * a fifth is not a next step. If it does not fit in three lines, the page
 * does not know what the next step is, and that is worth finding out before
 * writing anything.
 */
export interface NextStepAction {
  label: string;
  href: string;
  /** True for a government form or regulator — opens in a new tab. */
  external?: boolean;
}

export function NextStep({
  steps,
  action,
  note,
  title,
}: {
  /** Two or three short sentences. Not a paragraph. */
  steps: string[];
  action?: NextStepAction;
  /** One qualifying line, when the action needs a caveat to be honest. */
  note?: string;
  /**
   * A heading specific to this page, when it has one worth keeping.
   * "How you actually get the money — step by step" says more than "What now",
   * and a page that already knows its own answer should not be flattened into
   * the generic one.
   */
  title?: string;
}) {
  const t = useTranslations("nextStep");
  const lines = steps.filter((s) => s.trim().length > 0);
  if (lines.length === 0 && !action) return null;

  return (
    <Card className="mt-5 p-6">
      <div className="font-extrabold text-lead mb-3">{title ?? t("title")}</div>
      <ol className="m-0 ps-0 list-none flex flex-col gap-2.5">
        {lines.map((line, i) => (
          <li key={`${i}-${line}`} className="flex gap-3 items-baseline">
            <span
              className="shrink-0 grid place-items-center w-6 h-6 rounded-full bg-[rgba(63,203,155,0.14)] text-emerald font-extrabold text-caption"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="text-body leading-relaxed">{line}</span>
          </li>
        ))}
      </ol>

      {action &&
        (action.external ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline block mt-4"
          >
            <Button className="w-full">{action.label}</Button>
          </a>
        ) : (
          <Link href={action.href} className="no-underline block mt-4">
            <Button className="w-full">{action.label}</Button>
          </Link>
        ))}

      {note && <p className="text-caption text-ink-soft mt-3 mb-0 leading-relaxed">{note}</p>}
    </Card>
  );
}
