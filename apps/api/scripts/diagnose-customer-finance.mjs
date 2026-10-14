/**
 * Read-only: prints a customer's projects, CRM orders (opportunities) and payments
 * so finance differences between the manager panel and the portal can be traced.
 *
 * Usage (from apps/api): node scripts/diagnose-customer-finance.mjs <project-code>
 * Example:               node scripts/diagnose-customer-finance.mjs APX-2026-0016
 */
import { prisma } from '../src/db/prisma.js';
import { sumActivePayments } from '../src/modules/crm/paymentFinance.js';

const code = process.argv[2];
if (!code) {
  console.error('Usage: node scripts/diagnose-customer-finance.mjs <project-code>');
  process.exit(1);
}

try {
  const project = await prisma.project.findFirst({
    where: { code, deletedAt: null },
    select: { crmCustomerId: true },
  });
  if (!project) throw new Error(`Project ${code} not found`);
  const customerId = project.crmCustomerId;

  const projects = await prisma.project.findMany({
    where: { crmCustomerId: customerId, deletedAt: null },
    select: {
      id: true,
      code: true,
      kind: true,
      finance: { select: { finalProjectPrice: true, received: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log('\nProjects');
  for (const p of projects) {
    console.log(
      ` ${p.code} ${p.kind.padEnd(8)} price=${p.finance?.finalProjectPrice ?? '-'} received=${p.finance?.received ?? '-'}`,
    );
  }

  const codeById = new Map(projects.map((p) => [p.id, p.code]));
  const opportunities = await prisma.opportunity.findMany({
    where: { crmCustomerId: customerId, deletedAt: null },
    select: {
      title: true,
      projectId: true,
      agreedPrice: true,
      advancePayment: true,
      contractLocked: true,
      pipelineStage: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log('\nCRM orders (opportunities)');
  for (const o of opportunities) {
    const link = o.projectId ? codeById.get(o.projectId) || 'deleted project' : 'NO PROJECT';
    console.log(
      ` [${link}] price=${o.agreedPrice ?? '-'} paid=${o.advancePayment ?? '-'} locked=${o.contractLocked} stage=${o.pipelineStage} "${o.title}"`,
    );
  }

  const paid = await sumActivePayments(prisma, { crmCustomerId: customerId });
  console.log(`\nApproved payments (each counted once): ${paid}`);
} finally {
  await prisma.$disconnect();
}
