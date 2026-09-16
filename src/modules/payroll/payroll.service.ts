import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateSalaryStructureInput, GenerateRunInput } from "./payroll.schema.js";

export async function createSalaryStructure(companyId: string, input: CreateSalaryStructureInput) {
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId } });
  if (!employee) throw new AppError(404, "That employee doesn't exist for this company.");

  // `deductions` (the total) stays authoritative for every existing piece
  // of payroll math that already reads it — computed from the itemized
  // breakdown when the caller didn't send a total directly, rather than
  // defaulting to 0 and quietly dropping pf/tax/otherDeductions.
  const deductions = input.deductions ?? input.pf + input.tax + input.otherDeductions;

  return prisma.salaryStructure.create({
    data: {
      employeeId: input.employeeId,
      companyId,
      basic: input.basic.toFixed(2),
      hra: input.hra.toFixed(2),
      conveyance: input.conveyance.toFixed(2),
      medical: input.medical.toFixed(2),
      special: input.special.toFixed(2),
      pf: input.pf.toFixed(2),
      tax: input.tax.toFixed(2),
      otherDeductions: input.otherDeductions.toFixed(2),
      deductions: deductions.toFixed(2),
      effectiveFrom: input.effectiveFrom,
    },
  });
}

/** Every salary change ever recorded for one employee, most recent first. */
export async function listSalaryHistory(employeeId: string) {
  return prisma.salaryStructure.findMany({ where: { employeeId }, orderBy: { effectiveFrom: "desc" } });
}

/**
 * The structure actually in effect for a given month — the most recent
 * one whose effectiveFrom is on or before it. Computes the REAL last day
 * of the month (via `new Date(year, month, 0)`) rather than a hardcoded
 * `-31`, which would produce the invalid date "2026-09-31" for any
 * 30-day month — a real bug caught and fixed during the original Drizzle
 * version of this function; carried forward correctly here.
 */
async function getCurrentStructure(employeeId: string, asOfMonth: string) {
  const [year, month] = asOfMonth.split("-").map(Number);
  const lastDayOfMonth = new Date(year!, month!, 0).getDate();
  const asOfDate = new Date(`${asOfMonth}-${String(lastDayOfMonth).padStart(2, "0")}`);

  const rows = await prisma.salaryStructure.findMany({
    where: { employeeId, effectiveFrom: { lte: asOfDate } },
    orderBy: { effectiveFrom: "desc" },
    take: 1,
  });
  return rows[0] ?? null;
}

/**
 * Every entry is a frozen snapshot, computed once at generation time —
 * never a live pointer back to SalaryStructure.
 */
export async function generatePayrollRun(companyId: string, generatedByEmployeeId: string, input: GenerateRunInput) {
  const existingRun = await prisma.payrollRun.findFirst({ where: { companyId, month: input.month } });
  if (existingRun) throw new AppError(409, `A payroll run for ${input.month} already exists for this company.`);

  const structures = await Promise.all(input.employeeIds.map((id) => getCurrentStructure(id, input.month)));
  const missing = input.employeeIds.filter((_, i) => !structures[i]);
  if (missing.length > 0) {
    throw new AppError(422, `No salary structure found for ${missing.length} of the selected employee(s) as of ${input.month}.`);
  }

  const run = await prisma.$transaction(async (tx) => {
    const createdRun = await tx.payrollRun.create({
      data: { companyId, month: input.month, generatedByEmployeeId, status: "Processing" },
    });

    for (const [i, employeeId] of input.employeeIds.entries()) {
      const s = structures[i]!;
      const gross = Number(s.basic) + Number(s.hra) + Number(s.conveyance) + Number(s.medical) + Number(s.special);
      const net = gross - Number(s.deductions);
      await tx.payrollEntry.create({
        data: {
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
        },
      });
    }

    return createdRun;
  });

  return getPayrollRun(run.id);
}

export async function listPayrollRuns(companyId: string) {
  return prisma.payrollRun.findMany({ where: { companyId }, orderBy: { month: "desc" } });
}

export async function getPayrollRun(id: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run) throw new AppError(404, "Payroll run not found.");
  const entries = await prisma.payrollEntry.findMany({ where: { payrollRunId: id } });
  const totalNet = entries.reduce((sum, e) => sum + Number(e.netPay), 0);
  return { ...run, entries, totalNet: totalNet.toFixed(2) };
}

export async function updateRunStatus(id: string, status: string) {
  const updated = await prisma.payrollRun.update({ where: { id }, data: { status: status as never } }).catch(() => null);
  if (!updated) throw new AppError(404, "Payroll run not found.");
  return getPayrollRun(updated.id);
}

export async function updateEntryStatus(id: string, status: string) {
  const updated = await prisma.payrollEntry
    .update({ where: { id }, data: { status: status as never, paidAt: status === "Paid" ? new Date() : null } })
    .catch(() => null);
  if (!updated) throw new AppError(404, "Payroll entry not found.");
  return updated;
}
