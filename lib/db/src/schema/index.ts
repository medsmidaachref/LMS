// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").unique(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    role: text("role").notNull().default("student"),
    status: text("status").notNull().default("active"),
    avatar: text("avatar"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`)],
);

export const classesTable = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  level: text("level").notNull(),
  academicYear: text("academic_year").notNull(),
  status: text("status").notNull().default("active"),
  teacherId: integer("teacher_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modulesTable = pgTable("modules", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortDescription: text("short_description").notNull(),
  color: text("color").notNull(),
  activityCount: integer("activity_count").notNull().default(0),
  editorUrl: text("editor_url").notNull(),
  repositoryUrl: text("repository_url").notNull(),
});

export const classStudentsTable = pgTable(
  "class_students",
  {
    classId: integer("class_id").notNull(),
    studentId: integer("student_id").notNull(),
  },
  (table) => [unique().on(table.classId, table.studentId)],
);

export const classModulesTable = pgTable(
  "class_modules",
  {
    classId: integer("class_id").notNull(),
    moduleId: integer("module_id").notNull(),
  },
  (table) => [unique().on(table.classId, table.moduleId)],
);

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teacherActivitiesTable = pgTable("teacher_activities", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  moduleId: integer("module_id").notNull(),
  createdByUserId: integer("created_by_user_id").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  editorMode: text("editor_mode").notNull(),
  blockXml: text("block_xml").notNull().default(""),
  sourceCode: text("source_code").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentSubmissionsTable = pgTable(
  "student_submissions",
  {
    id: serial("id").primaryKey(),
    activityId: integer("activity_id").notNull(),
    studentId: integer("student_id").notNull(),
    editorMode: text("editor_mode").notNull(),
    blockXml: text("block_xml").notNull().default(""),
    sourceCode: text("source_code").notNull().default(""),
    status: text("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.activityId, table.studentId)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertClassSchema = createInsertSchema(classesTable).omit({
  id: true,
  createdAt: true,
});
export const insertModuleSchema = createInsertSchema(modulesTable).omit({
  id: true,
});
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});
export const insertTeacherActivitySchema = createInsertSchema(teacherActivitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type Class = typeof classesTable.$inferSelect;
export type Module = typeof modulesTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
export type TeacherActivity = typeof teacherActivitiesTable.$inferSelect;
export type StudentSubmission = typeof studentSubmissionsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClass = z.infer<typeof insertClassSchema>;