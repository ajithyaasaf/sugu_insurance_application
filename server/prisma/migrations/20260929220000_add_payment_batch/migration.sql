-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "payerType" TEXT NOT NULL,
    "payerId" TEXT,
    "payerName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentBatchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentBatch_receiptNo_key" ON "PaymentBatch"("receiptNo");
CREATE INDEX IF NOT EXISTS "PaymentBatch_userId_idx" ON "PaymentBatch"("userId");
CREATE INDEX IF NOT EXISTS "PaymentBatch_payerName_idx" ON "PaymentBatch"("payerName");
CREATE INDEX IF NOT EXISTS "PaymentBatch_paymentDate_idx" ON "PaymentBatch"("paymentDate");
CREATE INDEX IF NOT EXISTS "Payment_paymentBatchId_idx" ON "Payment"("paymentBatchId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentBatch_userId_fkey'
    ) THEN
        ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Payment_paymentBatchId_fkey'
    ) THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentBatchId_fkey" FOREIGN KEY ("paymentBatchId") REFERENCES "PaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
