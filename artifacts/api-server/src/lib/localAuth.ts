import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Request } from "express";
import { db, usersTable } from "@workspace/db";

export type LocalUser = typeof usersTable.$inferSelect;

export type LocalUserResolution =
  | { kind: "resolved"; user: LocalUser }
  | { kind: "unauthenticated" }
  | { kind: "unlinked" }
  | { kind: "conflict" }
  | { kind: "lookup_failed" };

function authenticatedClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return "userId" in auth ? auth.userId : null;
}

function primaryVerifiedEmail(clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>>): string | null {
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) =>
      email.id === clerkUser.primaryEmailAddressId &&
      email.verification?.status === "verified",
  );
  return primaryEmail?.emailAddress ?? null;
}

/**
 * Finds the local profile for the current Clerk session. A pre-provisioned
 * profile can be linked once, by its verified primary Clerk email address.
 */
export async function resolveCurrentLocalUser(req: Request): Promise<LocalUserResolution> {
  const clerkUserId = authenticatedClerkUserId(req);
  if (!clerkUserId) {
    req.log.warn({ event: "local_auth_failed", reason: "unauthenticated" }, "Local authorization failed");
    return { kind: "unauthenticated" };
  }

  const [linkedUser] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
  if (linkedUser) return { kind: "resolved", user: linkedUser };

  let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>>;
  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  } catch {
    req.log.warn({ event: "local_auth_failed", reason: "clerk_user_lookup_failed", clerkUserId }, "Local authorization failed");
    return { kind: "lookup_failed" };
  }

  const email = primaryVerifiedEmail(clerkUser);
  if (!email) {
    req.log.warn({ event: "local_auth_failed", reason: "no_verified_primary_email", clerkUserId }, "Local authorization failed");
    return { kind: "unlinked" };
  }

  const matchingEmail = sql`lower(${usersTable.email}) = lower(${email})`;
  const emailUsers = await db.select().from(usersTable).where(matchingEmail).limit(2);
  if (emailUsers.length === 0) {
    req.log.warn({ event: "local_auth_failed", reason: "no_matching_local_profile", clerkUserId }, "Local authorization failed");
    return { kind: "unlinked" };
  }
  if (emailUsers.length > 1) {
    req.log.warn({ event: "local_auth_failed", reason: "ambiguous_local_email", clerkUserId }, "Local authorization failed");
    return { kind: "conflict" };
  }
  const emailUser = emailUsers[0];
  if (emailUser.clerkUserId && emailUser.clerkUserId !== clerkUserId) {
    req.log.warn({ event: "local_auth_failed", reason: "clerk_link_conflict", localUserId: emailUser.id, clerkUserId }, "Local authorization failed");
    return { kind: "conflict" };
  }
  if (emailUser.clerkUserId === clerkUserId) return { kind: "resolved", user: emailUser };

  const [newlyLinkedUser] = await db
    .update(usersTable)
    .set({ clerkUserId })
    .where(and(eq(usersTable.id, emailUser.id), isNull(usersTable.clerkUserId), matchingEmail))
    .returning();
  if (newlyLinkedUser) {
    req.log.info({ event: "local_user_jit_linked", localUserId: newlyLinkedUser.id, clerkUserId }, "Local profile linked to Clerk user");
    return { kind: "resolved", user: newlyLinkedUser };
  }

  // Another request may have linked the profile between the conditional update
  // and this read. Never overwrite that association.
  const [concurrentlyLinkedUser] = await db.select().from(usersTable).where(eq(usersTable.id, emailUser.id)).limit(1);
  if (concurrentlyLinkedUser?.clerkUserId === clerkUserId) return { kind: "resolved", user: concurrentlyLinkedUser };

  req.log.warn({ event: "local_auth_failed", reason: "clerk_link_conflict", localUserId: emailUser.id, clerkUserId }, "Local authorization failed");
  return { kind: "conflict" };
}