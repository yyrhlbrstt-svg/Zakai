import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-serve registration for an agent that wants to ask people for authority.
 *
 * WHY IT HAS TO BE SELF-SERVE
 *
 * Until now an `AgentClient` row was inserted by hand. A door that opens only
 * from the inside is not a door, and "every agent goes through us" is not a
 * strategy if going through us requires knowing us.
 *
 * WHY IT LANDS AS `pending` AND NOT `approved`
 *
 * Anyone can register; nobody can ask a person for anything until a human here
 * has looked. That order matters. Registration is cheap and reversible, so it
 * should be open. Being allowed to appear on a consent screen — with your name
 * next to the words "is asking for permission to act for you" — is the thing
 * with a cost, and it is borrowed from Zakai's credibility rather than earned
 * by filling in a form.
 *
 * The registrant learns exactly that, immediately, rather than discovering it
 * when their first authorize call returns `agent_not_approved`.
 */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

const schema = z.object({
  slug: z.string().trim().toLowerCase(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  contact: z.string().trim().email().max(160),
  redirect_uris: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
});

/** Same rule the authorization check enforces, applied at the door. */
function transportOk(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export async function POST(request: Request) {
  const limited = await rateLimit("agent-register", clientIp(request), 5, 3600);
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const data = parsed.data;

  if (!SLUG.test(data.slug)) {
    return NextResponse.json(
      { error: "invalid_slug", detail: "3–40 chars, lowercase letters, digits and hyphens." },
      { status: 400 },
    );
  }
  for (const uri of data.redirect_uris) {
    if (!transportOk(uri)) {
      return NextResponse.json(
        { error: "redirect_insecure", detail: `Not https, and not localhost: ${uri}` },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.agentClient.findUnique({ where: { slug: data.slug } });
  if (existing) return NextResponse.json({ error: "slug_taken" }, { status: 409 });

  await prisma.agentClient.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description,
      contact: data.contact,
      redirectUris: [...new Set(data.redirect_uris)],
      status: "pending",
    },
  });

  return NextResponse.json(
    {
      agent: data.slug,
      status: "pending",
      /**
       * Said plainly, at the moment of registering, because the alternative is
       * an integrator building the whole flow and hitting `agent_not_approved`
       * on their first real call with no idea why.
       */
      note:
        "Registered. You cannot ask anyone for authority until this is approved — " +
        "your name would appear on a consent screen beside the words 'is asking " +
        "for permission to act for you', and that is reviewed by a human.",
      sandbox: `${SITE_URL}/api/mandate/sandbox/issue`,
      docs: `${SITE_URL}/.well-known/zakai-agent-authorization.json`,
    },
    { status: 201 },
  );
}
