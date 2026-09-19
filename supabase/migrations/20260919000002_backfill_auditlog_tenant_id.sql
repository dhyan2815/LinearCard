-- Backfill AuditLog.tenantId for any rows written before the AuditService
-- unification (Task 0.6), when the members-controller call site inserted
-- rows without tenantId. Join through Member since AuditLog.memberId is
-- always populated. No-op if the NOT NULL constraint already rejected any
-- such inserts (rows simply never made it in).
UPDATE "AuditLog" a
SET "tenantId" = m."tenantId"
FROM "Member" m
WHERE a."memberId" = m."id"
  AND a."tenantId" IS NULL;
