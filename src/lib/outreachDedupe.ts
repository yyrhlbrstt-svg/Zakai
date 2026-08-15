/**
 * The same three lines, three times, at the bottom of every letter we send.
 *
 * WHAT THE LETTER ACTUALLY LOOKED LIKE
 *
 * Read for the first time out of a real mailbox — a retention request to
 * Cellcom, composed by the product end to end — the message was 111 words of
 * letter followed by 122 words of machine appendix. In it:
 *
 *   "Machine: POST …/api/pipe/accept"      three times
 *   the institutional pointer               twice, once in Hebrew and once in
 *                                           English, in a Hebrew letter to an
 *                                           Israeli company
 *   the contact address                     five times
 *
 * Nobody wrote that. Three layers each append a footer, and each is right on
 * its own: `letterFooter` adds the institutional pull line because a bare
 * letter needs one; the Mandate block adds it because a forwarded
 * authorization document needs one; `buildOutreachProtocolFooter` adds it
 * because a machine-readable envelope needs one. Composed, a service desk
 * opens a wall of repeated URLs — and the entire footer mechanism depends on
 * surviving to that desk rather than being deleted as spam.
 *
 * WHY DEDUPE AT ASSEMBLY RATHER THAN DELETE FROM THE THREE MODULES
 *
 * Because each module is still correct alone, and each is used alone
 * somewhere. Removing the line from any one of them fixes this composition
 * and silently strips a needed line from another. The composition is where
 * the problem exists, so the composition is where it is solved — and a fourth
 * footer added later is covered without anybody remembering this file.
 *
 * WHAT IT WILL NOT TOUCH
 *
 * Only lines that carry a URL or an address — the machine and contact lines.
 * Prose is never deduplicated: two identical sentences in a letter are the
 * author's business, and a footer cleaner that edits the argument is a much
 * worse bug than the one it fixes.
 */

/** A line that exists for a machine or for routing, not for the reader. */
function isProtocolLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  return /https?:\/\//.test(trimmed) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed);
}

/**
 * What a line says, ignoring the four ways the same thing gets said twice.
 *
 * Exact-match deduplication removed one of five repetitions and left four,
 * because the copies are not byte-identical — they are the same pointer
 * wearing different clothes:
 *
 *   "לאוטומציה: ops@z" vs "contact: ops@z"   — a different label, same address
 *   "…/he/institutions" vs "…/en/institutions" — the same page, two locales,
 *                                                both in a Hebrew letter
 *
 * So lines are compared after dropping a leading label and after flattening
 * the locale segment of any URL. Both normalisations are narrow on purpose:
 * a label is only stripped up to the first colon, and only `/he/`, `/en/`,
 * `/ar/` and `/ru/` count as locale segments. Anything broader would start
 * merging lines that are genuinely different.
 */
function canonical(line: string): string {
  return line
    .trim()
    .replace(/^[^\s:]{1,24}:\s*/u, "")
    .replace(/^[^\s:]+\s[^:]{0,24}:\s*/u, "")
    .replace(/\/(he|en|ar|ru)\//g, "/_/")
    .replace(/\s+/g, " ");
}

export function dedupeOutreachFooterLines(body: string): string {
  const lines = body.split("\n");

  /**
   * The short "Machine: POST …/api/pipe/accept" is a strict prefix of the long
   * one that follows it with the JWKS and pipe URLs appended. Keeping both
   * says the same thing twice, and the longer one says it completely — so a
   * protocol line fully contained in another protocol line is dropped, whether
   * the longer one comes before or after it.
   */
  const protocolCanon = lines.filter(isProtocolLine).map(canonical);
  const subsumed = new Set<string>();
  for (const short of protocolCanon) {
    for (const long of protocolCanon) {
      if (long.length > short.length && long.startsWith(short)) {
        subsumed.add(short);
        break;
      }
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    if (!isProtocolLine(line)) {
      out.push(line);
      continue;
    }
    const key = canonical(line);
    if (subsumed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }

  // Removing lines can leave three blank lines where there were two. A run of
  // blanks is not information, and the gaps are what made the appendix look
  // even longer than it was.
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
