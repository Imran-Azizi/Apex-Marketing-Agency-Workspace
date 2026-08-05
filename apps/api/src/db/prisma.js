import { PrismaClient } from '@prisma/client';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

/**
 * Auto-notify when Project.status advances to a new workflow stage.
 * Uses base client inside the hook to avoid recursive extension calls.
 */
export const prisma = basePrisma.$extends({
  name: 'projectProgressNotify',
  query: {
    project: {
      async update({ args, query }) {
        const nextStatus = args?.data?.status;
        let previousStatus = null;
        const projectId = args?.where?.id;

        if (nextStatus && projectId) {
          try {
            const prev = await basePrisma.project.findUnique({
              where: { id: projectId },
              select: { status: true },
            });
            previousStatus = prev?.status ?? null;
          } catch {
            previousStatus = null;
          }
        }

        const result = await query(args);

        if (
          nextStatus
          && previousStatus
          && previousStatus !== nextStatus
          && result?.id
        ) {
          import('../services/projectProgress.js')
            .then(({ notifyProjectProgressChange }) =>
              notifyProjectProgressChange(basePrisma, {
                projectId: result.id,
                previousStatus,
                nextStatus,
              }),
            )
            .catch((err) => {
              console.error('[progress] notify after status update', err?.message || err);
            });
        }

        return result;
      },
    },
  },
});
