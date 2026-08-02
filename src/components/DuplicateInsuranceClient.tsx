"use client";

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { InsuranceChecker } from "@/components/InsuranceChecker";
import { DuplicateInsuranceAgent } from "@/components/DuplicateInsuranceAgent";
import type { DuplicationResult } from "@/lib/insurance";

export function DuplicateInsuranceClient({ bcp47 }: { bcp47: string }) {
  const [duplication, setDuplication] = useState<DuplicationResult | null>(null);

  return (
    <>
      <Reveal delay={80}>
        <div className="mt-2">
          <InsuranceChecker onDuplication={setDuplication} />
        </div>
      </Reveal>
      <DuplicateInsuranceAgent bcp47={bcp47} duplication={duplication} />
    </>
  );
}
