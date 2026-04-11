import type { DashboardOverview } from 'shared';

import { apiRequest } from '@/services/api-client';

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return apiRequest<DashboardOverview>('/dashboard/overview');
}