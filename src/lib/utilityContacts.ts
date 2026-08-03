/**
 * Public customer-service inboxes for IL electricity / insurance brands.
 * Prefer official sites if unsure — these unlock scan → case without a bounce.
 */

const ELECTRICITY_INBOX: Record<string, string> = {
  iec: "service@iec.co.il",
  "חברת החשמל": "service@iec.co.il",
  "israel electric": "service@iec.co.il",
  pazgas: "service@pazgas.co.il",
  "paz gas": "service@pazgas.co.il",
  "partner power": "service@partner.co.il",
  "פרטנר פאוור": "service@partner.co.il",
  cellcomenergy: "service@cellcom.co.il",
  "סלקום אנרגיה": "service@cellcom.co.il",
  bezeqenergy: "service@bezeq.co.il",
  "בזק אנרגיה": "service@bezeq.co.il",
  electra: "service@electra-power.co.il",
  "אלקטרה פאוור": "service@electra-power.co.il",
};

const INSURANCE_INBOX: Record<string, string> = {
  harel: "service@harel-group.co.il",
  הראל: "service@harel-group.co.il",
  migdal: "service@migdal.co.il",
  מגדל: "service@migdal.co.il",
  phoenix: "service@fnx.co.il",
  הפניקס: "service@fnx.co.il",
  clal: "service@clalbit.co.il",
  כלל: "service@clalbit.co.il",
  menora: "service@menoramivt.co.il",
  מנורה: "service@menoramivt.co.il",
  aig: "service@aig.co.il",
  "ש. שלמה": "service@shaham.co.il",
  shirbit: "service@shirbit.co.il",
};

function lookup(map: Record<string, string>, raw: string): string | null {
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  if (map[n]) return map[n]!;
  for (const [k, email] of Object.entries(map)) {
    if (n.includes(k.toLowerCase()) || k.toLowerCase().includes(n)) return email;
  }
  return null;
}

export function resolveElectricityContactEmail(merchantOrKey: string): string | null {
  return lookup(ELECTRICITY_INBOX, merchantOrKey);
}

export function resolveInsuranceContactEmail(merchantOrKey: string): string | null {
  return lookup(INSURANCE_INBOX, merchantOrKey);
}
