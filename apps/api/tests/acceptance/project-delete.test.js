import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../src/db/prisma.js';
import { projectService } from '../../src/modules/projects/service.js';

test('project softDelete removes finance, portfolio, and CRM project links', async () => {
  const manager = await prisma.user.findFirst({
    where: { role: { code: 'MANAGER' }, isActive: true, deletedAt: null },
  });
  assert.ok(manager, 'seeded MANAGER user is required for this test');

  const suffix = Date.now().toString().slice(-8);
  const customer = await prisma.crmCustomer.create({
    data: {
      personName: `Delete Test ${suffix}`,
      whatsappRaw: `0799${suffix}`,
      normalizedWhatsapp: `93799${suffix}`,
      pipelineStage: 'ORDER_CONFIRMED',
      portalStatus: 'ELIGIBLE',
    },
  });

  const opportunity = await prisma.opportunity.create({
    data: {
      crmCustomerId: customer.id,
      title: `Opp ${suffix}`,
      pipelineStage: 'ORDER_CONFIRMED',
      agreedPrice: 1000,
      agreedTerms: 'test',
    },
  });

  const project = await prisma.project.create({
    data: {
      code: `TST-${suffix}`,
      title: `Delete cascade ${suffix}`,
      status: 'NEW_MANAGER_REVIEW',
      customerFacingStatus: 'INFO_RECEIVED',
      crmCustomerId: customer.id,
      managerId: manager.id,
    },
  });

  await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: { projectId: project.id },
  });

  await prisma.projectFinance.create({
    data: {
      projectId: project.id,
      basePrice: 1000,
      agreedPrice: 1000,
      finalProjectPrice: 1000,
      received: 200,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-DEL-${suffix}`,
      crmCustomerId: customer.id,
      opportunityId: opportunity.id,
      projectId: project.id,
      status: 'ISSUED',
      subtotal: 200,
      total: 200,
      items: {
        create: {
          description: 'Deposit',
          quantity: 1,
          unitPrice: 200,
          amount: 200,
        },
      },
    },
  });

  const payment = await prisma.payment.create({
    data: {
      crmCustomerId: customer.id,
      invoiceId: invoice.id,
      amount: 200,
      verification: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });

  await prisma.expense.create({
    data: {
      projectId: project.id,
      category: 'DIRECT_PROJECT',
      amount: 50,
      description: 'test expense',
    },
  });

  const editor = await prisma.teamProfile.findFirst({ where: { deletedAt: null } });
  if (editor) {
    await prisma.employeePayable.create({
      data: {
        projectId: project.id,
        teamProfileId: editor.id,
        roleLabel: 'EDITOR',
        amount: 100,
        status: 'ESTIMATED',
      },
    });
  }

  await prisma.portfolioItem.create({
    data: {
      projectId: project.id,
      slug: `delete-test-${suffix}`,
      companyDisplay: 'Test Co',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  const auth = { userId: manager.id, roleCode: 'MANAGER' };
  const deleted = await projectService.softDelete(project.id, auth, {});

  assert.equal(deleted.code, project.code);
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.removed.invoices, 1);
  assert.equal(deleted.removed.payments, 1);
  assert.ok(deleted.removed.expenses >= 1);
  assert.equal(deleted.removed.portfolioItems, 1);

  const projectRow = await prisma.project.findUnique({ where: { id: project.id } });
  assert.ok(projectRow.deletedAt, 'project must be soft-deleted');

  assert.equal(await prisma.invoice.findUnique({ where: { id: invoice.id } }), null);
  assert.equal(await prisma.payment.findUnique({ where: { id: payment.id } }), null);
  assert.equal(await prisma.expense.count({ where: { projectId: project.id } }), 0);
  assert.equal(await prisma.employeePayable.count({ where: { projectId: project.id } }), 0);

  const portfolio = await prisma.portfolioItem.findUnique({ where: { projectId: project.id } });
  assert.ok(portfolio.deletedAt);
  assert.equal(portfolio.status, 'UNPUBLISHED');

  const opp = await prisma.opportunity.findUnique({ where: { id: opportunity.id } });
  assert.equal(opp.projectId, null);
  assert.equal(opp.pipelineStage, 'ORDER_CONFIRMED');

  const cust = await prisma.crmCustomer.findUnique({ where: { id: customer.id } });
  assert.equal(cust.pipelineStage, 'ORDER_CONFIRMED');

  // Active finance list must not include the deleted project's invoices
  const liveInvoices = await prisma.invoice.findMany({
    where: {
      OR: [{ projectId: null }, { project: { deletedAt: null } }],
      crmCustomerId: customer.id,
    },
  });
  assert.equal(liveInvoices.length, 0);

  // Cleanup leftover customer/opportunity (project stays soft-deleted for uniqueness)
  await prisma.portfolioItem.deleteMany({ where: { projectId: project.id } });
  await prisma.projectFinance.deleteMany({ where: { projectId: project.id } });
  await prisma.opportunity.delete({ where: { id: opportunity.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.crmCustomer.delete({ where: { id: customer.id } });
});

test('project softDelete rejects non-manager roles', async () => {
  await assert.rejects(
    () =>
      projectService.softDelete('nonexistent', { userId: 'x', roleCode: 'SALES' }, {}),
    (err) => err.status === 403 && err.code === 'FORBIDDEN',
  );
});
