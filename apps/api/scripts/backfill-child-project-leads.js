/**
 * Copy active PROJECT_LEAD from CONTRACT parents onto CHILD videos that lack one.
 *
 *   node scripts/backfill-child-project-leads.js
 */
import { prisma } from '../src/db/prisma.js';
import { inheritProjectLeadsFromParent } from '../src/services/projectAccess.js';

async function main() {
  const children = await prisma.project.findMany({
    where: {
      deletedAt: null,
      kind: 'CHILD',
      parentProjectId: { not: null },
      assignments: {
        none: { role: 'PROJECT_LEAD', isActive: true },
      },
    },
    select: { id: true, code: true, parentProjectId: true },
  });

  let copied = 0;
  for (const child of children) {
    const n = await inheritProjectLeadsFromParent(prisma, {
      parentProjectId: child.parentProjectId,
      childProjectId: child.id,
    });
    if (n > 0) {
      copied += 1;
      console.log(`Inherited ${n} lead(s) → ${child.code}`);
    }
  }
  console.log(`Done. Updated ${copied} of ${children.length} child project(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
