import { Router } from "express";
import { list, getOne, create, update, remove } from "./product.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/**
 * RBAC matches the frontend: Products is Admin + Accountant + HR — wider
 * access than Customers/Vendors, since HR also needs the catalog (e.g. for
 * anything that references products outside pure trade finance).
 */
export const productRouter = Router();
export const companyProductRouter = Router();

companyProductRouter.get("/:companyId/products", requireAuth, requireRole("admin", "accountant", "hr"), list);
companyProductRouter.post("/:companyId/products", requireAuth, requireRole("admin", "accountant", "hr"), create);

productRouter.get("/:id", requireAuth, requireRole("admin", "accountant", "hr"), getOne);
productRouter.patch("/:id", requireAuth, requireRole("admin", "accountant", "hr"), update);
productRouter.delete("/:id", requireAuth, requireRole("admin", "accountant", "hr"), remove);
