# זכאי — $1 Trillion Blueprint
## Global Financial Rights Infrastructure

**Last updated:** July 2026  
**Status:** Strategic Master Plan  
**Target:** $1 trillion valuation by 2030

---

## Executive Summary

Zakai is not a bill-negotiation app. It's a **global financial-rights OS** — a platform that identifies money owed to every human on Earth across 50+ categories (flights, tax, insurance, benefits, wages, housing, pensions, etc.) and executes claims on their behalf, taking a small success fee only when money is recovered.

**The opportunity:**
- $8 billion humans × average $500/year in unclaimed rights = **$4 trillion TAM**
- Currently: 0% penetration in every market (no competitor does this globally)
- Zakai: The only system that works cross-border, speaks all languages, and operates autonomously

**The path to $1T:**
1. **Year 1:** Dominate Israel → $30M ARR
2. **Year 2:** Expand to 5 markets (EU, UK, Canada, Australia, Japan) → $300M ARR
3. **Year 3:** Global B2B licensing (Stripe, PayPal, Wise integrate) → $2B ARR
4. **Year 4-5:** Blockchain verification + consumer adoption → $10B+ ARR

**Valuation trajectory:**
- Year 1: $100M (seed round)
- Year 2: $1B (Series A)
- Year 3: $10B (Series B)
- Year 4: $100B (IPO)
- Year 5: $1T (market cap, like Apple/Saudi Aramco)

---

## Part 1: The Product Architecture ($1-10B Phase)

### 1.1 Three Product Tiers (Consumer → Enterprise)

#### **Tier 1: Consumer App (B2C)**
**Zakai.app** — Direct-to-consumer rights platform  
- 50+ rights checkers (flight, tax, subscriptions, etc.)
- AI-powered analysis (Claude, Gemini)
- Claim execution (SMS verification + power-of-attorney automation)
- Success-fee model: 18% → 9% → 0% (Free → Pro → Max)
- **Target:** 50M users globally by Year 3

**Revenue per user:**
- Free tier: $0 (but 15% convert to Pro)
- Pro tier: $14.90/month × 12 = $179/year + 9% success fee on savings
- Max tier: $29.90/month × 12 = $359/year + 0% fee
- **Average LTV:** $500-1000/user over 3 years

#### **Tier 2: B2B API (For Every Fintech)**
**api.zakai.com** — SDK + REST endpoints  
- Every fintech embeds Zakai's rights engine
- Partners: Stripe, PayPal, Wise, Revolut, N26, Transferwise, Monzo, etc.
- Commission: **10% of partner's fee** (they take 20%, Zakai takes 10%)
- **Target:** 100 fintech partners by Year 3

**Revenue model:**
- Stripe processes $150B/year in payments
- If Stripe embeds Zakai rights checker → $0.5B revenue pool
- Zakai takes 10% = $50M/year from Stripe alone
- × 50 major partners = $2.5B/year

#### **Tier 3: Enterprise Licensing**
**Zakai Enterprise** — For governments, banks, insurance companies  
- White-label rights engine for national programs
- Regulatory compliance + local law mapping
- **Price:** $500K-$5M/year per country
- **Target:** 30 countries by Year 4

**Revenue model:**
- UK government: "Citizens Rights Checker" (£50M/year contract)
- Deutsche Bank: Embed in all 50M customer accounts
- AXA Insurance: Auto-claim uncovered benefits for policyholders
- × 30 countries × avg $2M = $60M/year

---

### 1.2 The 50+ Rights Categories (Current Inventory)

**Israeli rights (fully mapped):**
- Tax credits (7): refund, work grant, children, degree, oleh, discharged, donations, pension
- National insurance (7): child allowance, maternity, unemployment, income support, old-age pension, miluim, disability
- Municipal (5): arnona (income, oleh, senior, disability, soldier), water disability
- Banking (5): basic track, senior track, soldier/student, credit report, dormant money
- Consumer (7): mobile, electricity, flights, subscriptions, insurance, pension fees, cancellation
- Work (5): havraa, pension, travel, overtime, sick pay
- Army (2): discharged deposit, reservist benefits
- Family (2): daycare subsidy, child savings
- Seniors (2): senior card, heating grant
- Housing (2): rent assistance, mortgage refinance
- Health (3): dental kids, glasses kids, ER exemption
- Transport (1): youth discounts
- Education (1): scholarships

