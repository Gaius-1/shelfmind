/**
 * Canonical query keys factory.
 * Centralizes query caching keys so they are organization-scoped and easy to maintain.
 */
export const queryKeys = {
  session: () => ['session'] as const,
  jobs: (orgId: string) => ['orgs', orgId, 'jobs'] as const,
  job: (orgId: string, jobId: string) => ['orgs', orgId, 'jobs', jobId] as const,
  records: (orgId: string, jobId: string) => ['orgs', orgId, 'jobs', jobId, 'records'] as const,
  export: (orgId: string, jobId: string) => ['orgs', orgId, 'jobs', jobId, 'export'] as const,
  products: (orgId: string) => ['orgs', orgId, 'products'] as const,
  duplicates: (orgId: string) => ['orgs', orgId, 'duplicates'] as const,
  stats: (orgId: string) => ['orgs', orgId, 'stats'] as const,
  record: (orgId: string, recordId: string) => ['orgs', orgId, 'records', recordId] as const,
}
