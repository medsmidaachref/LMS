import { and, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import {
  activitiesTable,
  classesTable,
  classModulesTable,
  classStudentsTable,
  modulesTable,
  usersTable,
} from "@workspace/db";
import {
  AssignClassModulesBody,
  AssignClassModulesParams,
  AssignClassStudentsBody,
  AssignClassStudentsParams,
  AssignClassTeacherBody,
  AssignClassTeacherParams,
  AssignClassModulesResponse,
  AssignClassStudentsResponse,
  AssignClassTeacherResponse,
  CreateClassBody,
  CreateClassResponse,
  CreateUserBody,
  CreateUserResponse,
  DeleteClassParams,
  DeleteUserParams,
  GetClassAssignmentsParams,
  GetClassAssignmentsResponse,
  GetDashboardSummaryResponse,
  ListClassesQueryParams,
  ListClassesResponse,
  ListModulesResponse,
  ListUsersQueryParams,
  ListUsersResponse,
  ResetUserPasswordBody,
  ResetUserPasswordParams,
  ResetUserPasswordResponse,
  UpdateClassBody,
  UpdateClassParams,
  UpdateClassResponse,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { resolveCurrentLocalUser } from "../lib/localAuth";

const router: IRouter = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const resolution = await resolveCurrentLocalUser(req);
  if (resolution.kind === "unauthenticated") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (resolution.kind === "unlinked") {
    res.status(404).json({ error: "No local user is linked to this Clerk account." });
    return;
  }
  if (resolution.kind === "conflict") {
    res.status(409).json({ error: "This local profile is linked to a different Clerk account." });
    return;
  }
  if (resolution.kind === "lookup_failed") {
    res.status(502).json({ error: "Unable to verify the Clerk account." });
    return;
  }
  if (resolution.user.role !== "admin" || resolution.user.status !== "active") {
    req.log.warn(
      { event: "admin_authorization_failed", reason: "wrong_or_inactive_role", localUserId: resolution.user.id },
      "Admin authorization failed",
    );
    res.status(403).json({ error: "An active administrator account is required." });
    return;
  }
  next();
}

function parseId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function classAssignments(classId: number) {
  const classRows = await db
    .select({ teacherId: classesTable.teacherId })
    .from(classesTable)
    .where(eq(classesTable.id, classId));
  if (classRows.length === 0) {
    return null;
  }

  const [teacherRows, studentRows, moduleRows] = await Promise.all([
    classRows[0].teacherId
      ? db
          .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, classRows[0].teacherId))
      : Promise.resolve([]),
    db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(classStudentsTable)
      .innerJoin(usersTable, eq(usersTable.id, classStudentsTable.studentId))
      .where(eq(classStudentsTable.classId, classId)),
    db
      .select({
        id: modulesTable.id,
        slug: modulesTable.slug,
        name: modulesTable.name,
        shortDescription: modulesTable.shortDescription,
        color: modulesTable.color,
        activityCount: modulesTable.activityCount,
        editorUrl: modulesTable.editorUrl,
        repositoryUrl: modulesTable.repositoryUrl,
      })
      .from(classModulesTable)
      .innerJoin(modulesTable, eq(modulesTable.id, classModulesTable.moduleId))
      .where(eq(classModulesTable.classId, classId)),
  ]);

  return {
    classId,
    teacher: teacherRows[0] ?? null,
    students: studentRows,
    modules: moduleRows,
  };
}

router.use(requireAdmin);

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [
    totalUsersRows,
    totalStudentsRows,
    totalTeachersRows,
    totalClassesRows,
    totalModulesRows,
    activeClassesRows,
    recentActivity,
  ] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db.select({ value: count() }).from(usersTable).where(eq(usersTable.role, "student")),
    db.select({ value: count() }).from(usersTable).where(eq(usersTable.role, "teacher")),
    db.select({ value: count() }).from(classesTable),
    db.select({ value: count() }).from(modulesTable),
    db.select({ value: count() }).from(classesTable).where(eq(classesTable.status, "active")),
    db
      .select({
        id: activitiesTable.id,
        title: activitiesTable.title,
        type: activitiesTable.type,
        time: activitiesTable.time,
        status: activitiesTable.status,
      })
      .from(activitiesTable)
      .orderBy(sql`${activitiesTable.createdAt} desc`)
      .limit(5),
  ]);

  res.json(
    GetDashboardSummaryResponse.parse({
      totalUsers: Number(totalUsersRows[0]?.value ?? 0),
      totalStudents: Number(totalStudentsRows[0]?.value ?? 0),
      totalTeachers: Number(totalTeachersRows[0]?.value ?? 0),
      totalClasses: Number(totalClassesRows[0]?.value ?? 0),
      totalModules: Number(totalModulesRows[0]?.value ?? 0),
      activeClasses: Number(activeClassesRows[0]?.value ?? 0),
      recentActivity,
    }),
  );
});

