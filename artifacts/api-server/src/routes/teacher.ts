import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  classesTable,
  classModulesTable,
  modulesTable,
  studentSubmissionsTable,
  teacherActivitiesTable,
  usersTable,
} from "@workspace/db";
import {
  CreateTeacherClassActivityBody,
  CreateTeacherClassActivityParams,
  CreateTeacherClassActivityResponse,
  DeleteTeacherActivityParams,
  GetCurrentUserResponse,
  GetTeacherActivityParams,
  GetTeacherActivityResponse,
  ListTeacherClassActivitiesParams,
  ListTeacherClassActivitiesResponse,
  ListTeacherClassesResponse,
  UpdateTeacherActivityBody,
  UpdateTeacherActivityParams,
  UpdateTeacherActivityResponse,
  ListTeacherActivitySubmissionsResponse,
} from "@workspace/api-zod";
import { resolveCurrentLocalUser, type LocalUser } from "../lib/localAuth";

const router: IRouter = Router();

async function requireTeacher(req: Request, res: Response): Promise<LocalUser | null> {
  const resolution = await resolveCurrentLocalUser(req);
  if (resolution.kind === "unauthenticated") {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (resolution.kind === "unlinked") {
    res.status(404).json({ error: "No local user is linked to this Clerk account." });
    return null;
  }
  if (resolution.kind === "conflict") {
    res.status(409).json({ error: "This local profile is linked to a different Clerk account." });
    return null;
  }
  if (resolution.kind === "lookup_failed") {
    res.status(502).json({ error: "Unable to verify the Clerk account." });
    return null;
  }
  if (resolution.user.role !== "teacher" || resolution.user.status !== "active") {
    req.log.warn(
      { event: "teacher_authorization_failed", reason: "wrong_or_inactive_role", localUserId: resolution.user.id },
      "Teacher authorization failed",
    );
    res.status(403).json({ error: "An active teacher account is required." });
    return null;
  }
  return resolution.user;
}

async function requireOwnedClass(classId: number, teacherId: number, res: Response): Promise<boolean> {
  const [classRow] = await db
    .select({ id: classesTable.id })
    .from(classesTable)
    .where(and(eq(classesTable.id, classId), eq(classesTable.teacherId, teacherId)))
    .limit(1);
  if (!classRow) {
    res.status(404).json({ error: "Class not found or not assigned to this teacher." });
    return false;
  }
  return true;
}

async function requireAssignedModule(classId: number, moduleId: number, res: Response): Promise<boolean> {
  const [assignment] = await db
    .select({ moduleId: classModulesTable.moduleId })
    .from(classModulesTable)
    .where(and(eq(classModulesTable.classId, classId), eq(classModulesTable.moduleId, moduleId)))
    .limit(1);
  if (!assignment) {
    res.status(400).json({ error: "The selected module is not assigned to this class." });
    return false;
  }
  return true;
}

router.get("/me", async (req, res): Promise<void> => {
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
  const user = resolution.user;
  req.log.info({ localUserId: user.id }, "Current local user retrieved");
  res.json(GetCurrentUserResponse.parse(user));
});

router.get("/teacher/classes", async (req, res): Promise<void> => {
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const classes = await db.select().from(classesTable).where(eq(classesTable.teacherId, teacher.id)).orderBy(classesTable.name);
  const result = await Promise.all(
    classes.map(async (classRow) => {
      const [modules, activityRows] = await Promise.all([
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
          .where(eq(classModulesTable.classId, classRow.id))
          .orderBy(modulesTable.name),
        db.select({ value: count() }).from(teacherActivitiesTable).where(eq(teacherActivitiesTable.classId, classRow.id)),
      ]);
      return { ...classRow, modules, activityCount: Number(activityRows[0]?.value ?? 0) };
    }),
  );
  req.log.info({ teacherId: teacher.id, classCount: result.length }, "Teacher classes retrieved");
  res.json(ListTeacherClassesResponse.parse(result));
});

router.get("/teacher/classes/:classId/activities", async (req, res): Promise<void> => {
  const params = ListTeacherClassActivitiesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const teacher = await requireTeacher(req, res);
  if (!teacher || !(await requireOwnedClass(params.data.classId, teacher.id, res))) return;
  const activities = await db
    .select()
    .from(teacherActivitiesTable)
    .where(eq(teacherActivitiesTable.classId, params.data.classId))
    .orderBy(desc(teacherActivitiesTable.updatedAt));
  req.log.info({ teacherId: teacher.id, classId: params.data.classId, activityCount: activities.length }, "Teacher activities retrieved");
  res.json(ListTeacherClassActivitiesResponse.parse(activities));
});

router.post("/teacher/classes/:classId/activities", async (req, res): Promise<void> => {
  const params = CreateTeacherClassActivityParams.safeParse(req.params);
  const body = CreateTeacherClassActivityBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const teacher = await requireTeacher(req, res);
  if (!teacher || !(await requireOwnedClass(params.data.classId, teacher.id, res))) return;
  if (!(await requireAssignedModule(params.data.classId, body.data.moduleId, res))) return;
  const [activity] = await db
    .insert(teacherActivitiesTable)
    .values({
      classId: params.data.classId,
      createdByUserId: teacher.id,
      moduleId: body.data.moduleId,
      title: body.data.title,
      instructions: body.data.instructions,
      editorMode: body.data.editorMode,
      blockXml: body.data.blockXml ?? "",
      sourceCode: body.data.sourceCode ?? "",
    })
    .returning();
  req.log.info({ teacherId: teacher.id, classId: params.data.classId, activityId: activity.id }, "Teacher activity created");
  res.status(201).json(CreateTeacherClassActivityResponse.parse(activity));
});

async function ownedActivity(activityId: number, teacherId: number, res: Response) {
  const [activity] = await db.select().from(teacherActivitiesTable).where(eq(teacherActivitiesTable.id, activityId)).limit(1);
  if (!activity) {
    res.status(404).json({ error: "Activity not found." });
    return null;
  }
  if (!(await requireOwnedClass(activity.classId, teacherId, res))) return null;
  return activity;
}

router.get("/teacher/activities/:activityId", async (req, res): Promise<void> => {
  const params = GetTeacherActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const activity = await ownedActivity(params.data.activityId, teacher.id, res);
  if (!activity) return;
  req.log.info({ teacherId: teacher.id, activityId: activity.id }, "Teacher activity retrieved");
  res.json(GetTeacherActivityResponse.parse(activity));
});

router.patch("/teacher/activities/:activityId", async (req, res): Promise<void> => {
  const params = UpdateTeacherActivityParams.safeParse(req.params);
  const body = UpdateTeacherActivityBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const activity = await ownedActivity(params.data.activityId, teacher.id, res);
  if (!activity) return;
  if (body.data.moduleId && !(await requireAssignedModule(activity.classId, body.data.moduleId, res))) return;
  const [updated] = await db
    .update(teacherActivitiesTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(teacherActivitiesTable.id, activity.id))
    .returning();
  req.log.info({ teacherId: teacher.id, activityId: activity.id }, "Teacher activity updated");
  res.json(UpdateTeacherActivityResponse.parse(updated));
});

router.delete("/teacher/activities/:activityId", async (req, res): Promise<void> => {
  const params = DeleteTeacherActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const activity = await ownedActivity(params.data.activityId, teacher.id, res);
  if (!activity) return;
  await db.delete(teacherActivitiesTable).where(eq(teacherActivitiesTable.id, activity.id));
  req.log.info({ teacherId: teacher.id, activityId: activity.id }, "Teacher activity deleted");
  res.sendStatus(204);
});

router.get("/teacher/activities/:activityId/submissions", async (req, res): Promise<void> => {
  const params = GetTeacherActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const activity = await ownedActivity(params.data.activityId, teacher.id, res);
  if (!activity) return;

  const rows = await db
    .select({
      submission: studentSubmissionsTable,
      student: usersTable,
    })
    .from(studentSubmissionsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentSubmissionsTable.studentId))
    .where(eq(studentSubmissionsTable.activityId, activity.id))
    .orderBy(desc(studentSubmissionsTable.updatedAt));

  res.json(
    ListTeacherActivitySubmissionsResponse.parse(
      rows.map(({ submission, student }) => ({
        id: submission.id,
        activityId: submission.activityId,
        studentId: submission.studentId,
        studentName: student.name,
        studentEmail: student.email,
        editorMode: submission.editorMode,
        blockXml: submission.blockXml,
        sourceCode: submission.sourceCode,
        status: submission.status,
        submittedAt: submission.submittedAt,
        updatedAt: submission.updatedAt,
      })),
    ),
  );
});

export default router;