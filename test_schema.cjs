const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'invoice_builder'
    });
    
    await conn.query('SET SESSION sql_mode = CONCAT(@@sql_mode, ",ANSI_QUOTES")');

    const sql = `CREATE TABLE IF NOT EXISTS invoices (
      "id" INTEGER AUTO_INCREMENT PRIMARY KEY,
      "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
      "convertedFromQuotationId" INTEGER NULL,
      "businessId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "currencyId" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT NOW(),
      "updatedAt" DATETIME NOT NULL DEFAULT NOW(),
      "issuedAt" DATETIME NOT NULL,
      "dueDate" DATETIME,
      "invoiceNumber" TEXT NOT NULL,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "status" TEXT NOT NULL DEFAULT 'unpaid' CHECK ("status" IN ('unpaid','open','closed','partially','paid')),
      "customerNotes" TEXT,
      "thanksNotes" TEXT,
      "termsConditionNotes" TEXT,
      "discountName" TEXT,
      "businessNameSnapshot" TEXT NOT NULL,
      "businessShortNameSnapshot" TEXT NOT NULL CHECK (length("businessShortNameSnapshot") <= 2),
      "businessAddressSnapshot" TEXT,
      "businessRoleSnapshot" TEXT,
      "businessEmailSnapshot" TEXT,
      "businessPhoneSnapshot" TEXT,
      "businessAdditionalSnapshot" TEXT,
      "businessPaymentInformationSnapshot" TEXT,
      "businessLogoSnapshot" LONGBLOB,
      "businessFileSizeSnapshot" INTEGER,
      "businessFileTypeSnapshot" TEXT,
      "businessFileNameSnapshot" TEXT,
      "clientNameSnapshot" TEXT NOT NULL,
      "clientAddressSnapshot" TEXT,
      "clientEmailSnapshot" TEXT,
      "clientPhoneSnapshot" TEXT,
      "clientCodeSnapshot" TEXT,
      "clientAdditionalSnapshot" TEXT,
      "currencyCodeSnapshot" TEXT NOT NULL,
      "currencySymbolSnapshot" TEXT NOT NULL,
      "currencySubunitSnapshot" INTEGER NOT NULL,
      "discountType" TEXT CHECK("discountType" IN ('fixed','percentage') OR "discountType" IS NULL),
      "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
      "discountPercent" REAL NOT NULL DEFAULT 0,
      "shippingFeeCents" INTEGER NOT NULL DEFAULT 0,
      "invoicePrefixSnapshot" TEXT,
      "invoiceSuffixSnapshot" TEXT,
      "customizationColor" TEXT NOT NULL DEFAULT '#006400',
      "customizationLogoSize" TEXT NOT NULL DEFAULT 'medium',
      "customizationFontSizeSize" TEXT NOT NULL DEFAULT 'medium',
      "customizationLayout" TEXT NOT NULL DEFAULT 'classic',
      "customizationTableHeaderStyle" TEXT NOT NULL DEFAULT 'light',
      "customizationTableRowStyle" TEXT NOT NULL DEFAULT 'classic',
      "customizationPageFormat" TEXT NOT NULL DEFAULT 'A4',
      "customizationLabelUpperCase" INTEGER NOT NULL DEFAULT 0 CHECK ("customizationLabelUpperCase" IN (0,1)),
      "customizationWatermarkFileName" TEXT,
      "customizationWatermarkFileType" TEXT,
      "customizationWatermarkFileSize" INTEGER,
      "customizationWatermarkFileData" LONGBLOB,
      "customizationPaidWatermarkFileName" TEXT,
      "customizationPaidWatermarkFileType" TEXT,
      "customizationPaidWatermarkFileSize" INTEGER,
      "customizationPaidWatermarkFileData" LONGBLOB,
      "taxName" TEXT,
      "taxRate" REAL NOT NULL DEFAULT 0,
      "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive','deducted') OR "taxType" IS NULL),
      FOREIGN KEY ("businessId") REFERENCES businesses(id),
      FOREIGN KEY ("clientId") REFERENCES clients(id),
      FOREIGN KEY ("currencyId") REFERENCES currencies(id),
      FOREIGN KEY ("convertedFromQuotationId") REFERENCES invoices(id),
      UNIQUE ("businessId", "invoiceNumber"),
      CHECK (
        ("discountType" = 'fixed' AND "discountAmountCents" >= 0 AND "discountPercent" = 0) OR
        ("discountType" = 'percentage' AND "discountPercent" <= 100 AND "discountPercent" >= 0 AND "discountAmountCents" = 0) OR
        ("discountType" IS NULL AND "discountAmountCents" = 0 AND "discountPercent" = 0)
      ),
      CHECK ("dueDate" IS NULL OR "dueDate" >= "issuedAt"),
      CHECK ("convertedFromQuotationId" IS NULL OR "convertedFromQuotationId" != "id")
    );`;

    console.log("Executing query...");
    await conn.query(sql);
    console.log("Success!");
    
    await conn.end();
  } catch (err) {
    console.error("Failed:", err);
  }
})();
