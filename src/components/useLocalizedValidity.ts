"use client";

import { useTranslations } from "next-intl";
import type { FormEvent } from "react";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Make the browser's own validation bubble speak the page's language.
 *
 * Every required field in this product relies on native constraint
 * validation, and the native bubble's wording comes from the *browser's* UI
 * language, not the page's. On an Israeli phone set to English — extremely
 * common — the Hebrew signup form answers an empty field with "Please fill
 * out this field.". The QA sweep of 2026-08-21 caught exactly that on
 * /login, /signup and /contact. It is not a crash and nothing breaks, which
 * is precisely why it survives: it just quietly reads as a form somebody
 * else built, on the one screen where a stranger is deciding whether to hand
 * this product their bank details.
 *
 * `setCustomValidity` overrides the wording. The trap it carries is that a
 * custom message makes the field permanently invalid until it is cleared, so
 * the field would stay rejected even after being filled correctly — hence
 * the paired `onInput`, which clears it on every keystroke before the next
 * validity check runs.
 *
 * Spread the result on the <form>: React's synthetic `onInvalid` bubbles even
 * though the native event does not, so one handler covers every field inside.
 */
export function useLocalizedValidity() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");

  return {
    onInvalid: (event: FormEvent<HTMLFormElement>) => {
      const el = event.target as Field;
      if (!("validity" in el)) return;
      if (el.validity.valueMissing) el.setCustomValidity(t("required"));
      else if (el.validity.typeMismatch && (el as HTMLInputElement).type === "email")
        el.setCustomValidity(tAuth("invalidEmail"));
      else if (el.validity.typeMismatch && (el as HTMLInputElement).type === "tel")
        el.setCustomValidity(tAuth("invalidPhone"));
      // Anything else keeps the browser's wording: a made-up message is worse
      // than a foreign one when we do not know what the constraint was.
      else el.setCustomValidity("");
    },
    onInput: (event: FormEvent<HTMLFormElement>) => {
      const el = event.target as Field;
      if ("setCustomValidity" in el) el.setCustomValidity("");
    },
  };
}
