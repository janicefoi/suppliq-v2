// prisma/seed-history.ts
// Adds 6 months of historical trading data for Meridian Electronics Ltd
// Covers Oct 2025 – Mar 2026, before the main seed's Apr–Jun 2026 data
// Run with:  npx tsx prisma/seed-history.ts

import { PrismaClient, StockMovementReason, ExpenseCategory, PurchaseOrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

const VAT = 20 / 120;
function tax(n: number) { return Math.round(n * VAT * 100) / 100; }

function at(monDate: Date, dayOffset: number, h: number, m = 0): Date {
  const r = new Date(monDate);
  r.setDate(r.getDate() + dayOffset);
  r.setHours(h, m, 0, 0);
  return r;
}

function d(dateStr: string, h: number, m = 0): Date {
  const r = new Date(`${dateStr}T00:00:00`);
  r.setHours(h, m, 0, 0);
  return r;
}

const _rSeq: Record<string, number> = {};
function rcpN(date: Date): string {
  const k = date.toISOString().slice(0, 10).replace(/-/g, "");
  _rSeq[k] = (_rSeq[k] ?? 0) + 1;
  return `RCP-${k}-${String(_rSeq[k]).padStart(4, "0")}`;
}

const _pSeq: Record<string, number> = {};
function poN(date: Date): string {
  const k = date.toISOString().slice(0, 10).replace(/-/g, "");
  _pSeq[k] = (_pSeq[k] ?? 0) + 1;
  return `PO-${k}-${String(_pSeq[k]).padStart(4, "0")}`;
}

// Apply seasonal multiplier and floor to integer (min 1)
function q(base: number, mult100: number): number {
  return Math.max(1, Math.floor((base * mult100) / 100));
}

// ── weekly retail template ────────────────────────────────────────────────────
// Base quantities at mult=100 (1.0×). Each entry: {dayOffset 0=Mon…4=Fri, h, m, br, emp, pay, cust, disc, lines}

type Tx = {
  d: number; h: number; m: number;
  br: "B1" | "B2";
  emp: "M1" | "M2" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
  pay: "PAID" | "CREDIT";
  cust: string | null;
  disc: number;
  lines: { sku: string; qty: number }[];
};

const WEEK_RETAIL: Tx[] = [
  // Monday — B1 heavy
  { d:0, h:9,  m:20, br:"B1", emp:"C1", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"PWR-007",qty:8},{sku:"LED-006",qty:10},{sku:"TOL-012",qty:10}] },
  { d:0, h:10, m:0,  br:"B1", emp:"C2", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"CMP-001",qty:4},{sku:"CMP-006",qty:4},{sku:"CAB-009",qty:6}] },
  { d:0, h:11, m:30, br:"B2", emp:"C5", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"SWR-001",qty:8},{sku:"SWR-007",qty:8},{sku:"PWR-005",qty:6}] },
  { d:0, h:14, m:0,  br:"B2", emp:"C7", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"CAB-002",qty:5},{sku:"CAB-007",qty:5},{sku:"TOL-011",qty:5}] },
  // Tuesday
  { d:1, h:9,  m:30, br:"B1", emp:"C3", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"LED-004",qty:5},{sku:"LED-005",qty:4},{sku:"LED-006",qty:8}] },
  { d:1, h:11, m:0,  br:"B1", emp:"C4", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"CAB-005",qty:3},{sku:"CAB-003",qty:4},{sku:"CAB-004",qty:2}] },
  { d:1, h:14, m:30, br:"B2", emp:"C6", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"NET-001",qty:2},{sku:"AVS-003",qty:2},{sku:"CMP-010",qty:1}] },
  // Wednesday
  { d:2, h:9,  m:0,  br:"B1", emp:"C1", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"TOL-011",qty:6},{sku:"TOL-012",qty:8},{sku:"TOL-004",qty:4}] },
  { d:2, h:10, m:30, br:"B1", emp:"C2", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"PWR-005",qty:8},{sku:"PWR-006",qty:6},{sku:"CMP-004",qty:4}] },
  { d:2, h:13, m:0,  br:"B2", emp:"C5", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"LED-002",qty:3},{sku:"LED-003",qty:3},{sku:"PWR-007",qty:6}] },
  // Thursday
  { d:3, h:9,  m:15, br:"B1", emp:"C3", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"CMP-007",qty:5},{sku:"CMP-008",qty:4},{sku:"SWR-004",qty:3}] },
  { d:3, h:11, m:0,  br:"B1", emp:"C4", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"NET-002",qty:1},{sku:"NET-001",qty:2},{sku:"AVS-003",qty:2}] },
  { d:3, h:14, m:0,  br:"B2", emp:"C6", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"SWR-002",qty:4},{sku:"SWR-006",qty:4},{sku:"CAB-008",qty:4}] },
  // Friday
  { d:4, h:9,  m:0,  br:"B1", emp:"C1", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"LED-001",qty:2},{sku:"LED-008",qty:2},{sku:"CAB-006",qty:2}] },
  { d:4, h:14, m:0,  br:"B2", emp:"C7", pay:"PAID",  cust:null,         disc:0, lines:[{sku:"PWR-007",qty:10},{sku:"CAB-002",qty:6},{sku:"SWR-001",qty:8}] },
];

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\nSeeding Meridian historical data (Oct 2025 – Mar 2026)…\n");

  // ── refs ───────────────────────────────────────────────────────────────────
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "meridian" } });
  const b1  = await prisma.branch.findFirstOrThrow({ where: { name: "London Branch",     organizationId: org.id } });
  const b2  = await prisma.branch.findFirstOrThrow({ where: { name: "Manchester Branch", organizationId: org.id } });

  const B1 = b1.id, B2 = b2.id;

  const uM1 = await prisma.user.findUniqueOrThrow({ where: { email: "sophie.harris@meridian.co.uk" } });
  const uM2 = await prisma.user.findUniqueOrThrow({ where: { email: "james.walker@meridian.co.uk" } });
  const uC1 = await prisma.user.findUniqueOrThrow({ where: { email: "emma.jones@meridian.co.uk" } });
  const uC2 = await prisma.user.findUniqueOrThrow({ where: { email: "liam.smith@meridian.co.uk" } });
  const uC3 = await prisma.user.findUniqueOrThrow({ where: { email: "olivia.brown@meridian.co.uk" } });
  const uC4 = await prisma.user.findUniqueOrThrow({ where: { email: "noah.taylor@meridian.co.uk" } });
  const uC5 = await prisma.user.findUniqueOrThrow({ where: { email: "ava.wilson@meridian.co.uk" } });
  const uC6 = await prisma.user.findUniqueOrThrow({ where: { email: "ethan.moore@meridian.co.uk" } });
  const uC7 = await prisma.user.findUniqueOrThrow({ where: { email: "isabella.clark@meridian.co.uk" } });

  const empMap: Record<string, string> = {
    M1: uM1.id, M2: uM2.id,
    C1: uC1.id, C2: uC2.id, C3: uC3.id, C4: uC4.id,
    C5: uC5.id, C6: uC6.id, C7: uC7.id,
  };

  // Build item price map (SKU → {id, retailPrice, wholesalePrice})
  const items = await prisma.item.findMany({ where: { organizationId: org.id } });
  const iMap: Record<string, { id: string; rp: number; wp: number }> = {};
  for (const i of items) iMap[i.sku] = { id: i.id, rp: i.retailPrice, wp: i.wholesalePrice };

  // Helper: unit price by sale type
  const up = (sku: string, type: "RETAIL" | "WHOLESALE") => type === "RETAIL" ? iMap[sku].rp : iMap[sku].wp;

  // Helper: calculate line totals
  function calc(lines: {sku:string; qty:number}[], type: "RETAIL"|"WHOLESALE", disc: number) {
    const ll = lines.map(l => ({
      itemId:    iMap[l.sku].id,
      qty:       l.qty,
      unitPrice: up(l.sku, type),
      subtotal:  up(l.sku, type) * l.qty,
    }));
    const total  = ll.reduce((s, l) => s + l.subtotal, 0) - disc;
    return { ll, total, taxAmt: tax(total) };
  }

  // ── weekly calendar: [monday_date, seasonal_mult×100] ─────────────────────
  // Multiplier applied to ALL quantities in the retail template for that week.
  // Anomaly weeks marked with overrides further down.
  const weekCalendar: [string, number][] = [
    // Oct 2025 — normal trading
    ["2025-10-06", 100], ["2025-10-13", 100], ["2025-10-20", 102], ["2025-10-27", 105],
    // Nov 2025 — pre-Christmas build-up
    ["2025-11-03", 118], ["2025-11-10", 130], ["2025-11-17", 128], ["2025-11-24", 140],
    // Dec 2025 — Christmas peak
    ["2025-12-01", 150], ["2025-12-08", 165], ["2025-12-15", 185], ["2025-12-22", 170],
    // Jan 2026 — post-Christmas slump
    ["2026-01-05", 55],  ["2026-01-12", 62],  ["2026-01-19", 68],  ["2026-01-26", 72],
    // Feb 2026 — gradual recovery
    ["2026-02-02", 80],  ["2026-02-09", 83],  ["2026-02-16", 86],  ["2026-02-23", 90],
    // Mar 2026 — spring trading, building toward Apr
    ["2026-03-02", 95],  ["2026-03-09", 100], ["2026-03-16", 103], ["2026-03-23", 108],
  ];

  // Wholesale orders: alternate B1 (even weeks) and B2 (odd weeks)
  // B1 wholesale: Jessica Brown (seed-c-006) — large electronics retailer
  const B1_WS_LINES = [
    { sku:"CAB-002", qty:50 }, { sku:"CAB-005", qty:30 }, { sku:"SWR-001", qty:40 },
    { sku:"LED-006", qty:60 }, { sku:"CMP-001", qty:80 }, { sku:"PWR-005", qty:50 },
  ];
  // B2 wholesale: Ethan Robinson (seed-c-015) — networking reseller
  const B2_WS_LINES = [
    { sku:"CAB-005", qty:35 }, { sku:"CAB-006", qty:15 }, { sku:"NET-001", qty:20 },
    { sku:"SWR-001", qty:30 }, { sku:"CAB-002", qty:40 }, { sku:"PWR-007", qty:60 },
  ];

  // ── build all sale specs ──────────────────────────────────────────────────
  type SS = {
    br: string; emp: string; cust: string | null;
    type: "RETAIL" | "WHOLESALE"; pay: "PAID" | "CREDIT";
    disc: number; date: Date; lines: { sku: string; qty: number }[];
  };

  const allSpecs: SS[] = [];

  for (let wi = 0; wi < weekCalendar.length; wi++) {
    const [monStr, mult100] = weekCalendar[wi];
    const mon = new Date(`${monStr}T00:00:00`);

    // Retail transactions for this week
    for (const tx of WEEK_RETAIL) {
      const scaledLines = tx.lines.map(l => ({
        sku: l.sku,
        qty: q(l.qty, mult100),
      }));
      allSpecs.push({
        br:   tx.br === "B1" ? B1 : B2,
        emp:  empMap[tx.emp],
        cust: tx.cust,
        type: "RETAIL",
        pay:  tx.pay,
        disc: tx.disc,
        date: at(mon, tx.d, tx.h, tx.m),
        lines: scaledLines,
      });
    }

    // Wholesale every week — B1 on even weeks, B2 on odd weeks
    if (wi % 2 === 0) {
      // B1 wholesale on Tuesday morning
      const wsLines = B1_WS_LINES.map(l => ({ sku: l.sku, qty: q(l.qty, mult100) }));
      allSpecs.push({
        br: B1, emp: empMap["M1"], cust: "seed-c-006",
        type: "WHOLESALE", pay: "CREDIT", disc: Math.floor(1000 * mult100 / 100),
        date: at(mon, 1, 10, 0),
        lines: wsLines,
      });
    } else {
      // B2 wholesale on Thursday morning
      const wsLines = B2_WS_LINES.map(l => ({ sku: l.sku, qty: q(l.qty, mult100) }));
      allSpecs.push({
        br: B2, emp: empMap["M2"], cust: "seed-c-015",
        type: "WHOLESALE", pay: "CREDIT", disc: Math.floor(500 * mult100 / 100),
        date: at(mon, 3, 10, 0),
        lines: wsLines,
      });
    }
  }

  // ── ANOMALY: Nov 10 week — ESP32 (NET-002) maker-community spike ──────────
  // A UK maker channel featured the ESP32 DevKit; demand tripled for the week.
  // This creates a clear sales_spike that the anomaly detector will catch
  // when compared to the Oct/Nov baseline.
  allSpecs.push(
    { br:B1, emp:empMap["C3"], cust:null,         type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-11-10",14,0), lines:[{sku:"NET-002",qty:8}] },
    { br:B1, emp:empMap["C4"], cust:"seed-c-009", type:"RETAIL", pay:"CREDIT", disc:0,
      date:d("2025-11-11",10,0), lines:[{sku:"NET-002",qty:6},{sku:"NET-001",qty:8}] },
    { br:B2, emp:empMap["C6"], cust:null,         type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-11-11",14,30), lines:[{sku:"NET-002",qty:5}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-007", type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-11-12",9,0),  lines:[{sku:"NET-002",qty:10},{sku:"NET-001",qty:5}] },
    { br:B2, emp:empMap["C5"], cust:null,         type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-11-12",11,0), lines:[{sku:"NET-002",qty:4}] },
    { br:B1, emp:empMap["C1"], cust:null,         type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-11-13",9,30), lines:[{sku:"NET-002",qty:7},{sku:"CMP-003",qty:6}] },
    { br:B2, emp:empMap["C7"], cust:"seed-c-021", type:"RETAIL", pay:"CREDIT", disc:0,
      date:d("2025-11-14",10,0), lines:[{sku:"NET-002",qty:5},{sku:"AVS-003",qty:4}] },
  );

  // ── ANOMALY: Dec 15 week — LED-001 Christmas decoration rush ─────────────
  // Commercial contractors buying RGB strips for Christmas window displays.
  allSpecs.push(
    { br:B1, emp:empMap["C2"], cust:"seed-c-019", type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-12-15",9,30), lines:[{sku:"LED-001",qty:10},{sku:"LED-008",qty:5}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-003", type:"RETAIL", pay:"CREDIT", disc:0,
      date:d("2025-12-15",14,0), lines:[{sku:"LED-001",qty:8},{sku:"LED-009",qty:3}] },
    { br:B2, emp:empMap["C5"], cust:null,         type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-12-16",10,0), lines:[{sku:"LED-001",qty:6},{sku:"LED-002",qty:5}] },
    { br:B1, emp:empMap["C3"], cust:null,         type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-12-17",9,0),  lines:[{sku:"LED-001",qty:8},{sku:"LED-003",qty:4}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-005", type:"RETAIL", pay:"PAID",   disc:0,
      date:d("2025-12-17",14,0), lines:[{sku:"LED-001",qty:12},{sku:"LED-008",qty:4}] },
  );

  // ── Big quarterly wholesale orders ────────────────────────────────────────
  // Charlotte Davies — major restock in Oct, Dec, Feb
  allSpecs.push(
    { br:B1, emp:empMap["M1"], cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:2000,
      date:d("2025-10-15",9,0),
      lines:[{sku:"NET-005",qty:6},{sku:"NET-006",qty:6},{sku:"LED-001",qty:18},{sku:"LED-007",qty:6},{sku:"CAB-006",qty:20},{sku:"PWR-003",qty:8},{sku:"LED-004",qty:15},{sku:"NET-004",qty:6}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:2500,
      date:d("2025-12-10",9,0),
      lines:[{sku:"NET-005",qty:8},{sku:"NET-006",qty:8},{sku:"LED-001",qty:25},{sku:"LED-007",qty:8},{sku:"CAB-006",qty:30},{sku:"PWR-003",qty:12},{sku:"TOL-001",qty:4},{sku:"TOL-006",qty:4}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:1500,
      date:d("2026-02-20",9,0),
      lines:[{sku:"NET-005",qty:5},{sku:"NET-006",qty:5},{sku:"LED-004",qty:15},{sku:"LED-008",qty:8},{sku:"CAB-006",qty:15},{sku:"PWR-003",qty:6}] },
  );

  // Lucas Young — LED contractor orders in Nov, Jan
  allSpecs.push(
    { br:B2, emp:empMap["M2"], cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:1500,
      date:d("2025-11-20",9,0),
      lines:[{sku:"LED-001",qty:20},{sku:"LED-007",qty:6},{sku:"LED-008",qty:8},{sku:"CAB-006",qty:20},{sku:"PWR-003",qty:10},{sku:"SWR-008",qty:6}] },
    { br:B2, emp:empMap["M2"], cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:800,
      date:d("2026-01-28",9,0),
      lines:[{sku:"LED-004",qty:15},{sku:"LED-005",qty:15},{sku:"LED-008",qty:6},{sku:"CAB-006",qty:10}] },
  );

  // James White — regular quarterly component order
  allSpecs.push(
    { br:B1, emp:empMap["M1"], cust:"seed-c-011", type:"WHOLESALE", pay:"CREDIT", disc:500,
      date:d("2025-10-22",10,0),
      lines:[{sku:"CAB-001",qty:30},{sku:"CAB-002",qty:50},{sku:"CAB-005",qty:40},{sku:"CMP-001",qty:80}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-011", type:"WHOLESALE", pay:"CREDIT", disc:500,
      date:d("2026-01-21",10,0),
      lines:[{sku:"CAB-001",qty:25},{sku:"CAB-002",qty:40},{sku:"CAB-009",qty:60},{sku:"CMP-006",qty:60}] },
    { br:B1, emp:empMap["M1"], cust:"seed-c-011", type:"WHOLESALE", pay:"CREDIT", disc:500,
      date:d("2026-03-18",10,0),
      lines:[{sku:"CAB-002",qty:50},{sku:"CAB-005",qty:40},{sku:"CAB-003",qty:30},{sku:"CMP-001",qty:100}] },
  );

  // Sophie Anderson — Manchester wholesale, relay and switch specialist
  allSpecs.push(
    { br:B2, emp:empMap["M2"], cust:"seed-c-008", type:"WHOLESALE", pay:"CREDIT", disc:0,
      date:d("2025-11-06",10,0),
      lines:[{sku:"SWR-004",qty:25},{sku:"SWR-005",qty:12},{sku:"SWR-007",qty:40},{sku:"CAB-005",qty:30}] },
    { br:B2, emp:empMap["M2"], cust:"seed-c-008", type:"WHOLESALE", pay:"CREDIT", disc:0,
      date:d("2026-02-05",10,0),
      lines:[{sku:"SWR-004",qty:20},{sku:"SWR-006",qty:15},{sku:"SWR-002",qty:20},{sku:"CMP-007",qty:30}] },
  );

  // ── idempotency: skip sales block if already seeded ─────────────────────
  const existHist = await prisma.sale.count({
    where: { organizationId: org.id, createdAt: { lt: new Date("2026-04-01") } },
  });

  if (existHist > 10) {
    console.log(`✓ Historical sales already seeded (${existHist} before Apr 2026), skipping sales`);
  } else {
  // Sort chronologically and seed
  allSpecs.sort((a, b) => a.date.getTime() - b.date.getTime());

  let saleCount = 0;
  for (const spec of allSpecs) {
    const rcpNum = rcpN(spec.date);
    const { ll, total, taxAmt } = calc(spec.lines, spec.type, spec.disc);

    const sale = await prisma.sale.upsert({
      where:  { receiptNumber_organizationId: { receiptNumber: rcpNum, organizationId: org.id } },
      update: {},
      create: {
        receiptNumber: rcpNum,
        saleType:      spec.type,
        paymentStatus: spec.pay,
        discountAmount: spec.disc,
        taxAmount:      taxAmt,
        totalAmount:    total,
        isVoid:         false,
        customerId:     spec.cust,
        employeeId:     spec.emp,
        branchId:       spec.br,
        organizationId: org.id,
        createdAt:      spec.date,
        items: {
          create: ll.map(l => ({
            itemId:    l.itemId,
            quantity:  l.qty,
            unitPrice: l.unitPrice,
            subtotal:  l.subtotal,
          })),
        },
      },
    });

    for (const l of ll) {
      await prisma.stockLog.create({
        data: {
          itemId:        l.itemId,
          branchId:      spec.br,
          organizationId: org.id,
          quantity:      -l.qty,
          reason:        StockMovementReason.SALE,
          referenceId:   sale.id,
          recordedById:  spec.emp,
          createdAt:     spec.date,
        },
      });
    }
    saleCount++;
  }
  console.log(`✓ ${saleCount} historical sales + stock logs`);
  } // end sales block

  // ── Historical purchase orders ────────────────────────────────────────────
  // 5 per month, covering Oct 2025 – Mar 2026 (30 POs total)
  // All RECEIVED — these document how Meridian restocked over the period.

  const existHistPOs = await prisma.purchaseOrder.count({
    where: { id: { startsWith: "hist-po-" } },
  });
  if (existHistPOs >= 30) {
    console.log(`✓ Historical POs already seeded (${existHistPOs}), skipping`);
  } else {
    type POS = { id: string; sup: string; items: {sku:string; qty:number; cost:number}[]; by:string; br:string; date:Date };
    const poSpecs: POS[] = [
      // Oct 2025
      { id:"hist-po-01", sup:"seed-sup-1",
        items:[{sku:"CMP-001",qty:1200,cost:85},{sku:"CMP-006",qty:1000,cost:65},{sku:"CMP-003",qty:400,cost:185}],
        by:uM1.id, br:B1, date:d("2025-10-03",10,0) },
      { id:"hist-po-02", sup:"seed-sup-2",
        items:[{sku:"CAB-002",qty:600,cost:85},{sku:"CAB-005",qty:500,cost:125},{sku:"CAB-009",qty:400,cost:90}],
        by:uM1.id, br:B1, date:d("2025-10-03",10,0) },
      { id:"hist-po-03", sup:"seed-sup-3",
        items:[{sku:"LED-006",qty:1000,cost:75},{sku:"LED-004",qty:250,cost:230},{sku:"LED-002",qty:150,cost:420}],
        by:uM1.id, br:B1, date:d("2025-10-08",9,0) },
      { id:"hist-po-04", sup:"seed-sup-4",
        items:[{sku:"PWR-007",qty:2000,cost:30},{sku:"PWR-005",qty:800,cost:100},{sku:"TOL-011",qty:400,cost:90}],
        by:uM2.id, br:B2, date:d("2025-10-10",9,0) },
      { id:"hist-po-05", sup:"seed-sup-1",
        items:[{sku:"NET-001",qty:400,cost:130},{sku:"NET-002",qty:200,cost:320},{sku:"CMP-007",qty:500,cost:85}],
        by:uM1.id, br:B1, date:d("2025-10-17",10,0) },

      // Nov 2025 — bigger orders pre-Christmas
      { id:"hist-po-06", sup:"seed-sup-1",
        items:[{sku:"CMP-001",qty:1500,cost:85},{sku:"CMP-003",qty:500,cost:185},{sku:"CMP-010",qty:150,cost:380}],
        by:uM1.id, br:B1, date:d("2025-11-03",10,0) },
      { id:"hist-po-07", sup:"seed-sup-2",
        items:[{sku:"CAB-002",qty:700,cost:85},{sku:"CAB-005",qty:600,cost:125},{sku:"CAB-003",qty:350,cost:160}],
        by:uM2.id, br:B2, date:d("2025-11-05",9,0) },
      { id:"hist-po-08", sup:"seed-sup-3",
        items:[{sku:"LED-001",qty:200,cost:540},{sku:"LED-006",qty:1200,cost:75},{sku:"LED-007",qty:60,cost:880}],
        by:uM1.id, br:B1, date:d("2025-11-07",10,0) },
      { id:"hist-po-09", sup:"seed-sup-4",
        items:[{sku:"PWR-001",qty:500,cost:175},{sku:"PWR-007",qty:2500,cost:30},{sku:"SWR-001",qty:600,cost:55}],
        by:uM2.id, br:B2, date:d("2025-11-12",9,0) },
      { id:"hist-po-10", sup:"seed-sup-1",
        items:[{sku:"NET-002",qty:300,cost:320},{sku:"NET-005",qty:20,cost:4000},{sku:"CMP-004",qty:400,cost:70}],
        by:uM1.id, br:B1, date:d("2025-11-19",10,0) },

      // Dec 2025 — peak Christmas orders
      { id:"hist-po-11", sup:"seed-sup-1",
        items:[{sku:"CMP-001",qty:2000,cost:85},{sku:"CMP-006",qty:1500,cost:65},{sku:"CMP-007",qty:600,cost:85}],
        by:uM1.id, br:B1, date:d("2025-12-01",10,0) },
      { id:"hist-po-12", sup:"seed-sup-2",
        items:[{sku:"CAB-002",qty:900,cost:85},{sku:"CAB-005",qty:700,cost:125},{sku:"CAB-006",qty:200,cost:295}],
        by:uM2.id, br:B2, date:d("2025-12-03",9,0) },
      { id:"hist-po-13", sup:"seed-sup-3",
        items:[{sku:"LED-001",qty:250,cost:540},{sku:"LED-006",qty:1500,cost:75},{sku:"LED-008",qty:100,cost:375}],
        by:uM1.id, br:B1, date:d("2025-12-05",10,0) },
      { id:"hist-po-14", sup:"seed-sup-4",
        items:[{sku:"PWR-007",qty:3500,cost:30},{sku:"PWR-005",qty:1000,cost:100},{sku:"TOL-012",qty:600,cost:38}],
        by:uM2.id, br:B2, date:d("2025-12-08",9,0) },
      { id:"hist-po-15", sup:"seed-sup-1",
        items:[{sku:"NET-002",qty:200,cost:320},{sku:"NET-001",qty:500,cost:130},{sku:"AVS-003",qty:150,cost:245}],
        by:uM1.id, br:B1, date:d("2025-12-10",10,0) },

      // Jan 2026 — slow, maintenance restocks only
      { id:"hist-po-16", sup:"seed-sup-4",
        items:[{sku:"TOL-011",qty:300,cost:90},{sku:"TOL-012",qty:400,cost:38},{sku:"TOL-002",qty:100,cost:290}],
        by:uM1.id, br:B1, date:d("2026-01-07",10,0) },
      { id:"hist-po-17", sup:"seed-sup-2",
        items:[{sku:"CAB-008",qty:200,cost:155},{sku:"CAB-009",qty:300,cost:90},{sku:"CAB-004",qty:150,cost:200}],
        by:uM2.id, br:B2, date:d("2026-01-09",9,0) },
      { id:"hist-po-18", sup:"seed-sup-3",
        items:[{sku:"LED-004",qty:150,cost:230},{sku:"LED-005",qty:150,cost:230},{sku:"LED-003",qty:100,cost:420}],
        by:uM1.id, br:B1, date:d("2026-01-14",10,0) },
      { id:"hist-po-19", sup:"seed-sup-1",
        items:[{sku:"CMP-004",qty:300,cost:70},{sku:"CMP-008",qty:300,cost:120},{sku:"CMP-005",qty:250,cost:95}],
        by:uM1.id, br:B1, date:d("2026-01-21",10,0) },
      { id:"hist-po-20", sup:"seed-sup-4",
        items:[{sku:"PWR-002",qty:150,cost:285},{sku:"PWR-004",qty:100,cost:325},{sku:"PWR-001",qty:300,cost:175}],
        by:uM2.id, br:B2, date:d("2026-01-28",9,0) },

      // Feb 2026 — recovery, moderate orders
      { id:"hist-po-21", sup:"seed-sup-1",
        items:[{sku:"CMP-001",qty:1000,cost:85},{sku:"CMP-003",qty:350,cost:185},{sku:"CMP-006",qty:800,cost:65}],
        by:uM1.id, br:B1, date:d("2026-02-04",10,0) },
      { id:"hist-po-22", sup:"seed-sup-2",
        items:[{sku:"CAB-002",qty:500,cost:85},{sku:"CAB-005",qty:400,cost:125},{sku:"CAB-003",qty:250,cost:160}],
        by:uM2.id, br:B2, date:d("2026-02-06",9,0) },
      { id:"hist-po-23", sup:"seed-sup-3",
        items:[{sku:"LED-006",qty:800,cost:75},{sku:"LED-001",qty:120,cost:540},{sku:"AVS-003",qty:100,cost:245}],
        by:uM1.id, br:B1, date:d("2026-02-11",10,0) },
      { id:"hist-po-24", sup:"seed-sup-4",
        items:[{sku:"PWR-007",qty:2000,cost:30},{sku:"SWR-001",qty:400,cost:55},{sku:"SWR-007",qty:300,cost:65}],
        by:uM2.id, br:B2, date:d("2026-02-18",9,0) },
      { id:"hist-po-25", sup:"seed-sup-1",
        items:[{sku:"NET-001",qty:350,cost:130},{sku:"NET-002",qty:180,cost:320},{sku:"CMP-010",qty:100,cost:380}],
        by:uM1.id, br:B1, date:d("2026-02-25",10,0) },

      // Mar 2026 — spring ramp-up
      { id:"hist-po-26", sup:"seed-sup-1",
        items:[{sku:"CMP-001",qty:1200,cost:85},{sku:"CMP-006",qty:1000,cost:65},{sku:"CMP-003",qty:400,cost:185}],
        by:uM1.id, br:B1, date:d("2026-03-04",10,0) },
      { id:"hist-po-27", sup:"seed-sup-2",
        items:[{sku:"CAB-002",qty:600,cost:85},{sku:"CAB-005",qty:500,cost:125},{sku:"CAB-006",qty:150,cost:295}],
        by:uM2.id, br:B2, date:d("2026-03-06",9,0) },
      { id:"hist-po-28", sup:"seed-sup-3",
        items:[{sku:"LED-006",qty:1000,cost:75},{sku:"LED-004",qty:200,cost:230},{sku:"LED-007",qty:50,cost:880}],
        by:uM1.id, br:B1, date:d("2026-03-11",10,0) },
      { id:"hist-po-29", sup:"seed-sup-4",
        items:[{sku:"PWR-007",qty:2500,cost:30},{sku:"PWR-005",qty:700,cost:100},{sku:"TOL-011",qty:350,cost:90}],
        by:uM2.id, br:B2, date:d("2026-03-13",9,0) },
      { id:"hist-po-30", sup:"seed-sup-1",
        items:[{sku:"NET-002",qty:200,cost:320},{sku:"NET-005",qty:15,cost:4000},{sku:"NET-001",qty:400,cost:130}],
        by:uM1.id, br:B1, date:d("2026-03-25",10,0) },
    ];

    let poCount = 0;
    for (const po of poSpecs) {
      const sup = await prisma.supplier.findUniqueOrThrow({ where: { id: po.sup } });
      let createdPO: { id: string } | null = null;
      try {
        createdPO = await prisma.purchaseOrder.create({
          data: {
            id:             po.id,
            poNumber:       poN(po.date),
            supplierId:     sup.id,
            status:         PurchaseOrderStatus.RECEIVED,
            organizationId: org.id,
            branchId:       po.br,
            createdById:    po.by,
            deliveredAt:    po.date,
            createdAt:      po.date,
            items: {
              create: po.items.map(i => ({
                itemId:      iMap[i.sku].id,
                quantity:    i.qty,
                costPrice:   i.cost,
                receivedQty: i.qty,
              })),
            },
          },
        });
        poCount++;
      } catch (e: unknown) {
        if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
          console.log(`  skipping ${po.id}: PO number already exists`);
          continue;
        }
        throw e;
      }

      for (const i of po.items) {
        await prisma.stockLog.create({
          data: {
            itemId:         iMap[i.sku].id,
            branchId:       po.br,
            organizationId: org.id,
            quantity:       i.qty,
            reason:         StockMovementReason.PURCHASE_RECEIVED,
            referenceId:    createdPO.id,
            recordedById:   po.by,
            createdAt:      po.date,
          },
        });
      }
    }
    console.log(`✓ ${poCount} historical purchase orders + stock logs`);
  }

  // ── Monthly expenses (Oct 2025 – Mar 2026) ────────────────────────────────
  // Amounts in pence (same unit as sale totals) for consistency with AI service.
  // Rent=London branch; Salaries=whole org; Utilities/Maintenance=split by branch.
  const existExpenses = await prisma.expense.count({
    where: { organizationId: org.id, date: { lt: new Date("2026-04-01") } },
  });
  if (existExpenses > 0) {
    console.log(`✓ Historical expenses already seeded (${existExpenses}), skipping`);
  } else {
    type EX = { desc:string; amount:number; cat:ExpenseCategory; date:Date; br:string|null; by:string };
    const months = [
      ["2025-10", 100], ["2025-11", 100], ["2025-12", 100],
      ["2026-01", 100], ["2026-02", 100], ["2026-03", 100],
    ] as [string, number][];

    const exSpecs: EX[] = [];
    for (const [ym] of months) {
      const [y, m] = ym.split("-").map(Number);
      const date1  = new Date(y, m - 1, 1,  9,  0, 0);
      const date5  = new Date(y, m - 1, 5,  9,  0, 0);
      const date8  = new Date(y, m - 1, 8,  9,  0, 0);
      const date15 = new Date(y, m - 1, 15, 9,  0, 0);
      const date20 = new Date(y, m - 1, 20, 9,  0, 0);
      const date25 = new Date(y, m - 1, 25, 9,  0, 0);

      exSpecs.push(
        { desc:`Office rent — London Branch ${ym}`,    amount:850000, cat:ExpenseCategory.RENT,        date:date1,  br:B1, by:uM1.id },
        { desc:`Branch maintenance ${ym}`,              amount:80000,  cat:ExpenseCategory.MAINTENANCE, date:date5,  br:B1, by:uM1.id },
        { desc:`Utilities (electric, broadband) ${ym}`, amount:120000, cat:ExpenseCategory.UTILITIES,   date:date8,  br:B1, by:uM1.id },
        { desc:`Manchester branch utilities ${ym}`,     amount:95000,  cat:ExpenseCategory.UTILITIES,   date:date8,  br:B2, by:uM2.id },
        { desc:`Fleet & delivery transport ${ym}`,      amount:150000, cat:ExpenseCategory.TRANSPORT,   date:date15, br:null, by:uM1.id },
        { desc:`Digital & trade marketing ${ym}`,       amount:300000, cat:ExpenseCategory.MARKETING,   date:date20, br:null, by:uM1.id },
        { desc:`Staff salaries ${ym}`,                  amount:3500000, cat:ExpenseCategory.SALARIES,  date:date25, br:null, by:uM1.id },
      );
    }
    // Dec 2025: double marketing spend for Christmas campaign
    exSpecs.push({ desc:"Christmas marketing campaign 2025", amount:350000, cat:ExpenseCategory.MARKETING, date:d("2025-12-01",10,0), br:null, by:uM1.id });
    // Jan 2026: one-off maintenance (annual equipment service)
    exSpecs.push({ desc:"Annual equipment service & calibration", amount:280000, cat:ExpenseCategory.MAINTENANCE, date:d("2026-01-08",10,0), br:B1, by:uM1.id });

    for (const ex of exSpecs) {
      await prisma.expense.create({
        data: {
          description:    ex.desc,
          amount:         ex.amount,
          category:       ex.cat,
          date:           ex.date,
          organizationId: org.id,
          branchId:       ex.br,
          recordedById:   ex.by,
        },
      });
    }
    console.log(`✓ ${exSpecs.length} historical expenses`);
  }

  // ── Stock shrinkage event: Feb 2026 ───────────────────────────────────────
  // A batch of CMP-003 (ATmega328P) counted short after a quarterly audit —
  // 28 units unaccounted for in London branch. Feeds the stock_shrinkage anomaly.
  const existShrink = await prisma.stockLog.count({
    where: {
      organizationId: org.id,
      reason:         StockMovementReason.MANUAL_ADJUSTMENT,
      createdAt:      { gte: new Date("2026-02-01"), lt: new Date("2026-03-01") },
    },
  });
  if (existShrink === 0) {
    await prisma.stockLog.create({
      data: {
        itemId:         iMap["CMP-003"].id,
        branchId:       B1,
        organizationId: org.id,
        quantity:       -28,
        reason:         StockMovementReason.MANUAL_ADJUSTMENT,
        referenceId:    "audit-feb-2026",
        recordedById:   uM1.id,
        createdAt:      d("2026-02-14", 16, 0),
      },
    });
    // Small shrinkage on NET-002 in Manchester — 6 units
    await prisma.stockLog.create({
      data: {
        itemId:         iMap["NET-002"].id,
        branchId:       B2,
        organizationId: org.id,
        quantity:       -6,
        reason:         StockMovementReason.MANUAL_ADJUSTMENT,
        referenceId:    "audit-feb-2026-mcr",
        recordedById:   uM2.id,
        createdAt:      d("2026-02-14", 16, 30),
      },
    });
    console.log("✓ Stock shrinkage events (Feb 2026 audit)");
  }

  // ── Update current branch stocks for interesting AI scenarios ─────────────
  // After all the history, set "current" stock levels so AI features trigger:
  //   Near-reorder: CMP-003 (ATmega), NET-005 (Raspberry Pi)
  //   Overstocked:  LED-007 (Flood Light), CAB-006 (Cat6 10m)
  const stockUpdates: { sku:string; b1:number; b2:number; thr:number }[] = [
    // Near reorder — anomaly detection + reorder alerts will fire
    { sku:"CMP-003", b1:32,  b2:14,  thr:30 },  // B1 critically close; B2 below threshold
    { sku:"NET-005", b1:4,   b2:2,   thr:4  },  // Both near/below threshold (£68 item → high value risk)
    { sku:"CMP-010", b1:18,  b2:8,   thr:15 },  // STM32 running low
    // Overstocked — overstock analysis will flag
    { sku:"LED-007", b1:140, b2:72,  thr:8  },  // Flood light: 6× reorder point with slow demand
    { sku:"CAB-006", b1:280, b2:140, thr:18 },  // Cat6 10m: 10× reorder point
    { sku:"PWR-003", b1:95,  b2:48,  thr:12 },  // 12V 5A PSU: slow seller, over-bought
  ];

  for (const s of stockUpdates) {
    const itemId = iMap[s.sku].id;
    await prisma.branchStock.updateMany({ where:{ itemId, branchId: B1 }, data:{ stockQty: s.b1, lowStockThreshold: s.thr } });
    await prisma.branchStock.updateMany({ where:{ itemId, branchId: B2 }, data:{ stockQty: s.b2, lowStockThreshold: s.thr } });
  }
  console.log(`✓ Branch stock levels updated for AI scenarios`);

  console.log("\n✅ Historical seed complete!\n");
  console.log("  Sales added:    Oct 2025 – Mar 2026 (~390 transactions)");
  console.log("  POs added:      30 purchase orders with stock logs");
  console.log("  Expenses:       6 months × 7 categories (+ 2 one-offs)");
  console.log("  Anomalies:      Nov 10 ESP32 spike, Dec 15 LED strip rush,");
  console.log("                  Feb 14 ATmega shrinkage (-28 units)");
  console.log("  Stock alerts:   CMP-003, NET-005 near reorder");
  console.log("                  LED-007, CAB-006 overstocked\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
