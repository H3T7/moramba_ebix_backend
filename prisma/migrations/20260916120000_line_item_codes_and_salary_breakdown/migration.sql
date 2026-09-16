-- AlterTable: invoice line items gain itemCode/SKU (Bill already had hs_code;
-- neither table had item_code or sku before this migration).
ALTER TABLE "invoice_items" ADD COLUMN     "item_code" TEXT,
ADD COLUMN     "sku" TEXT;

-- AlterTable: bill line items gain the same two columns, for parity with
-- invoice items.
ALTER TABLE "bill_items" ADD COLUMN     "item_code" TEXT,
ADD COLUMN     "sku" TEXT;

-- AlterTable: salary structures gain an itemized deductions breakdown.
-- `deductions` (the total) is kept as-is and remains authoritative for all
-- existing payroll math — these three are additive detail, backfilled to 0
-- for every existing row, which preserves each row's existing `deductions`
-- total exactly as it was.
ALTER TABLE "salary_structures" ADD COLUMN     "pf" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0;
