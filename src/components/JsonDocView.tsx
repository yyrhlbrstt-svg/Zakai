import { Card } from "@/components/ui";

/**
 * Renders a JSON document inside the app's own themed shell instead of a bare
 * browser tab. Raw `target="_blank"` links to /.well-known and /api/* land on
 * some Android/Chrome combinations as an unreadable dark-on-dark blank page
 * (Chrome's "force dark" pass over an unstyled JSON viewer) — this page has
 * real CSS, so it always renders.
 */
export function JsonDocView({ doc }: { doc: unknown }) {
  return (
    <Card className="p-0 overflow-hidden">
      <pre
        dir="ltr"
        className="m-0 p-5 text-[12px] leading-relaxed overflow-x-auto text-ink-soft whitespace-pre-wrap break-words"
      >
        {JSON.stringify(doc, null, 2)}
      </pre>
    </Card>
  );
}
