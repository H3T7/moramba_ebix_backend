import { prisma } from "./client.js";
import { hashPassword } from "../lib/password.js";

/**
 * A migration creates the SHAPE of your database; a seed script fills it
 * with actual STARTING DATA. Run with: npm run db:seed
 * Safe to re-run — it clears the relevant tables first.
 */

const DEMO_PASSWORD = "Password123!";

async function main() {
  console.log("🌱 Seeding database...");

  // Same child-before-parent order as wipe.ts.
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

  const aurelia = await prisma.company.create({
    data: {
      name: "Aurelia Textiles Pvt. Ltd.",
      logoText: "AT",
      logoColor: "#14213D",
      taxId: "24AATCA1234B1ZP",
      currency: "INR",
      address: {
        line1: "402, Silver Business Hub",
        line2: "Ring Road",
        city: "Surat",
        state: "Gujarat",
        zip: "395002",
        country: "India",
      },
      bank: {
        accountName: "Aurelia Textiles Pvt. Ltd.",
        accountNumber: "50100234567890",
        bankName: "HDFC Bank",
        ifsc: "HDFC0001234",
        swiftCode: "HDFCINBB",
        branch: "Ring Road, Surat",
      },
    },
  });

  const northbridge = await prisma.company.create({
    data: {
      name: "Northbridge Consulting LLP",
      logoText: "NC",
      logoColor: "#1C2C4F",
      taxId: "27AAECN5678C1Z4",
      currency: "INR",
      address: {
        line1: "12th Floor, Orion Towers",
        line2: "Bandra Kurla Complex",
        city: "Mumbai",
        state: "Maharashtra",
        zip: "400051",
        country: "India",
      },
      bank: {
        accountName: "Northbridge Consulting LLP",
        accountNumber: "917020045612378",
        bankName: "ICICI Bank",
        ifsc: "ICIC0000456",
        swiftCode: "ICICINBB",
        branch: "BKC, Mumbai",
      },
    },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const seedEmployees = [
    { employeeCode: "AT-EMP-001", firstName: "Karan", lastName: "Mehta", email: "karan.mehta@aureliatex.com", phone: "+91 98250 11223", department: "Management", designation: "Managing Director", role: "admin" as const, dateOfJoining: "2024-04-01" },
    { employeeCode: "AT-EMP-002", firstName: "Priya", lastName: "Shah", email: "priya.shah@aureliatex.com", phone: "+91 98240 55678", department: "Human Resources", designation: "HR Manager", role: "hr" as const, dateOfJoining: "2024-05-10" },
    { employeeCode: "AT-EMP-003", firstName: "Rohit", lastName: "Deshmukh", email: "rohit.deshmukh@aureliatex.com", phone: "+91 90210 33445", department: "Finance", designation: "Senior Accountant", role: "accountant" as const, dateOfJoining: "2024-06-01" },
    { employeeCode: "AT-EMP-004", firstName: "Anjali", lastName: "Verma", email: "anjali.verma@aureliatex.com", phone: "+91 99789 66112", department: "Design", designation: "Textile Designer", role: "employee" as const, dateOfJoining: "2024-08-19" },
    { employeeCode: "AT-EMP-005", firstName: "Vikram", lastName: "Nair", email: "vikram.nair@aureliatex.com", phone: "+91 97250 88776", department: "Sales", designation: "Sales Executive", role: "employee" as const, dateOfJoining: "2025-01-06" },
  ];

  for (const emp of seedEmployees) {
    const user = await prisma.user.create({
      data: { firstName: emp.firstName, lastName: emp.lastName, email: emp.email, phone: emp.phone, passwordHash },
    });

    await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: aurelia.id,
        employeeCode: emp.employeeCode,
        department: emp.department,
        designation: emp.designation,
        role: emp.role,
        dateOfJoining: new Date(emp.dateOfJoining),
      },
    });

    // Karan also gets access to a second company, as its Owner, so you
    // have a real account to test the "Select Company" screen with, and
    // to see the SAME person hold a DIFFERENT role at each company.
    if (emp.employeeCode === "AT-EMP-001") {
      await prisma.employee.create({ data: { userId: user.id, companyId: northbridge.id, role: "owner" } });
    }
  }

  const seedVerifiers = [
    { name: "Meera Iyer", email: "meera.iyer@moramba.com", specialization: "Export Documentation", avatarColor: "#503589" },
    { name: "Arjun Kapoor", email: "arjun.kapoor@moramba.com", specialization: "Customs & Compliance", avatarColor: "#6647ab" },
    { name: "Fatima Noor", email: "fatima.noor@moramba.com", specialization: "Import Documentation", avatarColor: "#7c5ec4" },
  ];
  for (const v of seedVerifiers) {
    await prisma.verifier.create({ data: { ...v, passwordHash } });
  }

  // ---- Customers (export-side master) ----
  await prisma.customer.createMany({
    data: [
      { companyId: aurelia.id, name: "Meridian Retail Group", country: "United States", email: "accounts@meridianretail.com", phone: "+1 212 555 0148", address: "455 Madison Avenue, New York, NY 10022, United States", gstin: "US-EIN-84-3312207" },
      { companyId: aurelia.id, name: "Sunrise Garments Co.", country: "United Kingdom", email: "billing@sunrisegarments.co.uk", phone: "+44 161 555 0113", address: "Unit 4, Trafford Business Park, Manchester M17 1EH, United Kingdom", gstin: "GB-VAT-778442019" },
      { companyId: aurelia.id, name: "Kaveri Home Furnishings", country: "Germany", email: "finance@kaverihf.de", phone: "+49 40 555 01827", address: "Speicherstadt 12, 20457 Hamburg, Germany", gstin: "DE-VAT-311244879" },
      { companyId: aurelia.id, name: "Blue Horizon Exports", country: "United Arab Emirates", email: "ap@bluehorizontrading.ae", phone: "+971 4 555 3312", address: "Jebel Ali Free Zone, Dubai, United Arab Emirates", gstin: "AE-TRN-100234456700003" },
    ],
  });

  // ---- Vendors (import-side master) ----
  await prisma.vendor.createMany({
    data: [
      { companyId: aurelia.id, name: "Guangzhou Silk Weaving Co.", country: "China", email: "sales@gzsilk.cn", phone: "+86 20 3891 2200", address: "18 Textile Ave, Panyu District, Guangzhou, China", gstin: "91442000MA5CJ8Q", category: "Raw Material" },
      { companyId: aurelia.id, name: "PowerGrid Utilities", country: "India", email: "billing@powergrid.example", phone: "1800 233 3435", address: "Utility Bhavan, Surat, GJ, India", gstin: "24AAACP1234J1ZL", category: "Utilities" },
      { companyId: aurelia.id, name: "Anatolia Dyestuff Industries", country: "Turkey", email: "export@anatoliadye.com.tr", phone: "+90 212 553 4410", address: "Organize Sanayi Bölgesi, Istanbul, Turkey", gstin: "TR-8802214410", category: "Raw Material" },
      { companyId: aurelia.id, name: "Swift Freight Forwarders Pvt Ltd", country: "India", email: "ops@swiftfreight.in", phone: "+91 90330 44556", address: "Sachin GIDC, Surat, GJ, India", gstin: "24AACCS7788K1Z7", category: "Logistics" },
    ],
  });

  // ---- Products ----
  await prisma.product.createMany({
    data: [
      { companyId: aurelia.id, itemCode: "AT-ITM-1001", name: "Cotton Fabric Roll - 60\"", sku: "CTN-60-RL", category: "Fabric", unit: "meters", hsCode: "5208.52", defaultRate: "145.00", currency: "INR" },
      { companyId: aurelia.id, itemCode: "AT-ITM-1002", name: "Polyester Blend Fabric", sku: "PLY-BLD-30", category: "Fabric", unit: "meters", hsCode: "5407.61", defaultRate: "98.00", currency: "INR" },
      { companyId: aurelia.id, itemCode: "AT-ITM-1003", name: "Home Furnishing Linen", sku: "LIN-HF-20", category: "Fabric", unit: "meters", hsCode: "5309.19", defaultRate: "210.00", currency: "INR" },
      { companyId: aurelia.id, itemCode: "AT-ITM-1004", name: "Export Grade Denim", sku: "DNM-EXP-80", category: "Fabric", unit: "meters", hsCode: "5209.42", defaultRate: "165.00", currency: "INR" },
      { companyId: aurelia.id, itemCode: "AT-ITM-1005", name: "Raw Silk Yarn - 40s Count", sku: "SLK-40-YRN", category: "Raw Material", unit: "kg", hsCode: "5004.00", defaultRate: "210.00", currency: "INR" },
      { companyId: aurelia.id, itemCode: "AT-ITM-1006", name: "Reactive Dyestuff", sku: "DYE-RCT-06", category: "Raw Material", unit: "drums", hsCode: "3204.16", defaultRate: "42000.00", currency: "INR" },
    ],
  });

  console.log("✅ Seed complete.");
  console.log("");
  console.log("   Company workspace logins (password for all: " + DEMO_PASSWORD + ")");
  seedEmployees.forEach((e) => console.log(`     ${e.email}  (${e.role})`));
  console.log("");
  console.log("   Verification Portal logins (same password):");
  seedVerifiers.forEach((v) => console.log(`     ${v.email}`));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
