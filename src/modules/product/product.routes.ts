import { Router } from "express";
import { list, getOne, create, update, remove } from "./product.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const productRouter = Router();
export const companyProductRouter = Router();

const companyIdFromProduct = companyIdFromRecord((id) => prisma.product.findUnique({ where: { id } }), "Product not found.");

companyProductRouter.get("/:companyId/products", requireAuth, requireCompanyParamRole("admin", "accountant", "hr"), list);
companyProductRouter.post("/:companyId/products", requireAuth, requireCompanyParamRole("admin", "accountant", "hr"), create);

productRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromProduct, "admin", "accountant", "hr"), getOne);
productRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromProduct, "admin", "accountant", "hr"), update);
productRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromProduct, "admin", "accountant", "hr"), remove);
