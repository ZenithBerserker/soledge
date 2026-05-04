import { prisma } from '@/lib/prisma'

export async function listRecentOpportunities(take = 50) {
  return prisma.opportunityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
  })
}
