import {
  PrismaClient,
  PurchaseOrderStatus,
  SupplierInvoiceStatus,
  StockTransferStatus,
  StockMovementReason,
  AuditAction,
  SaleType,
  PaymentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

function d(date: string, h: number, m = 0): Date {
  const dt = new Date(`${date}T00:00:00`);
  dt.setHours(h, m, 0, 0);
  return dt;
}

const VAT_EXTRACT = 20 / 120;
function extractTax(total: number) {
  return Math.round(total * VAT_EXTRACT * 100) / 100;
}

async function main() {
  console.log("Seeding events…\n");

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "meridian" } });
  const b1  = await prisma.branch.findFirstOrThrow({ where: { organizationId: org.id, name: "London Branch" } });
  const b2  = await prisma.branch.findFirstOrThrow({ where: { organizationId: org.id, name: "Manchester Branch" } });
  const allItems = await prisma.item.findMany({ where: { organizationId: org.id } });
  const iMap = Object.fromEntries(allItems.map(it => [it.sku, it]));

  const ORG  = org.id;
  const B1   = b1.id;
  const B2   = b2.id;
  const ADMIN = "seed-u-admin";
  const MGR1  = "seed-u-mgr1";
  const MGR2  = "seed-u-mgr2";

  // ── 1. Organization profile ────────────────────────────────────────────────
  await prisma.organization.update({
    where: { id: ORG },
    data: {
      phone:   "+44 20 7946 0300",
      email:   "info@meridian-electronics.co.uk",
      address: "14 Finsbury Square, London EC2A 1BR",
      website: "www.meridian-electronics.co.uk",
      taxId:   "GB 312 456 789",
    },
  });
  console.log("✓ 1. Organization profile set");

  // ── 2. Item metadata (costPrice, leadTimeDays, reorderPoint) ──────────────
  type IM = { sku: string; cp: number; ltd: number; rp: number };
  const meta: IM[] = [
    // Components & ICs — Eurotech, Germany, 10-14 day lead
    { sku:"CMP-001", cp:100,  ltd:10, rp:100 }, { sku:"CMP-002", cp:135,  ltd:10, rp:75  },
    { sku:"CMP-003", cp:172,  ltd:12, rp:40  }, { sku:"CMP-004", cp:82,   ltd:10, rp:60  },
    { sku:"CMP-005", cp:105,  ltd:10, rp:50  }, { sku:"CMP-006", cp:93,   ltd:10, rp:80  },
    { sku:"CMP-007", cp:105,  ltd:10, rp:65  }, { sku:"CMP-008", cp:121,  ltd:10, rp:60  },
    { sku:"CMP-009", cp:143,  ltd:12, rp:30  }, { sku:"CMP-010", cp:341,  ltd:14, rp:20  },
    { sku:"CMP-011", cp:99,   ltd:10, rp:80  }, { sku:"CMP-012", cp:132,  ltd:10, rp:40  },
    // Cables & Connectors — Thames Electronics, UK, 3-5 day lead
    { sku:"CAB-001", cp:105,  ltd:3,  rp:40  }, { sku:"CAB-002", cp:93,   ltd:3,  rp:60  },
    { sku:"CAB-003", cp:149,  ltd:3,  rp:50  }, { sku:"CAB-004", cp:187,  ltd:4,  rp:30  },
    { sku:"CAB-005", cp:121,  ltd:3,  rp:40  }, { sku:"CAB-006", cp:270,  ltd:3,  rp:25  },
    { sku:"CAB-007", cp:66,   ltd:3,  rp:35  }, { sku:"CAB-008", cp:149,  ltd:4,  rp:30  },
    { sku:"CAB-009", cp:105,  ltd:3,  rp:55  }, { sku:"CAB-010", cp:231,  ltd:4,  rp:20  },
    // Power Supplies — Lumitex, Netherlands, 7-10 day lead
    { sku:"PWR-001", cp:187,  ltd:7,  rp:40  }, { sku:"PWR-002", cp:259,  ltd:7,  rp:35  },
    { sku:"PWR-003", cp:484,  ltd:8,  rp:18  }, { sku:"PWR-004", cp:297,  ltd:7,  rp:20  },
    { sku:"PWR-005", cp:121,  ltd:5,  rp:100 }, { sku:"PWR-006", cp:105,  ltd:5,  rp:80  },
    { sku:"PWR-007", cp:30,   ltd:5,  rp:100 }, { sku:"PWR-008", cp:259,  ltd:7,  rp:25  },
    // LED & Lighting — Nordic Components, Sweden, 10-14 day lead
    { sku:"LED-001", cp:484,  ltd:14, rp:18  }, { sku:"LED-002", cp:396,  ltd:14, rp:20  },
    { sku:"LED-003", cp:396,  ltd:14, rp:20  }, { sku:"LED-004", cp:231,  ltd:12, rp:25  },
    { sku:"LED-005", cp:231,  ltd:12, rp:22  }, { sku:"LED-006", cp:105,  ltd:10, rp:80  },
    { sku:"LED-007", cp:726,  ltd:14, rp:12  }, { sku:"LED-008", cp:341,  ltd:12, rp:18  },
    { sku:"LED-009", cp:484,  ltd:14, rp:15  },
    // Audio & Visual — Nordic, 10-14 day lead
    { sku:"AVS-001", cp:66,   ltd:12, rp:60  }, { sku:"AVS-002", cp:83,   ltd:12, rp:55  },
    { sku:"AVS-003", cp:231,  ltd:12, rp:30  }, { sku:"AVS-004", cp:396,  ltd:14, rp:18  },
    { sku:"AVS-005", cp:105,  ltd:12, rp:40  }, { sku:"AVS-006", cp:149,  ltd:12, rp:30  },
    { sku:"AVS-007", cp:121,  ltd:12, rp:40  }, { sku:"AVS-008", cp:176,  ltd:12, rp:30  },
    // Networking — Eurotech, 10-14 day lead (NET-005 RPi: 21 days)
    { sku:"NET-001", cp:138,  ltd:12, rp:40  }, { sku:"NET-002", cp:270,  ltd:12, rp:30  },
    { sku:"NET-003", cp:187,  ltd:12, rp:25  }, { sku:"NET-004", cp:341,  ltd:14, rp:18  },
    { sku:"NET-005", cp:2860, ltd:21, rp:8   }, { sku:"NET-006", cp:1128, ltd:10, rp:8   },
    { sku:"NET-007", cp:149,  ltd:5,  rp:30  }, { sku:"NET-008", cp:341,  ltd:10, rp:20  },
    // Switches & Relays — Thames, 3-5 day lead
    { sku:"SWR-001", cp:66,   ltd:4,  rp:75  }, { sku:"SWR-002", cp:105,  ltd:4,  rp:50  },
    { sku:"SWR-003", cp:121,  ltd:4,  rp:35  }, { sku:"SWR-004", cp:138,  ltd:4,  rp:40  },
    { sku:"SWR-005", cp:341,  ltd:4,  rp:20  }, { sku:"SWR-006", cp:149,  ltd:4,  rp:35  },
    { sku:"SWR-007", cp:83,   ltd:4,  rp:55  }, { sku:"SWR-008", cp:726,  ltd:7,  rp:15  },
    // Tools & Accessories — Lumitex, 7-10 day lead
    { sku:"TOL-001", cp:726,  ltd:10, rp:10  }, { sku:"TOL-002", cp:270,  ltd:7,  rp:20  },
    { sku:"TOL-003", cp:176,  ltd:7,  rp:25  }, { sku:"TOL-004", cp:138,  ltd:7,  rp:40  },
    { sku:"TOL-005", cp:231,  ltd:8,  rp:30  }, { sku:"TOL-006", cp:726,  ltd:10, rp:12  },
    { sku:"TOL-007", cp:341,  ltd:8,  rp:15  }, { sku:"TOL-008", cp:270,  ltd:8,  rp:15  },
    { sku:"TOL-009", cp:105,  ltd:7,  rp:40  }, { sku:"TOL-010", cp:231,  ltd:7,  rp:20  },
    { sku:"TOL-011", cp:105,  ltd:5,  rp:55  }, { sku:"TOL-012", cp:44,   ltd:5,  rp:75  },
  ];

  for (const m of meta) {
    if (!iMap[m.sku]) continue;
    await prisma.item.update({
      where: { id: iMap[m.sku].id },
      data: { costPrice: m.cp, leadTimeDays: m.ltd, reorderPoint: m.rp },
    });
  }
  console.log(`✓ 2. Item metadata updated (${meta.length} items — costPrice, leadTimeDays, reorderPoint)`);

  // ── 3. POs with every possible status ─────────────────────────────────────
  async function ensurePO(id: string, data: Record<string, unknown>) {
    if (await prisma.purchaseOrder.findUnique({ where: { id } })) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await prisma.purchaseOrder.create({ data: { id, ...data } as any });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") return null;
      throw e;
    }
  }

  // DRAFT 1 — component buffer stock, Eurotech, London (Jun 17)
  await ensurePO("evt-po-01", {
    poNumber: "PO-20260617-0001",
    supplierId: "seed-sup-1",
    status: PurchaseOrderStatus.DRAFT,
    organizationId: ORG,
    branchId: B1,
    createdById: ADMIN,
    notes: "Q3 component buffer restock. Draft — not yet sent to Eurotech.",
    createdAt: d("2026-06-17", 9),
    items: { create: [
      { itemId: iMap["CMP-001"].id, quantity: 500, costPrice: 100, receivedQty: 0 },
      { itemId: iMap["CMP-004"].id, quantity: 200, costPrice: 82,  receivedQty: 0 },
      { itemId: iMap["CMP-007"].id, quantity: 300, costPrice: 105, receivedQty: 0 },
      { itemId: iMap["CMP-008"].id, quantity: 200, costPrice: 121, receivedQty: 0 },
      { itemId: iMap["CMP-012"].id, quantity: 100, costPrice: 132, receivedQty: 0 },
    ]},
  });

  // DRAFT 2 — LED restock, Nordic, Manchester (Jun 17)
  await ensurePO("evt-po-02", {
    poNumber: "PO-20260617-0002",
    supplierId: "seed-sup-3",
    status: PurchaseOrderStatus.DRAFT,
    organizationId: ORG,
    branchId: B2,
    createdById: MGR2,
    notes: "Manchester LED stock replenishment draft for Q3 planning.",
    createdAt: d("2026-06-17", 10, 30),
    items: { create: [
      { itemId: iMap["LED-004"].id, quantity: 80, costPrice: 231, receivedQty: 0 },
      { itemId: iMap["LED-005"].id, quantity: 60, costPrice: 231, receivedQty: 0 },
      { itemId: iMap["LED-009"].id, quantity: 30, costPrice: 484, receivedQty: 0 },
    ]},
  });

  // SENT 1 — networking modules to Eurotech, sent Jun 12
  await ensurePO("evt-po-03", {
    poNumber: "PO-20260612-0001",
    supplierId: "seed-sup-1",
    status: PurchaseOrderStatus.SENT,
    expectedDelivery: d("2026-06-24", 12),
    organizationId: ORG,
    branchId: B1,
    createdById: MGR1,
    notes: "Networking module restock sent to Eurotech. Awaiting order confirmation from account team.",
    createdAt: d("2026-06-12", 8, 45),
    items: { create: [
      { itemId: iMap["NET-001"].id, quantity: 100, costPrice: 138, receivedQty: 0 },
      { itemId: iMap["NET-002"].id, quantity: 80,  costPrice: 270, receivedQty: 0 },
      { itemId: iMap["NET-003"].id, quantity: 60,  costPrice: 187, receivedQty: 0 },
      { itemId: iMap["NET-004"].id, quantity: 40,  costPrice: 341, receivedQty: 0 },
    ]},
  });

  // SENT 2 — power supplies to Lumitex, sent Jun 14
  await ensurePO("evt-po-04", {
    poNumber: "PO-20260614-0001",
    supplierId: "seed-sup-4",
    status: PurchaseOrderStatus.SENT,
    expectedDelivery: d("2026-06-25", 12),
    organizationId: ORG,
    branchId: B1,
    createdById: ADMIN,
    notes: "Lumitex quote LPS-Q-20260614-02 accepted. Order sent, pending supplier confirmation.",
    createdAt: d("2026-06-14", 11),
    items: { create: [
      { itemId: iMap["PWR-001"].id, quantity: 150, costPrice: 187, receivedQty: 0 },
      { itemId: iMap["PWR-002"].id, quantity: 100, costPrice: 259, receivedQty: 0 },
      { itemId: iMap["PWR-003"].id, quantity: 40,  costPrice: 484, receivedQty: 0 },
      { itemId: iMap["TOL-001"].id, quantity: 20,  costPrice: 726, receivedQty: 0 },
    ]},
  });

  // CONFIRMED — cable restock, Thames, delivery Jun 18
  await ensurePO("evt-po-05", {
    poNumber: "PO-20260611-0001",
    supplierId: "seed-sup-2",
    status: PurchaseOrderStatus.CONFIRMED,
    expectedDelivery: d("2026-06-18", 9),
    organizationId: ORG,
    branchId: null,
    createdById: ADMIN,
    notes: "Confirmed by Thames Electronics account manager. DPD delivery booked for Thu 18 Jun — covers both branches.",
    createdAt: d("2026-06-09", 14),
    items: { create: [
      { itemId: iMap["CAB-003"].id, quantity: 200, costPrice: 149, receivedQty: 0 },
      { itemId: iMap["CAB-004"].id, quantity: 100, costPrice: 187, receivedQty: 0 },
      { itemId: iMap["CAB-009"].id, quantity: 250, costPrice: 105, receivedQty: 0 },
      { itemId: iMap["NET-007"].id, quantity: 100, costPrice: 149, receivedQty: 0 },
    ]},
  });

  // PARTIAL — LED order, Nordic, partially delivered Jun 3 (LED-007 backordered)
  // Use May 22 (seed-po-20 already occupies May 20, seed-po-19 uses May 15)
  const partialPo = await ensurePO("evt-po-06", {
    poNumber: "PO-20260522-0001",
    supplierId: "seed-sup-3",
    status: PurchaseOrderStatus.PARTIAL,
    expectedDelivery: d("2026-06-15", 12),
    deliveredAt: d("2026-06-03", 14),
    organizationId: ORG,
    branchId: B1,
    createdById: MGR1,
    notes: "LED-007 Flood Lights backordered — Nordic allocation shortage. LED-001 × 40 + LED-002 × 40 received 3 Jun. Balance expected w/c 15 Jun.",
    invoiceRef: "NCA-2026-0892",
    invoiceAmount: 40 * 484 + 40 * 396,  // 35,200 pence (received goods only)
    invoiceDate: d("2026-06-04", 9),
    invoiceStatus: SupplierInvoiceStatus.RECEIVED,
    createdAt: d("2026-05-20", 10, 30),
    items: { create: [
      { itemId: iMap["LED-001"].id, quantity: 60, costPrice: 484, receivedQty: 40 },
      { itemId: iMap["LED-002"].id, quantity: 40, costPrice: 396, receivedQty: 40 },
      { itemId: iMap["LED-007"].id, quantity: 25, costPrice: 726, receivedQty: 0  },
    ]},
  });

  if (partialPo) {
    await prisma.stockLog.createMany({
      data: [
        { itemId: iMap["LED-001"].id, branchId: B1, organizationId: ORG, quantity: 40, reason: StockMovementReason.PURCHASE_RECEIVED, referenceId: partialPo.id, recordedById: MGR1, createdAt: d("2026-06-03", 14) },
        { itemId: iMap["LED-002"].id, branchId: B1, organizationId: ORG, quantity: 40, reason: StockMovementReason.PURCHASE_RECEIVED, referenceId: partialPo.id, recordedById: MGR1, createdAt: d("2026-06-03", 14, 5) },
      ],
    });
  }

  // CANCELLED 1 — STM32 order Nov 2025, Eurotech chip shortage (Nov 8 Saturday, avoids hist-po weekday conflicts)
  await ensurePO("evt-po-07", {
    poNumber: "PO-20251108-0001",
    supplierId: "seed-sup-1",
    status: PurchaseOrderStatus.CANCELLED,
    organizationId: ORG,
    branchId: B1,
    createdById: ADMIN,
    notes: "CANCELLED 2025-11-08 — Eurotech unable to allocate STM32F103C8T6 (global chip shortage). Reorder deferred to Q1 2026.",
    createdAt: d("2025-11-05", 10),
    items: { create: [
      { itemId: iMap["CMP-010"].id, quantity: 200, costPrice: 341, receivedQty: 0 },
      { itemId: iMap["CMP-009"].id, quantity: 150, costPrice: 143, receivedQty: 0 },
    ]},
  });

  // CANCELLED 2 — duplicate cable order Mar 2026, Manchester
  await ensurePO("evt-po-08", {
    poNumber: "PO-20260309-0001",
    supplierId: "seed-sup-2",
    status: PurchaseOrderStatus.CANCELLED,
    organizationId: ORG,
    branchId: B2,
    createdById: MGR2,
    notes: "CANCELLED 2026-03-10 — duplicate of existing March PO. Created in error by Manchester branch staff. Thames notified immediately.",
    createdAt: d("2026-03-09", 16),
    items: { create: [
      { itemId: iMap["CAB-010"].id, quantity: 100, costPrice: 231, receivedQty: 0 },
      { itemId: iMap["SWR-008"].id, quantity: 50,  costPrice: 726, receivedQty: 0 },
    ]},
  });

  console.log("✓ 3. POs with all statuses: DRAFT×2, SENT×2, CONFIRMED, PARTIAL, CANCELLED×2");

  // ── 4. Supplier invoices on historical RECEIVED POs ───────────────────────
  type InvRow = {
    id: string;
    invoiceRef: string;
    invoiceAmount: number;
    invoiceDate: Date;
    invoiceStatus: SupplierInvoiceStatus;
    invoicePaidAt: Date | null;
    invoicePaidById: string | null;
  };

  const invRows: InvRow[] = [
    // Oct 2025 POs — all PAID (Net 30 cleared)
    { id:"hist-po-01", invoiceRef:"ETC-2025-2481", invoiceAmount:132400, invoiceDate:d("2025-10-09",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-11-10",10), invoicePaidById:ADMIN },
    { id:"hist-po-02", invoiceRef:"NCA-2025-0712", invoiceAmount:98600,  invoiceDate:d("2025-10-16",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-11-17",10), invoicePaidById:ADMIN },
    { id:"hist-po-03", invoiceRef:"LPS-2025-3301", invoiceAmount:87200,  invoiceDate:d("2025-10-22",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-11-22",10), invoicePaidById:ADMIN },
    { id:"hist-po-04", invoiceRef:"THE-2025-1143", invoiceAmount:74800,  invoiceDate:d("2025-10-28",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-11-28",10), invoicePaidById:ADMIN },
    { id:"hist-po-05", invoiceRef:"ETC-2025-2598", invoiceAmount:116000, invoiceDate:d("2025-11-04",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-12-05",10), invoicePaidById:ADMIN },
    // Nov 2025 POs — all PAID
    { id:"hist-po-06", invoiceRef:"NCA-2025-0841", invoiceAmount:143200, invoiceDate:d("2025-11-11",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-12-12",10), invoicePaidById:ADMIN },
    { id:"hist-po-07", invoiceRef:"LPS-2025-3448", invoiceAmount:108600, invoiceDate:d("2025-11-17",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-12-18",10), invoicePaidById:ADMIN },
    { id:"hist-po-08", invoiceRef:"THE-2025-1267", invoiceAmount:92400,  invoiceDate:d("2025-11-21",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-12-22",10), invoicePaidById:ADMIN },
    { id:"hist-po-09", invoiceRef:"ETC-2025-2731", invoiceAmount:158800, invoiceDate:d("2025-11-26",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2025-12-24",10), invoicePaidById:ADMIN },
    { id:"hist-po-10", invoiceRef:"NCA-2025-0932", invoiceAmount:187600, invoiceDate:d("2025-12-03",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-01-06",10), invoicePaidById:ADMIN },
    // Dec 2025 POs — all PAID (peak season, paid early Jan)
    { id:"hist-po-11", invoiceRef:"LPS-2025-3602", invoiceAmount:164200, invoiceDate:d("2025-12-09",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-01-12",10), invoicePaidById:ADMIN },
    { id:"hist-po-12", invoiceRef:"THE-2025-1412", invoiceAmount:138400, invoiceDate:d("2025-12-12",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-01-14",10), invoicePaidById:ADMIN },
    { id:"hist-po-13", invoiceRef:"ETC-2025-2894", invoiceAmount:196400, invoiceDate:d("2025-12-17",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-01-20",10), invoicePaidById:ADMIN },
    { id:"hist-po-14", invoiceRef:"NCA-2025-1044", invoiceAmount:214800, invoiceDate:d("2025-12-19",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-01-22",10), invoicePaidById:ADMIN },
    { id:"hist-po-15", invoiceRef:"LPS-2025-3788", invoiceAmount:182200, invoiceDate:d("2025-12-23",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-01-28",10), invoicePaidById:ADMIN },
    // Jan 2026 POs — all PAID
    { id:"hist-po-16", invoiceRef:"THE-2026-0108", invoiceAmount:54200,  invoiceDate:d("2026-01-09",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-02-10",10), invoicePaidById:ADMIN },
    { id:"hist-po-17", invoiceRef:"ETC-2026-0044", invoiceAmount:68400,  invoiceDate:d("2026-01-14",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-02-14",10), invoicePaidById:ADMIN },
    { id:"hist-po-18", invoiceRef:"NCA-2026-0031", invoiceAmount:76800,  invoiceDate:d("2026-01-19",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-02-19",10), invoicePaidById:ADMIN },
    { id:"hist-po-19", invoiceRef:"LPS-2026-0061", invoiceAmount:59600,  invoiceDate:d("2026-01-23",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-02-24",10), invoicePaidById:ADMIN },
    { id:"hist-po-20", invoiceRef:"THE-2026-0184", invoiceAmount:63200,  invoiceDate:d("2026-01-28",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-02-28",10), invoicePaidById:ADMIN },
    // Feb 2026 POs — PAID, except one DISPUTED
    { id:"hist-po-21", invoiceRef:"ETC-2026-0138", invoiceAmount:88400,  invoiceDate:d("2026-02-05",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-03-07",10), invoicePaidById:ADMIN },
    { id:"hist-po-22", invoiceRef:"NCA-2026-0102", invoiceAmount:94200,  invoiceDate:d("2026-02-11",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-03-13",10), invoicePaidById:ADMIN },
    { id:"hist-po-23", invoiceRef:"LPS-2026-0178", invoiceAmount:72600,  invoiceDate:d("2026-02-17",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-03-19",10), invoicePaidById:ADMIN },
    { id:"hist-po-24", invoiceRef:"THE-2026-0298", invoiceAmount:81400,  invoiceDate:d("2026-02-21",9), invoiceStatus:SupplierInvoiceStatus.PAID, invoicePaidAt:d("2026-03-24",10), invoicePaidById:ADMIN },
    // hist-po-25: DISPUTED — Eurotech invoiced £242 more than PO total; payment withheld
    { id:"hist-po-25", invoiceRef:"ETC-2026-0212", invoiceAmount:148600, invoiceDate:d("2026-02-26",9), invoiceStatus:SupplierInvoiceStatus.DISPUTED, invoicePaidAt:null, invoicePaidById:null },
    // Mar 2026 POs — invoice RECEIVED, Net 30 not yet expired (payment due Apr)
    { id:"hist-po-26", invoiceRef:"NCA-2026-0187", invoiceAmount:102400, invoiceDate:d("2026-03-06",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED, invoicePaidAt:null, invoicePaidById:null },
    { id:"hist-po-27", invoiceRef:"LPS-2026-0249", invoiceAmount:88200,  invoiceDate:d("2026-03-11",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED, invoicePaidAt:null, invoicePaidById:null },
    { id:"hist-po-28", invoiceRef:"THE-2026-0401", invoiceAmount:76600,  invoiceDate:d("2026-03-16",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED, invoicePaidAt:null, invoicePaidById:null },
    { id:"hist-po-29", invoiceRef:"ETC-2026-0308", invoiceAmount:124200, invoiceDate:d("2026-03-21",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED, invoicePaidAt:null, invoicePaidById:null },
    { id:"hist-po-30", invoiceRef:"NCA-2026-0231", invoiceAmount:95800,  invoiceDate:d("2026-03-27",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED, invoicePaidAt:null, invoicePaidById:null },
    // Jun 2026 current POs
    { id:"curr-po-01", invoiceRef:"THE-2026-0814", invoiceAmount:48400,  invoiceDate:d("2026-06-11",9), invoiceStatus:SupplierInvoiceStatus.PAID,     invoicePaidAt:d("2026-06-16",10), invoicePaidById:ADMIN },
    { id:"curr-po-02", invoiceRef:"ETC-2026-0521", invoiceAmount:143200, invoiceDate:d("2026-06-16",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED,  invoicePaidAt:null, invoicePaidById:null },
    { id:"curr-po-03", invoiceRef:"NCA-2026-0402", invoiceAmount:112600, invoiceDate:d("2026-06-17",9), invoiceStatus:SupplierInvoiceStatus.RECEIVED,  invoicePaidAt:null, invoicePaidById:null },
  ];

  let invOk = 0;
  for (const row of invRows) {
    try {
      await prisma.purchaseOrder.update({
        where: { id: row.id },
        data: {
          invoiceRef:     row.invoiceRef,
          invoiceAmount:  row.invoiceAmount,
          invoiceDate:    row.invoiceDate,
          invoiceStatus:  row.invoiceStatus,
          invoicePaidAt:  row.invoicePaidAt,
          invoicePaidById:row.invoicePaidById,
        },
      });
      invOk++;
    } catch {
      // PO doesn't exist (prerequisite seed not run), skip silently
    }
  }
  console.log(`✓ 4. Supplier invoices attached to ${invOk}/${invRows.length} POs (PAID/RECEIVED/DISPUTED)`);

  // ── 5. Voided sales + SALE / SALE_VOID stock logs ─────────────────────────
  async function ensureVoidSale(receiptNumber: string, data: Record<string, unknown>) {
    const existing = await prisma.sale.findUnique({
      where: { receiptNumber_organizationId: { receiptNumber, organizationId: ORG } },
    });
    if (existing) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma.sale.create({ data: data as any });
  }

  // Void 1 — Nov 15, 2025: Sophie Anderson wrong relay type, same-day return
  const v1Total = 20 * 250;
  const void1 = await ensureVoidSale("VOID-20251115-0001", {
    receiptNumber:  "VOID-20251115-0001",
    saleType:       SaleType.RETAIL,
    paymentStatus:  PaymentStatus.PAID,
    discountAmount: 0,
    taxAmount:      extractTax(v1Total),
    totalAmount:    v1Total,
    isVoid:         true,
    voidReason:     "Customer ordered wrong relay type — requested SWR-005 (4-channel) instead of SWR-004. Full refund issued.",
    voidedAt:       d("2025-11-15", 16, 30),
    customerId:     "seed-c-008",
    employeeId:     "seed-u-cs1",
    branchId:       B1,
    organizationId: ORG,
    createdAt:      d("2025-11-15", 10, 30),
    items: { create: [
      { itemId: iMap["SWR-004"].id, quantity: 20, unitPrice: 250, subtotal: 20 * 250 },
    ]},
  });

  if (void1) {
    await prisma.stockLog.createMany({ data: [
      { itemId: iMap["SWR-004"].id, branchId: B1, organizationId: ORG, quantity: -20, reason: StockMovementReason.SALE,      referenceId: void1.id, recordedById: "seed-u-cs1",  createdAt: d("2025-11-15", 10, 30) },
      { itemId: iMap["SWR-004"].id, branchId: B1, organizationId: ORG, quantity:  20, reason: StockMovementReason.SALE_VOID, referenceId: void1.id, recordedById: MGR1,            createdAt: d("2025-11-15", 16, 30) },
    ]});
  }

  // Void 2 — Feb 20, 2026: Manchester duplicate entry, voided by manager
  const v2Lines = [
    { itemId: iMap["CMP-010"].id, quantity: 5, unitPrice: 850, subtotal: 5 * 850 },
    { itemId: iMap["NET-002"].id, quantity: 8, unitPrice: 490, subtotal: 8 * 490 },
  ];
  const v2Total = v2Lines.reduce((s, l) => s + l.subtotal, 0);
  const void2 = await ensureVoidSale("VOID-20260220-0001", {
    receiptNumber:  "VOID-20260220-0001",
    saleType:       SaleType.RETAIL,
    paymentStatus:  PaymentStatus.PAID,
    discountAmount: 0,
    taxAmount:      extractTax(v2Total),
    totalAmount:    v2Total,
    isVoid:         true,
    voidReason:     "Duplicate entry — same transaction already recorded as RCP-20260220-0003. Voided same afternoon to correct ledger.",
    voidedAt:       d("2026-02-20", 15),
    customerId:     null,
    employeeId:     "seed-u-cs6",
    branchId:       B2,
    organizationId: ORG,
    createdAt:      d("2026-02-20", 9, 30),
    items: { create: v2Lines },
  });

  if (void2) {
    await prisma.stockLog.createMany({ data: [
      { itemId: iMap["CMP-010"].id, branchId: B2, organizationId: ORG, quantity: -5, reason: StockMovementReason.SALE,      referenceId: void2.id, recordedById: "seed-u-cs6", createdAt: d("2026-02-20", 9, 30) },
      { itemId: iMap["NET-002"].id, branchId: B2, organizationId: ORG, quantity: -8, reason: StockMovementReason.SALE,      referenceId: void2.id, recordedById: "seed-u-cs6", createdAt: d("2026-02-20", 9, 32) },
      { itemId: iMap["CMP-010"].id, branchId: B2, organizationId: ORG, quantity:  5, reason: StockMovementReason.SALE_VOID, referenceId: void2.id, recordedById: MGR2,           createdAt: d("2026-02-20", 15, 0) },
      { itemId: iMap["NET-002"].id, branchId: B2, organizationId: ORG, quantity:  8, reason: StockMovementReason.SALE_VOID, referenceId: void2.id, recordedById: MGR2,           createdAt: d("2026-02-20", 15, 2) },
    ]});
  }

  // Void 3 — May 22, 2026: Lucas Young LED order cancelled before pickup (WHOLESALE CREDIT)
  const v3Lines = [
    { itemId: iMap["LED-001"].id, quantity: 30, unitPrice: 880, subtotal: 30 * 880 },
    { itemId: iMap["LED-008"].id, quantity: 10, unitPrice: 620, subtotal: 10 * 620 },
  ];
  const v3Total = v3Lines.reduce((s, l) => s + l.subtotal, 0);
  const void3 = await ensureVoidSale("VOID-20260522-0001", {
    receiptNumber:  "VOID-20260522-0001",
    saleType:       SaleType.WHOLESALE,
    paymentStatus:  PaymentStatus.CREDIT,
    discountAmount: 0,
    taxAmount:      extractTax(v3Total),
    totalAmount:    v3Total,
    isVoid:         true,
    voidReason:     "Customer cancelled project — Peckham library LED refurbishment postponed indefinitely. Stock returned to warehouse.",
    voidedAt:       d("2026-05-23", 10),
    customerId:     "seed-c-019",
    employeeId:     "seed-u-cs2",
    branchId:       B1,
    organizationId: ORG,
    createdAt:      d("2026-05-22", 14),
    items: { create: v3Lines },
  });

  if (void3) {
    await prisma.stockLog.createMany({ data: [
      { itemId: iMap["LED-001"].id, branchId: B1, organizationId: ORG, quantity: -30, reason: StockMovementReason.SALE,      referenceId: void3.id, recordedById: "seed-u-cs2", createdAt: d("2026-05-22", 14, 0) },
      { itemId: iMap["LED-008"].id, branchId: B1, organizationId: ORG, quantity: -10, reason: StockMovementReason.SALE,      referenceId: void3.id, recordedById: "seed-u-cs2", createdAt: d("2026-05-22", 14, 2) },
      { itemId: iMap["LED-001"].id, branchId: B1, organizationId: ORG, quantity:  30, reason: StockMovementReason.SALE_VOID, referenceId: void3.id, recordedById: MGR1,           createdAt: d("2026-05-23", 10, 0) },
      { itemId: iMap["LED-008"].id, branchId: B1, organizationId: ORG, quantity:  10, reason: StockMovementReason.SALE_VOID, referenceId: void3.id, recordedById: MGR1,           createdAt: d("2026-05-23", 10, 2) },
    ]});
  }

  console.log("✓ 5. Voided sales ×3 (wrong item, duplicate entry, cancelled project) + SALE/SALE_VOID logs");

  // ── 6. Stock transfers ──────────────────────────────────────────────────────
  async function ensureTransfer(id: string, data: Record<string, unknown>) {
    if (await prisma.stockTransfer.findUnique({ where: { id } })) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma.stockTransfer.create({ data: { id, ...data } as any });
  }

  // RECEIVED — Oct 20, 2025: B1→B2 LED Bulbs (Q4 seasonal share)
  const xfr1 = await ensureTransfer("evt-xfr-01", {
    fromBranchId: B1, toBranchId: B2,
    status: StockTransferStatus.RECEIVED,
    notes: "Q4 seasonal redistribution — sharing LED bulb surplus from London with Manchester pre-Christmas.",
    organizationId: ORG, createdById: MGR1, createdAt: d("2025-10-20", 9),
    items: { create: [{ itemId: iMap["LED-006"].id, quantity: 60 }] },
  });

  if (xfr1) {
    await prisma.stockLog.createMany({ data: [
      { itemId: iMap["LED-006"].id, branchId: B1, organizationId: ORG, quantity: -60, reason: StockMovementReason.TRANSFER_OUT, referenceId: xfr1.id, recordedById: MGR1, createdAt: d("2025-10-20", 9) },
      { itemId: iMap["LED-006"].id, branchId: B2, organizationId: ORG, quantity:  60, reason: StockMovementReason.TRANSFER_IN,  referenceId: xfr1.id, recordedById: MGR2, createdAt: d("2025-10-21", 10) },
    ]});
  }

  // RECEIVED — Feb 22, 2026: B1→B2 ESP32 + NodeMCU (post-shrinkage top-up)
  const xfr2 = await ensureTransfer("evt-xfr-02", {
    fromBranchId: B1, toBranchId: B2,
    status: StockTransferStatus.RECEIVED,
    notes: "Post-stocktake replenishment — boosting Manchester networking stock after Feb 14 shrinkage.",
    organizationId: ORG, createdById: MGR1, createdAt: d("2026-02-22", 9),
    items: { create: [
      { itemId: iMap["NET-002"].id, quantity: 20 },
      { itemId: iMap["NET-001"].id, quantity: 30 },
    ]},
  });

  if (xfr2) {
    await prisma.stockLog.createMany({ data: [
      { itemId: iMap["NET-002"].id, branchId: B1, organizationId: ORG, quantity: -20, reason: StockMovementReason.TRANSFER_OUT, referenceId: xfr2.id, recordedById: MGR1, createdAt: d("2026-02-22", 9) },
      { itemId: iMap["NET-001"].id, branchId: B1, organizationId: ORG, quantity: -30, reason: StockMovementReason.TRANSFER_OUT, referenceId: xfr2.id, recordedById: MGR1, createdAt: d("2026-02-22", 9, 5) },
      { itemId: iMap["NET-002"].id, branchId: B2, organizationId: ORG, quantity:  20, reason: StockMovementReason.TRANSFER_IN,  referenceId: xfr2.id, recordedById: MGR2, createdAt: d("2026-02-23", 10) },
      { itemId: iMap["NET-001"].id, branchId: B2, organizationId: ORG, quantity:  30, reason: StockMovementReason.TRANSFER_IN,  referenceId: xfr2.id, recordedById: MGR2, createdAt: d("2026-02-23", 10, 5) },
    ]});
  }

  // IN_TRANSIT — Jun 15, 2026: B1→B2 CMP-005 surplus (dispatched, not yet received)
  const xfr3 = await ensureTransfer("evt-xfr-03", {
    fromBranchId: B1, toBranchId: B2,
    status: StockTransferStatus.IN_TRANSIT,
    notes: "Redistributing CMP-005 (LM7805) surplus from London to Manchester. Dispatched via DPD Jun 15, expected Jun 17.",
    organizationId: ORG, createdById: MGR1, createdAt: d("2026-06-15", 14),
    items: { create: [
      { itemId: iMap["CMP-005"].id, quantity: 60 },
      { itemId: iMap["CMP-003"].id, quantity: 25 },
    ]},
  });

  if (xfr3) {
    // TRANSFER_OUT only — stock has left London, not yet booked into Manchester
    await prisma.stockLog.createMany({ data: [
      { itemId: iMap["CMP-005"].id, branchId: B1, organizationId: ORG, quantity: -60, reason: StockMovementReason.TRANSFER_OUT, referenceId: xfr3.id, recordedById: MGR1, createdAt: d("2026-06-15", 14) },
      { itemId: iMap["CMP-003"].id, branchId: B1, organizationId: ORG, quantity: -25, reason: StockMovementReason.TRANSFER_OUT, referenceId: xfr3.id, recordedById: MGR1, createdAt: d("2026-06-15", 14, 5) },
    ]});
  }

  // PENDING — Jun 17, 2026: B2→B1 PWR-001 (Manchester surplus → London urgent, awaiting approval)
  await ensureTransfer("evt-xfr-04", {
    fromBranchId: B2, toBranchId: B1,
    status: StockTransferStatus.PENDING,
    notes: "London PWR-001 critically below reorder point. Requesting Manchester surplus. Pending manager approval.",
    organizationId: ORG, createdById: "seed-u-cs5", createdAt: d("2026-06-17", 8, 45),
    items: { create: [
      { itemId: iMap["PWR-001"].id, quantity: 80 },
      { itemId: iMap["TOL-001"].id, quantity: 10 },
    ]},
  });

  console.log("✓ 6. Stock transfers: RECEIVED×2, IN_TRANSIT×1, PENDING×1 + transfer stock logs");

  // ── 7. Credit payments + customer balance updates ─────────────────────────
  // Check specifically for our seeded payments (the main seed has smaller generic payments already)
  const existMyCreditPays = await prisma.creditPayment.count({
    where: { customerId: "seed-c-002", notes: { contains: "CHD-2025-Q4" } },
  });

  if (existMyCreditPays === 0) {
    await prisma.creditPayment.createMany({ data: [
      // Charlotte Davies (seed-c-002) — 3 quarterly big orders, 3 payments (~£6,800 total credit, £5,800 paid, £1k outstanding)
      { customerId:"seed-c-002", amount:250000, notes:"Part payment — Q4 2025 component & networking order. Ref: CHD-2025-Q4",   recordedById:ADMIN, createdAt:d("2025-11-20",10) },
      { customerId:"seed-c-002", amount:280000, notes:"Full settlement — Q1 2026 components order. Ref: CHD-2026-Q1",             recordedById:ADMIN, createdAt:d("2026-02-28",10) },
      { customerId:"seed-c-002", amount:150000, notes:"Part payment — Q2 2026 mixed order. Balance £1,000 due. Ref: CHD-2026-Q2", recordedById:MGR1,  createdAt:d("2026-05-15",10) },
      // Jessica Brown (seed-c-006) — regular weekly B1 wholesale (19 orders, ~£8,500 total)
      { customerId:"seed-c-006", amount:185000, notes:"Monthly settlement Oct-Nov 2025 wholesale account. Ref: JBR-2025-S1",     recordedById:ADMIN, createdAt:d("2025-12-01",10) },
      { customerId:"seed-c-006", amount:190000, notes:"Monthly settlement Dec 2025 - Jan 2026 wholesale. Ref: JBR-2026-S1",      recordedById:ADMIN, createdAt:d("2026-02-03",10) },
      { customerId:"seed-c-006", amount:175000, notes:"Monthly settlement Feb-Mar 2026 wholesale. Ref: JBR-2026-S2",             recordedById:MGR1,  createdAt:d("2026-04-15",10) },
      { customerId:"seed-c-006", amount:148000, notes:"Monthly settlement Apr-May 2026 wholesale. Ref: JBR-2026-S3",             recordedById:MGR1,  createdAt:d("2026-06-10",10) },
      // Ethan Robinson (seed-c-015) — regular weekly B2 wholesale (~£6,500 total)
      { customerId:"seed-c-015", amount:150000, notes:"Settlement Oct-Dec 2025 B2 wholesale orders. Ref: ERO-2025-S1",  recordedById:MGR2, createdAt:d("2025-12-15",10) },
      { customerId:"seed-c-015", amount:185000, notes:"Settlement Jan-Feb 2026 B2 wholesale orders. Ref: ERO-2026-S1",  recordedById:MGR2, createdAt:d("2026-03-15",10) },
      { customerId:"seed-c-015", amount:200000, notes:"Settlement Mar-May 2026 B2 wholesale orders. Ref: ERO-2026-S2",  recordedById:MGR2, createdAt:d("2026-06-05",10) },
      // Lucas Young (seed-c-019) — 2 large LED contractor orders (~£4,200 total, £2,500 paid)
      { customerId:"seed-c-019", amount:250000, notes:"Part payment — Dec 2025 LED lighting order (Clifton Library refurb). Ref: LYO-2025-001", recordedById:ADMIN, createdAt:d("2025-12-31",10) },
      // James White (seed-c-011) — 3 component orders, FULLY CLEARED
      { customerId:"seed-c-011", amount:185000, notes:"Settlement — Oct-Nov 2025 component orders (full). Ref: JWH-2025-S1", recordedById:ADMIN, createdAt:d("2025-12-05",10) },
      { customerId:"seed-c-011", amount:195000, notes:"Settlement — Jan-Mar 2026 component orders (full). Ref: JWH-2026-S1", recordedById:ADMIN, createdAt:d("2026-04-02",10) },
      // Sophie Anderson (seed-c-008) — 2 relay bulk orders (~£2,100 total)
      { customerId:"seed-c-008", amount:120000, notes:"Part payment — relay orders Oct-Nov 2025. Balance £900 outstanding. Ref: SAN-2025-S1", recordedById:MGR1, createdAt:d("2026-01-20",10) },
    ]});

    // Set creditBalance = remaining outstanding after payments
    const balances: Record<string, number> = {
      "seed-c-002": 100000,  // Charlotte Davies — £1,000 remaining on Q2 order
      "seed-c-006": 52000,   // Jessica Brown — ~£520 (Jun weeks not yet settled)
      "seed-c-008": 90000,   // Sophie Anderson — £900 outstanding
      "seed-c-011": 0,       // James White — fully cleared
      "seed-c-015": 90000,   // Ethan Robinson — £900 (Jun orders outstanding)
      "seed-c-019": 170000,  // Lucas Young — £1,700 (second LED order + minus the void)
    };
    for (const [customerId, balance] of Object.entries(balances)) {
      await prisma.customer.update({ where: { id: customerId }, data: { creditBalance: balance } });
    }
    console.log("✓ 7. Credit payments created (14 records across 6 customers) + creditBalance set");
  } else {
    console.log("✓ 7. Credit payments already seeded, skipping");
  }

  // ── 8. Audit log entries ──────────────────────────────────────────────────
  const existAudit = await prisma.auditLog.count({ where: { organizationId: ORG } });

  if (existAudit < 10) {
    // Fetch void sale IDs for entityId references
    const v1Rec = await prisma.sale.findUnique({ where: { receiptNumber_organizationId: { receiptNumber: "VOID-20251115-0001", organizationId: ORG } } });
    const v2Rec = await prisma.sale.findUnique({ where: { receiptNumber_organizationId: { receiptNumber: "VOID-20260220-0001", organizationId: ORG } } });
    const v3Rec = await prisma.sale.findUnique({ where: { receiptNumber_organizationId: { receiptNumber: "VOID-20260522-0001", organizationId: ORG } } });

    await prisma.auditLog.createMany({ data: [
      // Void events
      { organizationId:ORG, userId:MGR1,  action:AuditAction.VOID,   entity:"Sale",          entityId:v1Rec?.id,     description:"Voided sale VOID-20251115-0001 — wrong relay type, full refund to Sophie Anderson",   createdAt:d("2025-11-15",16,30) },
      { organizationId:ORG, userId:MGR2,  action:AuditAction.VOID,   entity:"Sale",          entityId:v2Rec?.id,     description:"Voided sale VOID-20260220-0001 — duplicate entry by Manchester cashier corrected",   createdAt:d("2026-02-20",15,0)  },
      { organizationId:ORG, userId:MGR1,  action:AuditAction.VOID,   entity:"Sale",          entityId:v3Rec?.id,     description:"Voided wholesale order VOID-20260522-0001 — Lucas Young Peckham library project cancelled", createdAt:d("2026-05-23",10,0) },
      // PO lifecycle events
      { organizationId:ORG, userId:ADMIN, action:AuditAction.UPDATE,  entity:"PurchaseOrder", entityId:"evt-po-07",   description:"PO PO-20251105-0001 cancelled — Eurotech chip shortage, CMP-010 STM32 unavailable",  createdAt:d("2025-11-08",11) },
      { organizationId:ORG, userId:MGR2,  action:AuditAction.UPDATE,  entity:"PurchaseOrder", entityId:"evt-po-08",   description:"PO PO-20260309-0001 cancelled — duplicate order, Thames Electronics notified",        createdAt:d("2026-03-10",9) },
      { organizationId:ORG, userId:ADMIN, action:AuditAction.UPDATE,  entity:"PurchaseOrder", entityId:"evt-po-05",   description:"PO PO-20260611-0001 confirmed by Thames Electronics — delivery scheduled 18 Jun",    createdAt:d("2026-06-11",14) },
      // Invoice dispute
      { organizationId:ORG, userId:ADMIN, action:AuditAction.UPDATE,  entity:"PurchaseOrder", entityId:"hist-po-25",  description:"Invoice ETC-2026-0212 marked DISPUTED — invoiced £242 over PO total, awaiting credit note from Eurotech", createdAt:d("2026-02-28",11) },
      // Stock adjustments (stocktakes)
      { organizationId:ORG, userId:MGR1,  action:AuditAction.UPDATE,  entity:"BranchStock",   entityId:null,          description:"Stocktake shrinkage — CMP-003 ×28 missing at London (recorded 14 Feb 2026)",         createdAt:d("2026-02-14",17) },
      { organizationId:ORG, userId:MGR2,  action:AuditAction.UPDATE,  entity:"BranchStock",   entityId:null,          description:"Stocktake shrinkage — NET-002 ×6 missing at Manchester (recorded 14 Feb 2026)",       createdAt:d("2026-02-14",17,15) },
      { organizationId:ORG, userId:MGR2,  action:AuditAction.UPDATE,  entity:"BranchStock",   entityId:null,          description:"Stocktake shrinkage — LED-004 ×12 missing at Manchester (recorded 30 May 2026)",      createdAt:d("2026-05-30",17) },
      // Stock transfer events
      { organizationId:ORG, userId:MGR1,  action:AuditAction.CREATE,  entity:"StockTransfer", entityId:"evt-xfr-03",  description:"Dispatched B1→B2 transfer — CMP-005 ×60, CMP-003 ×25 via DPD, expected 17 Jun",     createdAt:d("2026-06-15",14) },
      // New PO created today
      { organizationId:ORG, userId:ADMIN, action:AuditAction.CREATE,  entity:"PurchaseOrder", entityId:"evt-po-01",   description:"Created draft PO PO-20260617-0001 — Q3 component buffer restock from Eurotech",       createdAt:d("2026-06-17",9) },
      // User logins (today)
      { organizationId:ORG, userId:ADMIN, action:AuditAction.LOGIN,   entity:"User",          entityId:ADMIN,         description:"Admin login — London office (web)",                                                   createdAt:d("2026-06-17",8,30) },
      { organizationId:ORG, userId:MGR1,  action:AuditAction.LOGIN,   entity:"User",          entityId:MGR1,          description:"Manager login — London Branch morning session",                                       createdAt:d("2026-06-17",8,45) },
      { organizationId:ORG, userId:MGR2,  action:AuditAction.LOGIN,   entity:"User",          entityId:MGR2,          description:"Manager login — Manchester Branch morning session",                                   createdAt:d("2026-06-17",8,50) },
    ]});
    console.log("✓ 8. Audit log created (15 entries — VOID, UPDATE, CREATE, LOGIN)");
  } else {
    console.log(`✓ 8. Audit log already seeded (${existAudit} entries), skipping`);
  }

  console.log("\n✅ seed-events complete — every system event type now represented");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
