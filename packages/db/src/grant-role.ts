// Operator CLI: grant or revoke a global role for an existing account, with an audit entry.
// Usage: pnpm --filter @bg/db grant-role <mobile> <admin|moderator> [--revoke]
import { and, eq } from 'drizzle-orm';
import { normalizeIranMobile, roleSchema } from '@bg/contracts';
import { createDb } from './index.ts';
import { requireDatabaseUrl } from './env.ts';
import { auditLog, userPrivate, userRoles } from './schema.ts';

const [mobileArg = '', roleArg = '', flag] = process.argv.slice(2);
const mobile = normalizeIranMobile(mobileArg);
const role = roleSchema.safeParse(roleArg);
if (!mobile || !role.success) {
  console.error('Usage: grant-role <mobile> <admin|moderator> [--revoke]');
  process.exit(1);
}

const { db, close } = createDb(requireDatabaseUrl(), { max: 1 });
try {
  const [user] = await db.select({ id: userPrivate.userId }).from(userPrivate).where(eq(userPrivate.mobile, mobile));
  if (!user) {
    console.error('No account with that mobile. The user must sign in once first.');
    process.exitCode = 1;
  } else {
    const revoke = flag === '--revoke';
    await db.transaction(async (tx) => {
      if (revoke) {
        await tx.delete(userRoles).where(and(eq(userRoles.userId, user.id), eq(userRoles.role, role.data)));
      } else {
        await tx.insert(userRoles).values({ userId: user.id, role: role.data }).onConflictDoNothing();
      }
      await tx.insert(auditLog).values({
        actorId: null, action: revoke ? 'role.revoke' : 'role.grant', targetType: 'user', targetId: user.id,
        metadata: { role: role.data, via: 'cli' }
      });
    });
    console.log(`${revoke ? 'revoked' : 'granted'} ${role.data} for user ${user.id}`);
  }
} finally {
  await close();
}
