import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import teacherRouter from "./teacher";
import studentRouter from "./student";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teacherRouter);
router.use(studentRouter);
// Admin routes use root-level API paths, so mount the specific teacher and
// current-user routes first; the admin router's guard then protects only its
// own remaining endpoints.
router.use(adminRouter);

export default router;