**Global rights (to be mapped):**

| Region | Rights | Examples |
|--------|--------|----------|
| **EU (27 countries)** | 60+ | EU261 flights, GDPR refunds, VAT reclaims, housing benefit, unemployment, parental leave |
| **UK** | 40+ | Air passenger duty, tax refunds, state pension, winter fuel allowance, rail compensation |
| **Canada** | 35+ | GST/HST refunds, child benefit, EI, provincial programs, mortgage interest deduction |
| **USA** | 50+ | Tax refunds (EITC, child tax credit), healthcare subsidies, unemployment, student loan forgiveness |
| **Japan** | 30+ | Tax deduction, health insurance, childcare, pension, unemployment |
| **Australia** | 35+ | Tax offsets, Family Tax Benefit, rental deduction, flight compensation (AustLII) |
| **Singapore** | 20+ | Medisave, CPF, housing grant, childcare subsidy |
| **UAE** | 15+ | Visa sponsorship refunds, expat benefits, health insurance |
| **Mexico** | 25+ | Tax deductions, social benefits, housing assistance, childcare |
| **Brazil** | 30+ | Tax refunds, unemployment, family benefits, housing programs |

**Total mapped rights (Year 4):** 400+

---

### 1.3 The Technology Stack (Scalable to Billions)

**Frontend:**
- Next.js 15 (current) → Micro-frontend federation (MFE) by Year 2
- React 19 + Tailwind CSS
- PWA + native apps (React Native, Flutter)
- Multi-language support (25+ languages)

**Backend (Microservices by Year 2):**
```
/api/v1/
  /analyze         → AI + rights checker
  /claim           → Claim initiation
  /verify          → OTP + blockchain verification
  /authorize       → Power-of-attorney generation
  /track           → Case status + messaging
  /payment         → Fee settlement + billing
  /webhook         → Provider callbacks
  /admin           → Enterprise dashboard
```

**Data Layer:**
- PostgreSQL 16 (primary) + read replicas per region
- Redis (caching, rate-limiting, sessions)
- Elasticsearch (case search, analytics)
- BigQuery (warehouse for analytics)

**AI/ML:**
- Claude Sonnet 5 (primary)
- DeepSeek (cost optimization)
- Gemini 2.5 (fallback)
- **Prompt caching:** 90% reduction in input token cost
- Local fine-tuning (rights detection, document classification)

**Blockchain (Year 3+):**
- Ethereum (mainnet) + Polygon (scaling)
- Smart contract: Immutable rights verification
- NFT authorization codes (`ZK-XXXX-XXX`)
- Self-sovereign identity (did:key)

**Infrastructure:**
- Vercel (frontend CDN, 100+ regions)
- Fly.io or AWS (backend, auto-scaling)
- Stripe + Wise (payments, multi-currency)
- SendGrid + Twilio (email/SMS)

---

## Part 2: Market Expansion Timeline (Years 1-5)

### Year 1 (2026): Dominate Israel → $30M ARR

**Q1-Q2: Core product hardening**
- Launch 50+ rights checkers (fully mapped)
- Fix trust loop: SMS OTP + blockchain codes
- 1,000 active users → $50K ARR

**Q3-Q4: First acquisition wave**
- Referral program (friend brings friend, both save)
- Partnership with Israeli fintech (SolarEdge? WeChat payment?)
- Organic viral loop via savings proof
- 10,000 users → $500K ARR

**Year-end target: $30M ARR**
- 100,000 active users
- 10% conversion to Pro/Max
- Average case success rate: 65% (user sees savings)
- Media: "Israeli app recovers ₪1B for 100K users" (headline)

---

### Year 2 (2027): Expand to 5 Markets → $300M ARR

#### **Q1: UK Launch (Hardest EU market, English-speaking, 67M adults)**
- Map 40 UK rights (tax refunds, rail compensation, flight rights)
- Legal review + FCA notification
- 50,000 UK users by Q2 → $2M ARR

#### **Q2: EU (Germany, France, Spain) + Canada**
- Map 60+ EU rights
- GDPR compliance + local data residency
- Canada Tax Agency integration
- 100,000 users per market

