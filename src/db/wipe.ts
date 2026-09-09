import { prisma } from "./client.js";

/**
 * Unlike `db:seed`, this leaves the database completely empty — no demo
 * company, no demo employees, nothing. Use this to test the real
 * registration -> login -> create company (as Owner) flow from absolute
 * scratch. Run it with: npm run db:wipe
 *
 * deleteMany() on each model, in child-before-parent order, same
 * reasoning as before: you can't delete a company while an employee row
 * still references it. If you add a new model with a foreign key to an
 * existing one, add its cleanup here too, in the right order — forgetting
 * one surfaces as a confusing FK-violation error pointing at whichever
 * table you DIDN'T forget, not the one you did.
 */
async function main() {
  console.log("🧹 Wiping all data (keeping table structure)...");

  await prisma.payrollEntry.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billItem.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.product.deleteMany();
  await prisma.company.deleteMany();
  await prisma.verifier.deleteMany();

  console.log("✅ Database is empty. Register a brand-new account at POST /api/auth/register to start fresh.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Wipe failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
