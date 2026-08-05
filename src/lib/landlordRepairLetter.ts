/**
 * Tenant demand letter for a landlord to fix a material defect — Rental and
 * Lending Law (חוק השכירות והשאילה), which obligates a landlord to maintain
 * the property fit for its intended use and repair defects not caused by
 * the tenant. This is a demand for ACTION, not a refund: amountShekels is
 * only ever the tenant's own estimate of repair cost if they end up paying
 * for it themselves and seeking reimbursement — 0 is honest when there's
 * no such estimate, never a guess.
 */

export interface LandlordRepairInput {
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  defectDescription: string;
  daysSinceReported?: number;
  estimatedRepairCostShekels?: number;
}

export function buildLandlordRepairLetter(input: LandlordRepairInput): { subject: string; body: string } {
  const tenant = input.tenantName.trim() || "השוכר/ת";
  const landlord = input.landlordName.trim() || "המשכיר/ה";
  const address = input.propertyAddress.trim() || "הדירה";
  const defect = input.defectDescription.trim();
  const days = input.daysSinceReported && input.daysSinceReported > 0 ? Math.round(input.daysSinceReported) : null;
  const cost =
    input.estimatedRepairCostShekels && input.estimatedRepairCostShekels > 0
      ? `₪${Math.round(input.estimatedRepairCostShekels)}`
      : null;

  return {
    subject: `דרישה לתיקון ליקוי — ${address}`,
    body: `לכבוד ${landlord},

שמי ${tenant}, שוכר/ת את הנכס בכתובת ${address}.

בנכס קיים ליקוי מהותי: ${defect}.${days ? ` הליקוי דווח לפני כ-${days} ימים וטרם תוקן.` : ""}

בהתאם לחוק השכירות והשאילה, תשל"א-1971, המשכיר מחויב לתחזק את הנכס ולתקן ליקויים שאינם באחריות השוכר, בתוך זמן סביר.

אבקש:
1. תיאום מועד לתיקון הליקוי בתוך זמן סביר
2. אישור בכתב על קבלת הפנייה ולוח הזמנים לטיפול
${cost ? `3. ככל שאאלץ לתקן בעצמי בשל אי-טיפול, אדרוש החזר של ההוצאה (מוערכת בכ-${cost})\n` : ""}
אם הליקוי לא יטופל בתוך זמן סביר, אשקול את כלל האפשרויות העומדות לרשותי בחוק, לרבות תיקון על חשבון המשכיר וקיזוז מדמי השכירות.

בכבוד רב,
${tenant}`,
  };
}