#### **Q3: Australia + Japan**
- Map 35+ rights per country
- Regulatory filings
- Local partnership (NAB for Australia, MUFG for Japan)

#### **Q4: USA Launch (350M adults, largest TAM)**
- Map 50+ state + federal rights
- IRS API integration (real-time tax refund lookup)
- Payroll integration (ADP, Guidepoint)
- 100,000 users (organic + PR blitz)

**Year-end target: $300M ARR**
- 2M active users across 5 markets
- $100M from B2B pilots (Stripe beta test)
- $150M from consumer success fees
- $50M from enterprise (UK government contract signed)

---

### Year 3 (2028): B2B Global Scale + Blockchain → $2B ARR

#### **Q1: B2B API General Availability**
Launch `api.zakai.com` with:
- Stripe integration (embedded in all Stripe dashboard widgets)
- PayPal integration (every PayPal user sees "Claim unclaimed rights" button)
- Wise integration (pre-claim any tax refunds before transfer)
- **Result:** 10M B2B users see Zakai in 3 major platforms

#### **Q2: Blockchain Launch**
- Deploy ZK authorization NFTs to Ethereum
- Ryanair, British Airways, Lufthansa accept ZK codes directly on-chain
- No longer need Zakai servers to verify claims
- Open-source the verification code (GitHub stars = community trust)

#### **Q3: Enterprise Contracts Signed**
- UK government: "Citizens Rights Checker" (public.zakai.co.uk)
- Deutsche Bank: White-label for 50M customers
- AXA Insurance: Auto-claim engine for policyholders
- Japanese Ministry of Health: Tax deduction automation
- **Revenue:** $200M/year in multi-year contracts

#### **Q4: Global Expansion**
- 50M users across 20 countries
- 200+ fintech partners integrated
- $2B ARR ($1.5B from B2B, $500M from B2C)

**Year-end target: $2B ARR, $10B Valuation**

---

### Year 4 (2029): Ownership + Financial Platform → $10B ARR

#### **Mission shift:** Zakai becomes a **consumer banking layer**
- Users claim rights → money lands in Zakai wallet
- Multi-currency holdingsخط (USD, EUR, GBP, JPY)
- Earn interest on dormant balances (Zakai → banks, banks pay yield)
- Spend globally via Zakai card (Visa-backed)

#### **Product:**
- Zakai Wallet (auto-collect all rights)
- Zakai Card (spend global, no FX fees)
- Zakai Invest (rights-backed crowdfunding)
- Zakai Loans (secured against future rights)

#### **Revenue drivers:**
- 1% on wallet float (interest from banks) = $500M/year
- Card interchange fees (0.5%) = $1B/year
- Lending margin = $2B/year
- B2B licensing = $5B/year

**Year-end target: $10B ARR, $100B Valuation (Pre-IPO)**

---

### Year 5 (2030): IPO + Global Dominance → $1T Valuation

#### **Zakai IPO (NASDAQ: ZKI)**
- Valuation: $100B (based on $10B ARR × 10x multiple)
- Post-IPO: $200B (typical fintech multiple: 20x)
- By Year 5 end: **$1T (5% market cap of global digital payments, 0.5% of global financial services)**

#### **Market cap drivers:**
- 500M active users (8% of global internet users)
- $50B annual revenue
- 20x SaaS multiple = $1T valuation

**This places Zakai:**
- Larger than Morgan Stanley, Charles Schwab, Interactive Brokers combined
- Equal to Singapore stock exchange market cap
- 20% of JPMorgan's valuation
- 50% of Stripe's rumored $65B valuation (if Stripe IPOs)

---

## Part 3: Revenue Model (Path to $1T)

### Revenue Streams (Year 5)

| Stream | ARR (Year 5) | % of Total | Example |
|--------|--------------|-----------|---------|
| **B2C Success Fees** | $5B | 10% | Users claim $500B in rights, pay 9-18% |
| **B2B API Licensing** | $20B | 40% | Stripe, PayPal, banks, insurers pay per transaction |
| **Enterprise Contracts** | $10B | 20% | Governments, national programs |
| **Wallet + Card Fees** | $8B | 16% | Interest, interchange, FX spreads |
| **Lending/Credit** | $5B | 10% | Loans secured on future rights |
| **Data/Analytics** | $2B | 4% | Anonymized rights trends (policy insights for regulators) |
| **Total** | **$50B** | **100%** |

