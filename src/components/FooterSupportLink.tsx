import { publicSupportEmail } from "@/lib/contact";

/** Server-rendered support mailto (Footer is a client component). */
export function FooterSupportLink() {
  const email = publicSupportEmail();
  return (
    <a
      href={`mailto:${email}`}
      className="text-body font-bold text-ink-soft hover:text-emerald no-underline transition-colors duration-200"
      dir="ltr"
    >
      {email}
    </a>
  );
}
