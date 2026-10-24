/**
 * Recompute Opportunity.advancePayment + ProjectFinance.received
 * from per-opportunity payment isolation rules.
 *
 * Usage (API stopped or unlocked):
 *   node scripts/resync-opportunity-finance.js
 */
import { prisma } from '../src/db/prisma.js';
import { syncCustomerOpportunitiesFinance } from '../src/modules/crm/paymentFinance.js';

async function main() {
  const customers = await prisma.crmCustomer.findMany({
    where: { deletedAt: null },
    select: { id: true, personName: true },
  });
  let ok = 0;
  for (const customer of customers) {
    await syncCustomerOpportunitiesFinance(prisma, customer.id);
    ok += 1;
  }
  console.log(`Resynced finance for ${ok} customers.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