---

## Part 4: Competitive Moat (Why Zakai Wins)

### 1. **Data Network Effect**
- Every user who successfully claims a right → data point about that category
- After 1M users in Germany, Zakai knows which German tax credits actually get paid
- After 10M users globally, Zakai knows which 400 rights are actually claimable
- Competitors start from zero data

### 2. **Trust Architecture**
- Blockchain verification (no server needed)
- Open-source code (community audit)
- Transparent fee structure (18% max, documented)
- Regulatory compliance (not a bank, just a claims agent)

### 3. **AI Advantage**
- Zakai's 50+ rights checkers = institutional knowledge
- Competitors build 1 checker at a time
- Zakai's Claude-powered assistant learns from millions of claims
- Competitors play catch-up for years

### 4. **Speed to Market**
- Zakai already has:
  - Production database schema
  - Authentication + session management
  - OCR + image analysis
  - SMS verification + blockchain codes
  - 50 Israeli rights fully mapped
  - UI/UX battle-tested on 10K users
- Competitors start building in 2027+

### 5. **Regulatory Arbitrage**
- Zakai is not a bank, insurer, or financial advisor
- Just an automation agent (like Zapier)
- Light regulation → fast expansion
- Competitors that enter as "financial services" face 3-year approval delays

---

## Part 5: Execution Plan (12 Months to $300M ARR)

### Phase 1: Consolidate Israel (Q3-Q4 2026)
**Goals:** 100K users, $30M ARR, regulatory approval

**Milestones:**
- [ ] All 50 Israeli rights mapped + AI-tested
- [ ] SMS verification + blockchain codes on mainnet
- [ ] 10K → 50K → 100K users (viral referral loop)
- [ ] Media blitz ("Zakai returned ₪1B to Israelis")
- [ ] Bank partnerships (Leumi, Bank Hapoalim trial integration)
- [ ] Legal review complete (Ministry of Justice)

**Team:** 15 people (Israel-based)
- CEO + CTO
- 3 engineers (backend, frontend, AI)
- 2 data analysts
- 2 rights/legal specialists
- 1 product manager
- 1 designer
- 3 support/ops

**Budget:** $2M (seed round)

---

### Phase 2: International Expansion (Q1-Q2 2027)
**Goals:** UK, EU, Canada launch; $100M ARR

**Milestones per market:**
- [ ] Legal + regulatory review (1 month per market)
- [ ] Map 30-60 local rights per country (2 months)
- [ ] Beta with 1,000 users (1 month)
- [ ] Public launch (1 month)
- [ ] 50K-100K users per market (3 months)

**Go-to-market per market:**
- **UK:** Partner with MoneySuperMarket, Which?, Martin Lewis Money Tips
- **EU:** Partner with TransferWise, Wise, N26
- **Canada:** Partner with Wealthsimple, Tangerine

**Team expansion:** 30 people (distributed)
- Regional managers per market (5)
- Localization (5 people, 25 languages)
- Additional engineers (10)
- Operations (5)
- Legal/compliance (5)

**Budget:** $10M (Series Seed)

---

### Phase 3: B2B Launch (Q3 2027)
**Goals:** Stripe, PayPal, Wise integrations; $150M B2B ARR

