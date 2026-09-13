import {
  activitiesTable,
  classesTable,
  classModulesTable,
  classStudentsTable,
  modulesTable,
  usersTable,
} from "@workspace/db";
import { db } from "@workspace/db";

const modules = [
  ["thymio", "Thymio", "Robotique créative et programmation par blocs.", "#F4B740", 12],
  ["arduino", "Arduino", "Électronique, capteurs et prototypage.", "#2F80ED", 18],
  ["esp32", "ESP32", "Objets connectés et systèmes embarqués.", "#9B51E0", 14],
  ["python", "Python", "Algorithmique et programmation textuelle.", "#27AE60", 22],
  ["html-css", "HTML & CSS", "Créer des interfaces web interactives.", "#EB5757", 16],
  ["ia", "IA", "Comprendre et expérimenter l’intelligence artificielle.", "#F2994A", 10],
  ["micro-bit", "micro:bit", "Projets physiques et découverte du code.", "#56CCF2", 15],
] as const;

export async function ensureSeedData(): Promise<void> {
  const existingUsers = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existingUsers.length > 0) {
    return;
  }

  const [admin, teacherOne, teacherTwo, studentOne, studentTwo, studentThree] =
    await db
      .insert(usersTable)
      .values([
        { name: "Nadia Ben Salem", email: "nadia@masterclass.tn", role: "admin", status: "active" },
        { name: "Yassine Trabelsi", email: "yassine@masterclass.tn", role: "teacher", status: "active" },
        { name: "Amel Gharbi", email: "amel@masterclass.tn", role: "teacher", status: "active" },
        { name: "Adam Mansour", email: "adam@masterclass.tn", role: "student", status: "active" },
        { name: "Lina Jlassi", email: "lina@masterclass.tn", role: "student", status: "active" },
        { name: "Rayen Kallel", email: "rayen@masterclass.tn", role: "student", status: "invited" },
      ])
      .returning();

  const insertedModules = await db
    .insert(modulesTable)
    .values(
      modules.map(([slug, name, shortDescription, color, activityCount]) => ({
        slug,
        name,
        shortDescription,
        color,
        activityCount,
        editorUrl: "https://vittascience.com/",
        repositoryUrl: "https://github.com/vittascience",
      })),
    )
    .returning();

  const [classOne, classTwo] = await db
    .insert(classesTable)
    .values([
      {
        name: "Explorateurs du numérique",
        level: "Collège · 5e",
        academicYear: "2025–2026",
        status: "active",
        teacherId: teacherOne.id,
      },
      {
        name: "Créateurs de demain",
        level: "Lycée · 2nde",
        academicYear: "2025–2026",
        status: "active",
        teacherId: teacherTwo.id,
      },
      {
        name: "Laboratoire découverte",
        level: "Primaire · CM2",
        academicYear: "2025–2026",
        status: "draft",
        teacherId: null,
      },
    ])
    .returning();

  await db.insert(classStudentsTable).values([
    { classId: classOne.id, studentId: studentOne.id },
    { classId: classOne.id, studentId: studentTwo.id },
    { classId: classTwo.id, studentId: studentTwo.id },
    { classId: classTwo.id, studentId: studentThree.id },
  ]);

  await db.insert(classModulesTable).values([
    { classId: classOne.id, moduleId: insertedModules[0].id },
    { classId: classOne.id, moduleId: insertedModules[1].id },
    { classId: classOne.id, moduleId: insertedModules[6].id },
    { classId: classTwo.id, moduleId: insertedModules[3].id },
    { classId: classTwo.id, moduleId: insertedModules[4].id },
    { classId: classTwo.id, moduleId: insertedModules[5].id },
  ]);

  await db.insert(activitiesTable).values([
    { title: "Classe « Explorateurs du numérique » créée", type: "Classe", time: "Aujourd’hui, 09:42", status: "success" },
    { title: "Yassine Trabelsi affecté à une classe", type: "Affectation", time: "Hier, 16:20", status: "info" },
    { title: "Module Python ajouté au catalogue", type: "Module", time: "Hier, 11:05", status: "success" },
    { title: "Invitation envoyée à Rayen Kallel", type: "Utilisateur", time: "12 sept., 14:30", status: "pending" },
  ]);

  // Keep the seed import explicit so tree-shaking never removes it during builds.
  void admin;
}