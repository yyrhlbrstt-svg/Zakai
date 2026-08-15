import { describe, expect, it } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui";

/**
 * A button must not submit a form by accident.
 *
 * HTML makes an unlabelled <button> inside a <form> a submit button. In this
 * app most buttons run an onClick, so any that happened to sit inside a form
 * silently submitted it — a full page reload landing the reader back at the
 * top with nothing changed. That is indistinguishable from a button that does
 * nothing, and it is precisely how it was reported: "I press it and it just
 * goes to the top of the page."
 *
 * The shared Button now defaults to type="button". This holds that default in
 * place, because it is invisible in review: deleting it reintroduces a bug
 * whose symptom appears on pages nowhere near the change.
 *
 * These assertions render the component rather than reading its source. An
 * earlier draft grepped ui.tsx for `type="button"` and passed with the fix
 * removed — RadioChips has always hardcoded that string, so the regex was
 * matching a different component entirely. A guard that cannot fail is worse
 * than no guard, because it is believed.
 */
const markup = (props: React.ComponentProps<typeof Button>) =>
  renderToStaticMarkup(React.createElement(Button, props));

describe("shared Button", () => {
  it("renders type=button when the caller says nothing", () => {
    expect(markup({ children: "פעולה" })).toContain('type="button"');
  });

  it("still lets a form's real submit button opt in", () => {
    expect(markup({ type: "submit", children: "שלח" })).toContain('type="submit"');
  });

  it("keeps the default for the ghost variant too", () => {
    expect(markup({ variant: "ghost", children: "פעולה" })).toContain('type="button"');
  });
});
