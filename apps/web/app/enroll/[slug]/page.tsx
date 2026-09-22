import EnrollFlow from '../EnrollFlow';

// /enroll/:tenantSlug — back-compat: resolves to the tenant's default program.
export default function TenantEnrollPage() {
  return <EnrollFlow />;
}
