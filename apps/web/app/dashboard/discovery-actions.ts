'use server'

import { executeDiscoveryScan, type DiscoveryScanResult } from '@/lib/run-discovery-scan'

export async function dashboardDiscoveryScanAction(): Promise<DiscoveryScanResult> {
  return executeDiscoveryScan()
}
