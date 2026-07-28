export const CacheKeys = {
  dashboard: (organisationId: string) => `dashboard:${organisationId}`,
  analyticsPrefix: (organisationId: string) => `analytics:${organisationId}:`,
} as const;
