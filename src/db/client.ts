import { PrismaClient } from "@prisma/client";

/**
 * `prisma` is what the rest of the app uses to query the database — the
 * Prisma equivalent of the old Drizzle `db` export. A single shared
 * instance (not one per request) is the correct pattern; Prisma manages
 * its own internal connection pool.
 *
 * NOTE: this file has not been run in this sandbox (Prisma's CLI/engine
 * needs a binary from binaries.prisma.sh, blocked here — see
 * prisma/schema.prisma's header comment and the testing steps doc).
 * `npx prisma generate` must succeed locally before this import resolves
 * to real generated types.
 */
export const prisma = new PrismaClient();