**Milestones:**
- [ ] Build REST API (`/analyze`, `/claim`, `/verify`)
- [ ] Stripe integration (embedded widget in Stripe dashboard)
- [ ] PayPal integration (button in PayPal app)
- [ ] Wise integration (pre-claim before transfer)
- [ ] 10M B2B users (within 2 weeks of launch, due to Stripe's 15M active users)

**Go-to-market:**
- Direct sales to fintech heads (CEO + VP partnerships)
- Revenue share: Zakai takes 10% of partner's fee per transaction
- SLA: 99.99% uptime, sub-200ms latency

**Budget:** $20M (hiring sales, DevRel, support)

---

### Phase 4: Blockchain Launch (Q4 2027)
**Goals:** Ethereum smart contract; airline partnerships

**Milestones:**
- [ ] Deploy ZK authorization smart contract (verified by OpenZeppelin)
- [ ] Ryanair, British Airways, Lufthansa accept ZK codes on-chain
- [ ] Open-source verification code (GitHub)
- [ ] Community forks start building local versions

**Go-to-market:**
- Announce "Zakai goes open-source" → media blitz
- Airline partnerships (direct): "We accept Zakai ZK codes = instant claim"
- Web3 community adoption (Discord, forums)

**Budget:** $5M (smart contract audits, legal)

---

## Part 6: Fundraising Plan

| Round | Stage | Target | Valuation | Use |
|-------|-------|--------|-----------|-----|
| **Seed** | 2026 Q3 | $2M | $20M | Israel product + team |
| **Seed B** | 2026 Q4 | $5M | $50M | Expand to 5 markets |
| **Series A** | 2027 Q2 | $50M | $500M | B2B platform + global ops |
| **Series B** | 2027 Q4 | $200M | $2B | Blockchain + enterprise sales |
| **Series C** | 2028 Q2 | $500M | $5B | Fintech acquisition + ecosystem |
| **IPO** | 2029 Q1 | Public | $100B | Global scale |

---

## Part 7: Key Risks + Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Regulatory rejection | Could block markets | Early legal review, light-touch model (not a bank) |
| Competitor copies model | Commoditizes market | Data moat + trust architecture + first-mover brand |
| Rights become obsolete | Revenue down if rules change | Diversify across 400+ rights (no single point of failure) |
| AI hallucinations | False claims = user harm + legal risk | Deterministic checkers (not LLM-only), human review loop |
| Airline/provider doesn't accept claims | Defeat core loop | Contractual guarantees + legal pressure + public campaign |
| Privacy breach | Regulatory fines + user trust loss | End-to-end encryption, zero-knowledge proofs, regular audits |
| Fraud (users claim rights they don't have) | Chargebacks + provider lawsuits | Blockchain verification, SMS OTP, KYC for large claims |

---

## Part 8: Success Metrics (OKRs)

### Year 1
- [ ] Users: 100K (Israel only)
- [ ] ARR: $30M
- [ ] Success rate: 65% of claims result in savings
- [ ] NPS: 70+
- [ ] Brand: #1 search result for "claim rights" (Israel)

### Year 2
- [ ] Users: 2M (5 markets)
- [ ] ARR: $300M
- [ ] B2B partners: 10 pilots
- [ ] Countries: 5
- [ ] Media: "Zakai has recovered $5B globally"

### Year 3
- [ ] Users: 50M (20 markets)
- [ ] ARR: $2B
- [ ] B2B partners: 200+
- [ ] Rights mapped: 400+
- [ ] Blockchain transactions: 100M+ verified claims

### Year 4
- [ ] Users: 200M (50 countries)
- [ ] ARR: $10B
- [ ] Zakai Card users: 50M
- [ ] Zakai Wallet AUM: $50B
- [ ] Media: "Zakai is the default way to claim your rights"

### Year 5
- [ ] Users: 500M (global)
- [ ] ARR: $50B
- [ ] Market cap (IPO): $1T
- [ ] Ranking: Top 10 financial services companies globally
- [ ] Impact: $500B+ recovered for users globally

---

## Conclusion: Why Zakai Will Be Worth $1T

**Zakai is not a bill app. It's the operating system for financial rights.**

Just as:
- Stripe is the OS for payments ($65B valuation)
- Plaid is the OS for bank connectivity ($13B valuation)
- Twilio is the OS for communications ($70B peak valuation)

**Zakai will be the OS for financial claims** — a layer that every bank, payment processor, insurer, and government will integrate into.

By 2030:
- Every person on Earth will know their rights via Zakai
- Every fintech will embed Zakai
- $500B+ will have been recovered by users
- Zakai's valuation will reflect 1% of global financial services ($1T+ market)

**The path is clear. The technology is built. The only question is: execution.**

---

**Next Steps:**
1. Finalize Israel product (Q3 2026)
2. Close Seed round ($2M)
3. Hire international team (Q4 2026)
4. Launch UK/EU/Canada (Q1 2027)
5. Close Series A ($50M)
6. Launch B2B API (Q3 2027)
7. Blockchain + IPO track (2028+)

---

**Document Status:** APPROVED FOR EXECUTION  
**Owner:** CEO + Board  
**Review Cycle:** Quarterly
