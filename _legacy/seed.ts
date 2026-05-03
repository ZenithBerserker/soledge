import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Seed known smart wallets
  const wallets = [
    { address: '7xKBmNf9AqPtKsL2Vb3Yw8dRcXnZpQjF1GhE4MuoV5T', label: 'INSIDER_01', category: 'INSIDER' as const, totalPnlUsd: 847000, winRate: 84, totalTrades: 312, trustScore: 96, isPublic: false },
    { address: '3mPQZw2CbTrEaL7KxVs9FnYhGpJdMqUo6iRcX4NeD1WA', label: 'ALPHA_WHALE', category: 'WHALE' as const, totalPnlUsd: 312000, winRate: 78, totalTrades: 184, trustScore: 89, isPublic: false },
    { address: 'Bv8XK1mPsLqN3Zt5YrGfHaJcWxDkE7TuO2bVnM9iPeA', label: 'COPY_ALPHA', category: 'ALPHA' as const, totalPnlUsd: 128000, winRate: 71, totalTrades: 241, trustScore: 82, isPublic: true },
    { address: '9nRwAa4BmKpZcL1Xs7YtFvHeGjNqUdM6oEiR3bDwV8PT', label: 'KOL_WALLET', category: 'ALPHA' as const, totalPnlUsd: 94000, winRate: 69, totalTrades: 167, trustScore: 77, isPublic: true },
    { address: 'Ej2TLp7FhYsVnK9Xb3qMrGaZcDwN4UeO1iP6mRtE8AB', label: 'DEV_KNOWN', category: 'ALPHA' as const, totalPnlUsd: 67000, winRate: 65, totalTrades: 98, trustScore: 72, isPublic: false },
    { address: '5hMZXx9DbLnK2Yp4VsGtHaFcNqJrM7uE3iO6wRvZ1WP', label: 'FADE_THIS', category: 'FADE' as const, totalPnlUsd: -12000, winRate: 31, totalTrades: 412, trustScore: 28, isPublic: true },
  ]

  for (const w of wallets) {
    await prisma.smartWallet.upsert({
      where: { address: w.address },
      update: w,
      create: w,
    })
  }

  // Seed known deployer profiles
  const deployers = [
    { address: '7xKBmNf9AqPtKsL2Vb3Yw8dRcXnZpQjF1GhE4MuoV5T', totalLaunches: 12, rugs: 0, successfulExits: 10, reputationScore: 94, tags: ['LEGIT_DEV', 'VERIFIED'] },
    { address: 'BAD1ruggerXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx1111', totalLaunches: 6, rugs: 5, successfulExits: 0, reputationScore: 2, tags: ['SERIAL_RUGGER', 'BLACKLISTED'] },
    { address: 'Bund1erWa11etXxXxXxXxXxXxXxXxXxXxXxXxXx1111', totalLaunches: 4, rugs: 1, successfulExits: 2, reputationScore: 34, tags: ['BUNDLER', 'CAUTION'] },
  ]

  for (const d of deployers) {
    await prisma.deployerProfile.upsert({
      where: { address: d.address },
      update: d,
      create: d,
    })
  }

  console.log('✅ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
