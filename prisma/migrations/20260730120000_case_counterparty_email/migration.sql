-- Late-payment collection (freelancer/supplier chasing their own client) is
-- the first full-service vertical whose counterparty isn't a known company in
-- providers.ts — there is no registry entry to resolve a contact address
-- from. Every other vertical keeps using `provider` + providers.ts unchanged.
ALTER TABLE "Case" ADD COLUMN "counterpartyEmail" TEXT;
