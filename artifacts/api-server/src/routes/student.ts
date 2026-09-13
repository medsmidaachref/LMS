import { and, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  classesTable,
  classModulesTable,
  classStudentsTable,
  modulesTable,
  studentSubmissionsTable,
  teacherActivitiesTable,
} from "@workspace/db";
import {
  GetStudentActivityParams,
  GetStudentActivityResponse,
  ListStudentClassActivitiesParams,
  ListStudentClassActivitiesResponse,
  ListStudentClassesResponse,
  SaveStudentSubmissionBody,
  SaveStudentSubmissionParams,
  SaveStudentSubmissionResponse,
  StudentActivity,
  StudentSubmission,
} from "@workspace/api-zod";
import { resolveCurrentLocalUser, type LocalUser } from "../lib/localAuth";

const router: IRouter = Router();

async function requireStudent(req: Request, res: Response): Promise<LocalUser | null> {
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
  if (resolution.user.role !== "student" || resolution.user.status !== "active") {
    res.status(403).json({ error: "An active student account is required." });
    return null;
  }
  return resolution.user;
}

async function requireClassMembership(classId: number, studentId: number, res: Response): Promise<boolean> {
  const [membership] = await db
    .select({ classId: classStudentsTable.classId })
    .from(classStudentsTable)
    .where(and(eq(classStudentsTable.classId, classId), eq(classStudentsTable.studentId, studentId)))
    .limit(1);
  if (!membership) {
    res.status(404).json({ error: "Class not found or not assigned to this student." });
    return false;
  }
  return true;
}

async function findStudentActivity(activityId: number, studentId: number, res: Response) {
  const [row] = await db
    .select({
      activity: teacherActivitiesTable,
      module: modulesTable,
    })
    .from(teacherActivitiesTable)
    .innerJoin(modulesTable, eq(modulesTable.id, teacherActivitiesTable.moduleId))
    .innerJoin(classStudentsTable, eq(classStudentsTable.classId, teacherActivitiesTable.classId))
    .where(and(eq(teacherActivitiesTable.id, activityId), eq(classStudentsTable.studentId, studentId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Activity not found or not assigned to this student." });
    return null;
  }
  return row;
}

async function getSubmission(activityId: number, studentId: number) {
  const [submission] = await db
    .select()
    .from(studentSubmissionsTable)
    .where(and(eq(studentSubmissionsTable.activityId, activityId), eq(studentSubmissionsTable.studentId, studentId)))
    .limit(1);
  return submission ?? null;
}

function studentActivityResponse(
  activity: typeof teacherActivitiesTable.$inferSelect,
  module: typeof modulesTable.$inferSelect,
  submission: typeof studentSubmissionsTable.$inferSelect | null,
) {
  return {
    id: activity.id,
    classId: activity.classId,
    moduleId: activity.moduleId,
    title: activity.title,
    instructions: activity.instructions,
    editorMode: activity.editorMode,
    blockXml: activity.blockXml,
    sourceCode: activity.sourceCode,
    module,
    submission,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

router.get("/student/classes", async (req, res): Promise<void> => {
  const student = await requireStudent(req, res);
  if (!student) return;

  const classes = await db
    .select({ classRow: classesTable })
    .from(classStudentsTable)
    .innerJoin(classesTable, eq(classesTable.id, classStudentsTable.classId))
    .where(eq(classStudentsTable.studentId, student.id))
    .orderBy(classesTable.name);

  const result = await Promise.all(
    classes.map(async ({ classRow }) => {
      const [modules, activityRows, submittedRows] = await Promise.all([
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
        db
          .select({ value: count() })
          .from(studentSubmissionsTable)
          .innerJoin(teacherActivitiesTable, eq(teacherActivitiesTable.id, studentSubmissionsTable.activityId))
          .where(
            and(
              eq(teacherActivitiesTable.classId, classRow.id),
              eq(studentSubmissionsTable.studentId, student.id),
              eq(studentSubmissionsTable.status, "submitted"),
            ),
          ),
      ]);
      return {
        ...classRow,
        modules,
        activityCount: Number(activityRows[0]?.value ?? 0),
        submittedCount: Number(submittedRows[0]?.value ?? 0),
      };
    }),
  );

  res.json(ListStudentClassesResponse.parse(result));
});

router.get("/student/classes/:classId/activities", async (req, res): Promise<void> => {
  const params = ListStudentClassActivitiesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const student = await requireStudent(req, res);
  if (!student || !(await requireClassMembership(params.data.classId, student.id, res))) return;

  const rows = await db
    .select({
      activity: teacherActivitiesTable,
      module: modulesTable,
      submission: studentSubmissionsTable,
    })
    .from(teacherActivitiesTable)
    .innerJoin(modulesTable, eq(modulesTable.id, teacherActivitiesTable.moduleId))
    .leftJoin(
      studentSubmissionsTable,
      and(eq(studentSubmissionsTable.activityId, teacherActivitiesTable.id), eq(studentSubmissionsTable.studentId, student.id)),
    )
    .where(eq(teacherActivitiesTable.classId, params.data.classId))
    .orderBy(desc(teacherActivitiesTable.updatedAt));

  res.json(
    ListStudentClassActivitiesResponse.parse(
      rows.map(({ activity, module, submission }) => studentActivityResponse(activity, module, submission)),
    ),
  );
});

router.get("/student/activities/:activityId", async (req, res): Promise<void> => {
  const params = GetStudentActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const student = await requireStudent(req, res);
  if (!student) return;
  const row = await findStudentActivity(params.data.activityId, student.id, res);
  if (!row) return;
  const submission = await getSubmission(row.activity.id, student.id);
  res.json(GetStudentActivityResponse.parse(studentActivityResponse(row.activity, row.module, submission)));
});

router.put("/student/activities/:activityId/submission", async (req, res): Promise<void> => {
  const params = SaveStudentSubmissionParams.safeParse(req.params);
  const body = SaveStudentSubmissionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const student = await requireStudent(req, res);
  if (!student) return;
  const row = await findStudentActivity(params.data.activityId, student.id, res);
  if (!row) return;

  const now = new Date();
  const [submission] = await db
    .insert(studentSubmissionsTable)
    .values({
      activityId: row.activity.id,
      studentId: student.id,
      editorMode: body.data.editorMode,
      blockXml: body.data.blockXml ?? "",
      sourceCode: body.data.sourceCode ?? "",
      status: body.data.status,
      submittedAt: body.data.status === "submitted" ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [studentSubmissionsTable.activityId, studentSubmissionsTable.studentId],
      set: {
        editorMode: body.data.editorMode,
        blockXml: body.data.blockXml ?? "",
        sourceCode: body.data.sourceCode ?? "",
        status: body.data.status,
        submittedAt: body.data.status === "submitted" ? now : null,
        updatedAt: now,
      },
    })
    .returning();

  res.json(SaveStudentSubmissionResponse.parse(submission));
});

export default router;