router.get("/users", async (req, res): Promise<void> => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters = [];
  if (parsed.data.search) {
    filters.push(or(ilike(usersTable.name, `%${parsed.data.search}%`), ilike(usersTable.email, `%${parsed.data.search}%`)));
  }
  if (parsed.data.role) filters.push(eq(usersTable.role, parsed.data.role));
  if (parsed.data.status) filters.push(eq(usersTable.status, parsed.data.status));

  const rows = await db
    .select()
    .from(usersTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(usersTable.name);

  const users = await Promise.all(
    rows.map(async (user) => {
      const [taughtClassRows, joinedClassRows] = await Promise.all([
        db.select({ value: count() }).from(classesTable).where(eq(classesTable.teacherId, user.id)),
        db.select({ value: count() }).from(classStudentsTable).where(eq(classStudentsTable.studentId, user.id)),
      ]);
      return {
        ...user,
        classesCount: Number(taughtClassRows[0]?.value ?? 0) + Number(joinedClassRows[0]?.value ?? 0),
      };
    }),
  );

  res.json(ListUsersResponse.parse(users));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rawProfile } = parsed.data;
  const profile = { ...rawProfile, email: normalizeEmail(rawProfile.email) };
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${profile.email})`)
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }

  let clerkUserId: string | undefined;
  try {
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [profile.email],
      password,
      firstName: profile.name,
    });
    clerkUserId = clerkUser.id;

    const [user] = await db
      .insert(usersTable)
      .values({ ...profile, clerkUserId })
      .returning();

    res.status(201).json(CreateUserResponse.parse({ ...user, classesCount: 0 }));
  } catch (error) {
    if (clerkUserId) {
      await clerkClient.users.deleteUser(clerkUserId).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "Unable to create user.";
    const isClerkConflict = /already exists|email/i.test(message);
    res.status(isClerkConflict ? 409 : 500).json({
      error: isClerkConflict ? "A Clerk account with this email already exists." : "Unable to create the user account.",
    });
  }
});

router.patch("/users/:userId", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const changes = body.data.email
    ? { ...body.data, email: normalizeEmail(body.data.email) }
    : body.data;
  if (changes.email) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(sql`lower(${usersTable.email}) = lower(${changes.email})`, sql`${usersTable.id} <> ${params.data.userId}`))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists." });
      return;
    }
  }
  const [user] = await db
    .update(usersTable)
    .set(changes)
    .where(eq(usersTable.id, params.data.userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateUserResponse.parse({ ...user, classesCount: 0 }));
});

router.patch("/users/:userId/password", async (req, res): Promise<void> => {
  const params = ResetUserPasswordParams.safeParse(req.params);
  const body = ResetUserPasswordBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, clerkUserId: usersTable.clerkUserId })
    .from(usersTable)
    .where(eq(usersTable.id, params.data.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!user.clerkUserId) {
    res.status(409).json({ error: "This user is not linked to a Clerk account." });
    return;
  }

  try {
    await clerkClient.users.updateUser(user.clerkUserId, {
      password: body.data.password,
      signOutOfOtherSessions: body.data.signOutOfOtherSessions,
    });
  } catch {
    req.log.warn(
      { event: "admin_password_update_failed", localUserId: user.id },
      "Unable to update the Clerk password",
    );
    res.status(400).json({ error: "Unable to set the new password. Check Clerk's password requirements." });
    return;
  }

  res.json(ResetUserPasswordResponse.parse({ success: true }));
});

router.delete("/users/:userId", async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/classes", async (req, res): Promise<void> => {
  const parsed = ListClassesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.search) filters.push(ilike(classesTable.name, `%${parsed.data.search}%`));
  if (parsed.data.status) filters.push(eq(classesTable.status, parsed.data.status));
  const rows = await db
    .select()
    .from(classesTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(classesTable.name);

  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const classes = await Promise.all(
    rows.map(async (classRow) => {
      const [studentCountRows, moduleCountRows] = await Promise.all([
        db.select({ value: count() }).from(classStudentsTable).where(eq(classStudentsTable.classId, classRow.id)),
        db.select({ value: count() }).from(classModulesTable).where(eq(classModulesTable.classId, classRow.id)),
      ]);
      const teacher = classRow.teacherId ? userMap.get(classRow.teacherId) : undefined;
      return {
        id: classRow.id,
        name: classRow.name,
        level: classRow.level,
        academicYear: classRow.academicYear,
        status: classRow.status,
        teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
        studentCount: Number(studentCountRows[0]?.value ?? 0),
        moduleCount: Number(moduleCountRows[0]?.value ?? 0),
        createdAt: classRow.createdAt,
      };
    }),
  );
  res.json(ListClassesResponse.parse(classes));
});

router.post("/classes", async (req, res): Promise<void> => {
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [classRow] = await db.insert(classesTable).values(parsed.data).returning();
  res.status(201).json(
    CreateClassResponse.parse({
      ...classRow,
      teacher: null,
      studentCount: 0,
      moduleCount: 0,
    }),
  );
});

router.patch("/classes/:classId", async (req, res): Promise<void> => {
  const params = UpdateClassParams.safeParse(req.params);
  const body = UpdateClassBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [classRow] = await db
    .update(classesTable)
    .set(body.data)
    .where(eq(classesTable.id, params.data.classId))
    .returning();
  if (!classRow) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(
    UpdateClassResponse.parse({
      ...classRow,
      teacher: null,
      studentCount: 0,
      moduleCount: 0,
    }),
  );
});

router.delete("/classes/:classId", async (req, res): Promise<void> => {
  const params = DeleteClassParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(classStudentsTable).where(eq(classStudentsTable.classId, params.data.classId));
  await db.delete(classModulesTable).where(eq(classModulesTable.classId, params.data.classId));
  const [classRow] = await db.delete(classesTable).where(eq(classesTable.id, params.data.classId)).returning();
  if (!classRow) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/classes/:classId/assignments", async (req, res): Promise<void> => {
  const params = GetClassAssignmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const assignments = await classAssignments(params.data.classId);
  if (!assignments) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(GetClassAssignmentsResponse.parse(assignments));
});

router.put("/classes/:classId/teacher", async (req, res): Promise<void> => {
  const params = AssignClassTeacherParams.safeParse(req.params);
  const body = AssignClassTeacherBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [teacher] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, body.data.teacherId), eq(usersTable.role, "teacher")));
  if (!teacher) {
    res.status(400).json({ error: "A teacher user is required" });
    return;
  }
  await db.update(classesTable).set({ teacherId: teacher.id }).where(eq(classesTable.id, params.data.classId));
  const assignments = await classAssignments(params.data.classId);
  if (!assignments) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(AssignClassTeacherResponse.parse(assignments));
});

router.put("/classes/:classId/modules", async (req, res): Promise<void> => {
  const params = AssignClassModulesParams.safeParse(req.params);
  const body = AssignClassModulesBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const existing = await db.select({ id: modulesTable.id }).from(modulesTable).where(inArray(modulesTable.id, body.data.moduleIds));
  if (existing.length !== body.data.moduleIds.length) {
    res.status(400).json({ error: "One or more modules do not exist" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(classModulesTable).where(eq(classModulesTable.classId, params.data.classId));
    if (body.data.moduleIds.length > 0) {
      await tx.insert(classModulesTable).values(body.data.moduleIds.map((moduleId) => ({ classId: params.data.classId, moduleId })));
    }
  });
  const assignments = await classAssignments(params.data.classId);
  if (!assignments) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(AssignClassModulesResponse.parse(assignments));
});

router.put("/classes/:classId/students", async (req, res): Promise<void> => {
  const params = AssignClassStudentsParams.safeParse(req.params);
  const body = AssignClassStudentsBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(and(inArray(usersTable.id, body.data.studentIds), eq(usersTable.role, "student")));
  if (existing.length !== body.data.studentIds.length) {
    res.status(400).json({ error: "One or more students do not exist" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(classStudentsTable).where(eq(classStudentsTable.classId, params.data.classId));
    if (body.data.studentIds.length > 0) {
      await tx.insert(classStudentsTable).values(body.data.studentIds.map((studentId) => ({ classId: params.data.classId, studentId })));
    }
  });
  const assignments = await classAssignments(params.data.classId);
  if (!assignments) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(AssignClassStudentsResponse.parse(assignments));
});

router.get("/modules", async (_req, res): Promise<void> => {
  const modules = await db
    .select({
      id: modulesTable.id,
      slug: modulesTable.slug,
      name: modulesTable.name,
      shortDescription: modulesTable.shortDescription,
      color: modulesTable.color,
      activityCount: modulesTable.activityCount,
      editorUrl: modulesTable.editorUrl,
      repositoryUrl: modulesTable.repositoryUrl,
    })
    .from(modulesTable)
    .orderBy(modulesTable.id);
  res.json(ListModulesResponse.parse(modules));
});

export default router;