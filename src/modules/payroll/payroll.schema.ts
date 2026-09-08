import { z } from "zod";

export const createSalaryStructureSchema = z.object({
  employeeId: z.string().uuid(),
  basic: z.coerce.number().min(0),
  hra: z.coerce.number().min(0).default(0),
  conveyance: z.coerce.number().min(0).default(0),
  medical: z.coerce.number().min(0).default(0),
  special: z.coerce.number().min(0).default(0),
  deductions: z.coerce.number().min(0).default(0),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});
export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;

export const generateRunSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format"),
  employeeIds: z.array(z.string().uuid()).min(1, "Select at least one employee"),
});
export type GenerateRunInput = z.infer<typeof generateRunSchema>;

export const updateEntryStatusSchema = z.object({
  status: z.enum(["Pending", "Processed", "Paid"]),
});

export const updateRunStatusSchema = z.object({
  status: z.enum(["Pending", "Processing", "Completed"]),
});
