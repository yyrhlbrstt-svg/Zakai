"use client";

import { useTranslations } from "next-intl";

export function PrintButton() {
  const t = useTranslations("authorizationDoc");
  return (
    <button
      onClick={() => window.print()}
      className="grad-bg text-[#06121A] rounded-[12px] px-5 py-2.5 font-extrabold cursor-pointer border-0 print:hidden"
    >
      {t("print")}
    </button>
  );
}
