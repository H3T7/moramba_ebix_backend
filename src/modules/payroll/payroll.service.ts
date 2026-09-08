import { eq, and, lte, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { salaryStructures, payrollRuns, payrollEntries, employees } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateSalaryStructureInput, GenerateRunInput } from "./payroll.schema.js";

export async function createSalaryStructure(companyId: string, input: CreateSalaryStructureInput) {
  const employee = await db.query.employees.findFirst({ where: and(eq(employees.id, input.employeeId), eq(employees.companyId, companyId)) });
  if (!employee) throw new AppError(404, "That employee doesn't exist for this company.");

  const [created] = await db
    .insert(salaryStructures)
    .values({
      employeeId: input.employeeId,
      companyId,
      basic: input.basic.toFixed(2),
      hra: input.hra.toFixed(2),
      conveyance: input.conveyance.toFixed(2),
      medical: input.medical.toFixed(2),
      special: input.special.toFixed(2),
      deductions: input.deductions.toFixed(2),
      effectiveFrom: input.effectiveFrom,
    })
    .returning();

  return created;
}

/** Every salary change ever recorded for one employee, most recent first — not just the current figure. */
export async function listSalaryHistory(employeeId: string) {
  return db.select().from(salaryStructures).where(eq(salaryStructures.employeeId, employeeId)).orderBy(desc(salaryStructures.effectiveFrom));
}

/** The structure actually in effect for a given month — the most recent one whose effectiveFrom is on or before it. */
async function getCurrentStructure(employeeId: string, asOfMonth: string) {
  const [year, month] = asOfMonth.split("-").map(Number);
  const lastDayOfMonth = new Date(year!, month!, 0).getDate(); // day 0 of "next month" = last real day of this month
  const asOfDate = `${asOfMonth}-${String(lastDayOfMonth).padStart(2, "0")}`;
  const rows = await db
    .select()
    .from(salaryStructures)
    .where(and(eq(salaryStructures.employeeId, employeeId), lte(salaryStructures.effectiveFrom, asOfDate)))
    .orderBy(desc(salaryStructures.effectiveFrom))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Every entry is a frozen snapshot, computed once at generation time from
 * whichever salary structure was actually in effect that month — never a
 * live pointer back to salary_structures. A raise given next month must
 * never silently change what THIS payslip says was paid.
 */
export async function generatePayrollRun(companyId: string, generatedByEmployeeId: string, input: GenerateRunInput) {
  const existingRun = await db.query.payrollRuns.findFirst({ where: and(eq(payrollRuns.companyId, companyId), eq(payrollRuns.month, input.month)) });
  if (existingRun) throw new AppError(409, `A payroll run for ${input.month} already exists for this company.`);

  const structures = await Promise.all(input.employeeIds.map((id) => getCurrentStructure(id, input.month)));
  const missing = input.employeeIds.filter((_, i) => !structures[i]);
  if (missing.length > 0) {
    throw new AppError(422, `No salary structure found for ${missing.length} of the selected employee(s) as of ${input.month}.`);
  }

  const run = await db.transaction(async (tx) => {
    const [createdRun] = await tx
      .insert(payrollRuns)
      .values({ companyId, month: input.month, generatedByEmployeeId, status: "Processing" })
      .returning();

    const entryValues = input.employeeIds.map((employeeId, i) => {
      const s = structures[i]!;
      const gross = Number(s.basic) + Number(s.hra) + Number(s.conveyance) + Number(s.medical) + Number(s.special);
      const net = gross - Number(s.deductions);
      return {
        payrollRunId: createdRun.id,
        employeeId,
        basic: s.basic,
        hra: s.hra,
        conveyance: s.conveyance,
        medical: s.medical,
        special: s.special,
        grossPay: gross.toFixed(2),
        deductions: s.deductions,
        netPay: net.toFixed(2),
      };
    });

    await tx.insert(payrollEntries).values(entryValues);
    return createdRun;
  });

  return getPayrollRun(run.id);
}

export async function listPayrollRuns(companyId: string) {
  return db.select().from(payrollRuns).where(eq(payrollRuns.companyId, companyId)).orderBy(desc(payrollRuns.month));
}

export async function getPayrollRun(id: string) {
  const run = await db.query.payrollRuns.findFirst({ where: eq(payrollRuns.id, id) });
  if (!run) throw new AppError(404, "Payroll run not found.");
  const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.payrollRunId, id));
  const totalNet = entries.reduce((sum, e) => sum + Number(e.netPay), 0);
  return { ...run, entries, totalNet: totalNet.toFixed(2) };
}

export async function updateRunStatus(id: string, status: string) {
  const [updated] = await db
    .update(payrollRuns)
    .set({ status: status as typeof payrollRuns.$inferSelect.status })
    .where(eq(payrollRuns.id, id))
    .returning();
  if (!updated) throw new AppError(404, "Payroll run not found.");
  return getPayrollRun(updated.id);
}

export async function updateEntryStatus(id: string, status: string) {
  const [updated] = await db
    .update(payrollEntries)
    .set({
      status: status as typeof payrollEntries.$inferSelect.status,
      paidAt: status === "Paid" ? new Date() : null,
    })
    .where(eq(payrollEntries.id, id))
    .returning();
  if (!updated) throw new AppError(404, "Payroll entry not found.");
  return updated;
}
