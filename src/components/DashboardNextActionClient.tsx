"use client";

import { NextActionCard } from "@/components/NextActionCard";
import type { RightsProfile } from "@/lib/rights";

export function DashboardNextActionClient({
  profile,
  actedOn,
  bcp47,
}: {
  profile: RightsProfile;
  actedOn: string[];
  bcp47: string;
}) {
  return <NextActionCard profile={profile} actedOn={actedOn} bcp47={bcp47} />;
}
