import { Router } from "express";
import { list, getOne, create, update, updateStatus, updateRole, remove } from "./employee.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/**
 * Mounted at TWO base paths in app.ts:
 *   /api/companies/:companyId/employees   → list, create   (nested under a company)
 *   /api/employees                         → getOne, update, delete, status, role (by id)
 *
 * Every route requires a signed-in employee. On top of that, `requireRole`
 * enforces the SAME rule the frontend's rbac.js already applies to the
 * "employees" section: only Admin and HR/Manager may manage the directory.
 * (An Accountant or Employee calling this API directly — bypassing the UI
 * entirely — gets blocked here too, which is the whole point of checking
 * on the backend and not just hiding the button in React.)
 *
 * Role changes are deliberately gated even MORE tightly than the rest —
 * only Admin can promote/demote someone — since letting HR hand out Admin
 * access would be a privilege-escalation hole.
 */
export const employeeRouter = Router();
export const companyEmployeeRouter = Router();

companyEmployeeRouter.get("/:companyId/employees", requireAuth, requireRole("admin", "hr"), list);
companyEmployeeRouter.post("/:companyId/employees", requireAuth, requireRole("admin", "hr"), create);

employeeRouter.get("/:id", requireAuth, requireRole("admin", "hr"), getOne);
employeeRouter.patch("/:id", requireAuth, requireRole("admin", "hr"), update);
employeeRouter.patch("/:id/status", requireAuth, requireRole("admin", "hr"), updateStatus);
employeeRouter.patch("/:id/role", requireAuth, requireRole("admin"), updateRole);
employeeRouter.delete("/:id", requireAuth, requireRole("admin"), remove);
