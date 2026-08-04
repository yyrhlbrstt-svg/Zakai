/**
 * The line at the bottom of every letter — and the reason institutions call us
 * instead of the other way round.
 *
 * THE PROBLEM THIS SOLVES, WHICH IS A GO-TO-MARKET PROBLEM AND NOT A TECHNICAL ONE
 *
 * Every letter this product generates lands on the desk of a bank, an insurer,
 * a pension fund, a municipality or the Tax Authority. Thousands of them. And
 * every one arrives anonymous: a well-drafted claim citing the right statute,
 * with nothing on it to say where it came from or that there is a machine-
 * readable way to handle it.
 *
 * So the institution does what it has always done — a person opens it, reads
 * it, checks the identity by hand, and answers. At ten letters a month that is
 * nothing. At ten thousand it is a department, and a department is a budget
 * line somebody is being asked to justify.
 *
 * That is the moment they come looking. Not because we sold to them: because
 * their own customers are generating a volume of manual work that has an
 * obvious cheaper answer, and the footer tells them where it is.
 *
 * WHY THIS IS THE RIGHT DIRECTION OF PRESSURE
 *
 * A cold approach asks an institution to care about a standard. This does the
 * opposite: it lets their own inbox make the argument, and arrives with the
 * volume already in hand. DocuSign spread this way — every recipient of a
 * document became someone who had used it before they ever bought it. So did
 * every payment button. The distribution channel is the consumer product, and
 * each letter is a knock on a door delivered by that institution's own customer
 * rather than by a salesperson.
 *
 * WHAT IT MUST NOT DO, AND THIS IS THE HARD PART
 *
 * It must not claim we vouch for anything. These letters are generated on the
 * person's own device and never reach our servers — that is a real privacy
 * property of the product and the reason no account is needed to use most of
 * it. A per-letter verification code would mean storing every letter, which
 * would destroy exactly that, in exchange for a marketing hook.
 *
 * So the footer stores nothing and looks nothing up. It states two facts that
 * are true without any record on our side: the letter was prepared with this
 * tool, and an institution receiving many of them can handle them
 * automatically. Everything an institution needs is on the page it points at.
 *
 * It also never says the letter is *from* Zakai. It is from the person. We
 * drafted it and they sent it, and a footer implying otherwise would be the
 * agent-claims-it-filed-with-a-government-body failure this codebase forbids.
 */

import { institutionPullFooterLine } from "@/lib/institutionPull";

const DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app";

function origin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_ORIGIN).replace(/\/$/, "");
}

export type FooterLocale = "he" | "en" | "ar" | "ru";

/**
 * The block appended to a generated letter.
 *
 * Deliberately short. A long footer reads as advertising and gets cut before
 * sending, and a footer that is cut is worth nothing — the whole mechanism
 * depends on it surviving to the institution's desk.
 */
export function letterFooter(locale: FooterLocale = "he"): string {
  const url = `${origin()}/${locale === "he" || locale === "ar" ? "he" : "en"}/institutions`;

  const text: Record<FooterLocale, string> = {
    he: [
      "—",
      "המכתב הוכן באמצעות זכאי. הפנייה היא של השולח/ת בלבד.",
      institutionPullFooterLine("he", origin()),
      // Short magnet — full pipe lines live in outbound protocol footer.
      `Machine: POST ${origin()}/api/pipe/accept`,
    ].join("\n"),
    en: [
      "—",
      "Prepared with Zakai. The request is the sender's own.",
      institutionPullFooterLine("en", origin()),
      `Machine: POST ${origin()}/api/pipe/accept`,
    ].join("\n"),
    ar: [
      "—",
      "أُعدّت هذه الرسالة باستخدام زكاي. الطلب يخصّ المُرسِل وحده.",
      `للجهات التي تتلقى الكثير من هذه الرسائل: يمكن التحقق منها والرد عليها آلياً — ${url}`,
    ].join("\n"),
    ru: [
      "—",
      "Письмо подготовлено с помощью Zakai. Обращение принадлежит отправителю.",
      `Организациям, получающим много таких писем: их можно проверять и обрабатывать автоматически — ${url}`,
    ].join("\n"),
  };

  return text[locale];
}

/**
 * Append the footer to a letter body, once.
 *
 * Idempotent because several code paths build on each other's output — the
 * captive letter, the incident notice and the entitlement claim all flow
 * through different assemblers, and a letter carrying the footer twice looks
 * like a bug to precisely the audience it is meant to impress.
 */
export function withFooter(body: string, locale: FooterLocale = "he"): string {
  const footer = letterFooter(locale);
  if (body.includes(`/${locale === "he" || locale === "ar" ? "he" : "en"}/institutions`)) {
    return body;
  }
  return `${body.trimEnd()}\n\n${footer}`;
}
