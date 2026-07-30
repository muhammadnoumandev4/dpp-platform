export const CacheKeys = {
  dashboard: (organisationId: string) => `dashboard:${organisationId}`,
  analyticsPrefix: (organisationId: string) => `analytics:${organisationId}:`,
  passport: (uuid: string) => `passport:${uuid}`,
  itemPassport: (itemUuid: string) => `item-passport:${itemUuid}`,
  /** Redis list used by ScanQueueService when Redis is available. */
  scanQueue: 'scan-jobs',
} as const;
