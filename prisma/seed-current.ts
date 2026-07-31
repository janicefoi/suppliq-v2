// prisma/seed-current.ts
// Adds dense weekly trading data for Meridian Electronics Ltd, Apr 2026 – 17 Jun 2026
// Fills in the gap between the main seed's sparse Apr-Jun transactions and today.
// Run AFTER:  npx tsx prisma/seed.ts   AND   npx tsx prisma/seed-history.ts
// Run with:   npx tsx prisma/seed-current.ts

import { PrismaClient, StockMovementReason, ExpenseCategory, PurchaseOrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

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

function q(base: number, mult100: number): number {
  return Math.max(1, Math.floor((base * mult100) / 100));
}

// ── weekly retail template (same as seed-history.ts) ─────────────────────────
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
  { d:0, h:9,  m:20, br:"B1", emp:"C1", pay:"PAID",  cust:null, disc:0, lines:[{sku:"PWR-007",qty:8},{sku:"LED-006",qty:10},{sku:"TOL-012",qty:10}] },
  { d:0, h:10, m:0,  br:"B1", emp:"C2", pay:"PAID",  cust:null, disc:0, lines:[{sku:"CMP-001",qty:4},{sku:"CMP-006",qty:4},{sku:"CAB-009",qty:6}] },
  { d:0, h:11, m:30, br:"B2", emp:"C5", pay:"PAID",  cust:null, disc:0, lines:[{sku:"SWR-001",qty:8},{sku:"SWR-007",qty:8},{sku:"PWR-005",qty:6}] },
  { d:0, h:14, m:0,  br:"B2", emp:"C7", pay:"PAID",  cust:null, disc:0, lines:[{sku:"CAB-002",qty:5},{sku:"CAB-007",qty:5},{sku:"TOL-011",qty:5}] },
  { d:1, h:9,  m:30, br:"B1", emp:"C3", pay:"PAID",  cust:null, disc:0, lines:[{sku:"LED-004",qty:5},{sku:"LED-005",qty:4},{sku:"LED-006",qty:8}] },
  { d:1, h:11, m:0,  br:"B1", emp:"C4", pay:"PAID",  cust:null, disc:0, lines:[{sku:"CAB-005",qty:3},{sku:"CAB-003",qty:4},{sku:"CAB-004",qty:2}] },
  { d:1, h:14, m:30, br:"B2", emp:"C6", pay:"PAID",  cust:null, disc:0, lines:[{sku:"NET-001",qty:2},{sku:"AVS-003",qty:2},{sku:"CMP-010",qty:1}] },
  { d:2, h:9,  m:0,  br:"B1", emp:"C1", pay:"PAID",  cust:null, disc:0, lines:[{sku:"TOL-011",qty:6},{sku:"TOL-012",qty:8},{sku:"TOL-004",qty:4}] },
  { d:2, h:10, m:30, br:"B1", emp:"C2", pay:"PAID",  cust:null, disc:0, lines:[{sku:"PWR-005",qty:8},{sku:"PWR-006",qty:6},{sku:"CMP-004",qty:4}] },
  { d:2, h:13, m:0,  br:"B2", emp:"C5", pay:"PAID",  cust:null, disc:0, lines:[{sku:"LED-002",qty:3},{sku:"LED-003",qty:3},{sku:"PWR-007",qty:6}] },
  { d:3, h:9,  m:15, br:"B1", emp:"C3", pay:"PAID",  cust:null, disc:0, lines:[{sku:"CMP-007",qty:5},{sku:"CMP-008",qty:4},{sku:"SWR-004",qty:3}] },
  { d:3, h:11, m:0,  br:"B1", emp:"C4", pay:"PAID",  cust:null, disc:0, lines:[{sku:"NET-002",qty:1},{sku:"NET-001",qty:2},{sku:"AVS-003",qty:2}] },
  { d:3, h:14, m:0,  br:"B2", emp:"C6", pay:"PAID",  cust:null, disc:0, lines:[{sku:"SWR-002",qty:4},{sku:"SWR-006",qty:4},{sku:"CAB-008",qty:4}] },
  { d:4, h:9,  m:0,  br:"B1", emp:"C1", pay:"PAID",  cust:null, disc:0, lines:[{sku:"LED-001",qty:2},{sku:"LED-008",qty:2},{sku:"CAB-006",qty:2}] },
  { d:4, h:14, m:0,  br:"B2", emp:"C7", pay:"PAID",  cust:null, disc:0, lines:[{sku:"PWR-007",qty:10},{sku:"CAB-002",qty:6},{sku:"SWR-001",qty:8}] },
];

async function main() {
  console.log("\nSeeding Meridian current data (Apr 2026 – 17 Jun 2026)…\n");

  // ── refs ──────────────────────────────────────────────────────────────────
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "meridian" } });
  const b1  = await prisma.branch.findFirstOrThrow({ where: { name: "London Branch",     organizationId: org.id } });
  const b2  = await prisma.branch.findFirstOrThrow({ where: { name: "Manchester Branch", organizationId: org.id } });
  const B1  = b1.id, B2 = b2.id;

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
    M1:uM1.id, M2:uM2.id, C1:uC1.id, C2:uC2.id, C3:uC3.id, C4:uC4.id,
    C5:uC5.id, C6:uC6.id, C7:uC7.id,
  };

  const items = await prisma.item.findMany({ where: { organizationId: org.id } });
  const iMap: Record<string, { id: string; rp: number; wp: number }> = {};
  for (const i of items) iMap[i.sku] = { id: i.id, rp: i.retailPrice, wp: i.wholesalePrice };

  const up = (sku: string, type: "RETAIL" | "WHOLESALE") =>
    type === "RETAIL" ? iMap[sku].rp : iMap[sku].wp;

  function calc(lines: {sku:string; qty:number}[], type: "RETAIL"|"WHOLESALE", disc: number) {
    const ll = lines.map(l => ({
      itemId: iMap[l.sku].id, qty: l.qty,
      unitPrice: up(l.sku, type), subtotal: up(l.sku, type) * l.qty,
    }));
    const total = ll.reduce((s, l) => s + l.subtotal, 0) - disc;
    return { ll, total, taxAmt: tax(total) };
  }

  // ── idempotency: skip if we already densified Apr-Jun ────────────────────
  // Main seed alone has ~88 Apr-Jun sales; after this script it's ~280+
  const existCurrent = await prisma.sale.count({
    where: { organizationId: org.id, createdAt: { gte: new Date("2026-04-01"), lt: new Date("2026-07-01") } },
  });
  if (existCurrent > 150) {
    console.log(`✓ Apr-Jun 2026 sales already dense (${existCurrent}), skipping sales`);
  } else {
    // Weekly calendar: [monday_date_str, seasonal_mult×100]
    // April and May are the strongest months for this org.
    // June multiplier stays high — infrastructure projects driving demand.
    const weekCalendar: [string, number, number][] = [
      // [monday, mult100, maxDayOffset] — maxDayOffset 4=full week, 2=Mon-Wed partial
      ["2026-04-06", 108, 4], ["2026-04-13", 110, 4],
      ["2026-04-20", 112, 4], ["2026-04-27", 112, 4],
      ["2026-05-04", 113, 4], ["2026-05-11", 115, 4],
      ["2026-05-18", 116, 4], ["2026-05-25", 117, 4],
      ["2026-06-01", 118, 4], ["2026-06-08", 120, 4],
      ["2026-06-15", 120, 2],  // partial: Mon-Wed (today is Wed Jun 17)
    ];

    // Wholesale lines (same as seed-history.ts)
    const B1_WS_LINES = [
      {sku:"CAB-002",qty:50},{sku:"CAB-005",qty:30},{sku:"SWR-001",qty:40},
      {sku:"LED-006",qty:60},{sku:"CMP-001",qty:80},{sku:"PWR-005",qty:50},
    ];
    const B2_WS_LINES = [
      {sku:"CAB-005",qty:35},{sku:"CAB-006",qty:15},{sku:"NET-001",qty:20},
      {sku:"SWR-001",qty:30},{sku:"CAB-002",qty:40},{sku:"PWR-007",qty:60},
    ];

    type SS = {
      br: string; emp: string; cust: string | null;
      type: "RETAIL"|"WHOLESALE"; pay: "PAID"|"CREDIT";
      disc: number; date: Date; lines: {sku:string; qty:number}[];
    };

    const allSpecs: SS[] = [];

    for (let wi = 0; wi < weekCalendar.length; wi++) {
      const [monStr, mult100, maxDay] = weekCalendar[wi];
      const mon = new Date(`${monStr}T00:00:00`);

      for (const tx of WEEK_RETAIL) {
        if (tx.d > maxDay) continue;
        allSpecs.push({
          br:   tx.br === "B1" ? B1 : B2,
          emp:  empMap[tx.emp],
          cust: tx.cust,
          type: "RETAIL", pay: tx.pay, disc: tx.disc,
          date: at(mon, tx.d, tx.h, tx.m),
          lines: tx.lines.map(l => ({ sku: l.sku, qty: q(l.qty, mult100) })),
        });
      }

      // Wholesale: even wi = B1 (Tue), odd wi = B2 (Thu)
      if (wi % 2 === 0 && 1 <= maxDay) {
        allSpecs.push({
          br: B1, emp: empMap["M1"], cust: "seed-c-006",
          type: "WHOLESALE", pay: "CREDIT",
          disc: q(100000, mult100),
          date: at(mon, 1, 10, 0),
          lines: B1_WS_LINES.map(l => ({ sku: l.sku, qty: q(l.qty, mult100) })),
        });
      } else if (wi % 2 !== 0 && 3 <= maxDay) {
        allSpecs.push({
          br: B2, emp: empMap["M2"], cust: "seed-c-015",
          type: "WHOLESALE", pay: "CREDIT",
          disc: q(50000, mult100),
          date: at(mon, 3, 10, 0),
          lines: B2_WS_LINES.map(l => ({ sku: l.sku, qty: q(l.qty, mult100) })),
        });
      }
    }

    // ── ANOMALY: Jun 9-11 — CAB-005 (Cat6 3m) infrastructure spike ──────────
    // A local council data-centre refurbishment drives 4× normal CAB-005 demand.
    // Anomaly detector compares this week's rate vs 90-day baseline and flags critical.
    allSpecs.push(
      { br:B1, emp:empMap["C4"], cust:"seed-c-011", type:"RETAIL", pay:"CREDIT", disc:0,
        date:d("2026-06-09",9,30), lines:[{sku:"CAB-005",qty:30},{sku:"CAB-008",qty:10}] },
      { br:B1, emp:empMap["M1"], cust:"seed-c-006", type:"WHOLESALE", pay:"CREDIT", disc:500,
        date:d("2026-06-09",11,0), lines:[{sku:"CAB-005",qty:60},{sku:"CAB-006",qty:20},{sku:"CAB-009",qty:40}] },
      { br:B2, emp:empMap["C6"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-10",10,0), lines:[{sku:"CAB-005",qty:18},{sku:"CAB-002",qty:12}] },
      { br:B1, emp:empMap["C3"], cust:"seed-c-009", type:"RETAIL", pay:"CREDIT", disc:0,
        date:d("2026-06-10",14,0), lines:[{sku:"CAB-005",qty:25},{sku:"CAB-009",qty:15}] },
      { br:B1, emp:empMap["C2"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-11",9,0),  lines:[{sku:"CAB-005",qty:20},{sku:"CAB-006",qty:8}] },
      { br:B2, emp:empMap["M2"], cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:0,
        date:d("2026-06-11",10,30),lines:[{sku:"CAB-005",qty:40},{sku:"CAB-006",qty:15}] },
    );

    // ── Additional June sales — normal trading Jun 12-17 ─────────────────────
    allSpecs.push(
      { br:B1, emp:empMap["C1"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-12",9,30), lines:[{sku:"PWR-007",qty:12},{sku:"LED-006",qty:14},{sku:"TOL-012",qty:12}] },
      { br:B2, emp:empMap["C5"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-12",11,0), lines:[{sku:"CAB-002",qty:6},{sku:"SWR-001",qty:10},{sku:"PWR-005",qty:8}] },
      { br:B1, emp:empMap["C3"], cust:"seed-c-005", type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-13",10,0), lines:[{sku:"NET-002",qty:2},{sku:"NET-001",qty:3},{sku:"AVS-003",qty:2}] },
      { br:B2, emp:empMap["C7"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-13",14,0), lines:[{sku:"LED-004",qty:5},{sku:"LED-006",qty:10},{sku:"CMP-001",qty:5}] },
      { br:B1, emp:empMap["C4"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-16",9,15), lines:[{sku:"CMP-007",qty:6},{sku:"CMP-008",qty:5},{sku:"SWR-004",qty:4}] },
      { br:B2, emp:empMap["C6"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-16",11,30),lines:[{sku:"SWR-006",qty:5},{sku:"SWR-002",qty:5},{sku:"TOL-011",qty:6}] },
      { br:B1, emp:empMap["C1"], cust:"seed-c-003", type:"RETAIL", pay:"CREDIT", disc:0,
        date:d("2026-06-17",9,0),  lines:[{sku:"LED-006",qty:15},{sku:"LED-004",qty:6},{sku:"LED-001",qty:3}] },
      { br:B2, emp:empMap["C5"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-17",10,30),lines:[{sku:"PWR-007",qty:14},{sku:"CAB-002",qty:8},{sku:"SWR-001",qty:10}] },
      { br:B1, emp:empMap["C2"], cust:null,         type:"RETAIL", pay:"PAID", disc:0,
        date:d("2026-06-17",14,0), lines:[{sku:"CMP-003",qty:4},{sku:"CMP-010",qty:2},{sku:"NET-002",qty:2}] },
    );

    allSpecs.sort((a, b) => a.date.getTime() - b.date.getTime());

    let created = 0, skipped = 0;
    for (const spec of allSpecs) {
      const rcpNum = rcpN(spec.date);
      const { ll, total, taxAmt } = calc(spec.lines, spec.type, spec.disc);

      let sale: { id: string } | null = null;
      try {
        sale = await prisma.sale.create({
          data: {
            receiptNumber:  rcpNum,
            saleType:       spec.type,
            paymentStatus:  spec.pay,
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
                itemId: l.itemId, quantity: l.qty,
                unitPrice: l.unitPrice, subtotal: l.subtotal,
              })),
            },
          },
        });
        created++;
      } catch (e: unknown) {
        if (e && typeof e === "object" && "code" in e && (e as {code:string}).code === "P2002") {
          skipped++;
          continue;
        }
        throw e;
      }

      for (const l of ll) {
        await prisma.stockLog.create({
          data: {
            itemId: l.itemId, branchId: spec.br, organizationId: org.id,
            quantity: -l.qty, reason: StockMovementReason.SALE,
            referenceId: sale.id, recordedById: spec.emp, createdAt: spec.date,
          },
        });
      }
    }
    console.log(`✓ ${created} new Apr-Jun 2026 sales + stock logs (${skipped} deduplicated)`);
  }

  // ── April–June 2026 monthly expenses ─────────────────────────────────────
  const existCurrentExp = await prisma.expense.count({
    where: { organizationId: org.id, date: { gte: new Date("2026-04-01") } },
  });
  if (existCurrentExp > 0) {
    console.log(`✓ Apr-Jun 2026 expenses already seeded (${existCurrentExp}), skipping`);
  } else {
    type EX = { desc:string; amount:number; cat:ExpenseCategory; date:Date; br:string|null; by:string };
    const exSpecs: EX[] = [];

    const months: [string, number, number][] = [
      // [year-month, marketingAmt (pence), extraNote]
      ["2026-04", 300000, 0],
      ["2026-05", 320000, 0],
      ["2026-06", 300000, 0],
    ];

    for (const [ym, mktAmt] of months) {
      const [y, m] = ym.split("-").map(Number);
      const date1  = new Date(y, m - 1, 1,  9,  0, 0);
      const date5  = new Date(y, m - 1, 5,  9,  0, 0);
      const date8  = new Date(y, m - 1, 8,  9,  0, 0);
      const date15 = new Date(y, m - 1, 15, 9,  0, 0);
      const date20 = new Date(y, m - 1, 20, 9,  0, 0);
      const date25 = new Date(y, m - 1, 25, 9,  0, 0);

      exSpecs.push(
        { desc:`Office rent — London Branch ${ym}`,     amount:850000,  cat:ExpenseCategory.RENT,        date:date1,  br:B1,   by:uM1.id },
        { desc:`Branch maintenance ${ym}`,               amount:80000,   cat:ExpenseCategory.MAINTENANCE, date:date5,  br:B1,   by:uM1.id },
        { desc:`Utilities (electric, broadband) ${ym}`,  amount:120000,  cat:ExpenseCategory.UTILITIES,   date:date8,  br:B1,   by:uM1.id },
        { desc:`Manchester branch utilities ${ym}`,      amount:95000,   cat:ExpenseCategory.UTILITIES,   date:date8,  br:B2,   by:uM2.id },
        { desc:`Fleet & delivery transport ${ym}`,       amount:150000,  cat:ExpenseCategory.TRANSPORT,   date:date15, br:null, by:uM1.id },
        { desc:`Digital & trade marketing ${ym}`,        amount:mktAmt,  cat:ExpenseCategory.MARKETING,   date:date20, br:null, by:uM1.id },
        { desc:`Staff salaries ${ym}`,                   amount:3500000, cat:ExpenseCategory.SALARIES,   date:date25, br:null, by:uM1.id },
      );
    }

    // May: trade show attendance (Electronica Birmingham)
    exSpecs.push({
      desc: "Electronica Birmingham 2026 — stand & travel",
      amount: 480000, cat: ExpenseCategory.MARKETING,
      date: d("2026-05-13", 9, 0), br: null, by: uM1.id,
    });
    // June: unplanned HVAC repair at London branch (outlier for anomaly detection)
    exSpecs.push({
      desc: "Emergency HVAC repair — London Branch",
      amount: 620000, cat: ExpenseCategory.MAINTENANCE,
      date: d("2026-06-05", 14, 0), br: B1, by: uM1.id,
    });

    for (const ex of exSpecs) {
      await prisma.expense.create({
        data: {
          description: ex.desc, amount: ex.amount, category: ex.cat,
          date: ex.date, organizationId: org.id, branchId: ex.br, recordedById: ex.by,
        },
      });
    }
    console.log(`✓ ${exSpecs.length} Apr-Jun 2026 expenses (incl. trade show + HVAC outlier)`);
  }

  // ── June 2026 purchase orders ─────────────────────────────────────────────
  // The main seed has no POs in June. Add 3 to cover the CAB-005 spike demand.
  const existJunePOs = await prisma.purchaseOrder.count({
    where: { id: { startsWith: "curr-po-" } },
  });
  if (existJunePOs > 0) {
    console.log(`✓ June 2026 POs already seeded (${existJunePOs}), skipping`);
  } else {
    type POS = { id:string; sup:string; items:{sku:string;qty:number;cost:number}[]; by:string; br:string; date:Date };
    const poSpecs: POS[] = [
      // Emergency cable restock triggered by the Jun 9-11 CAB-005 spike
      { id:"curr-po-01", sup:"seed-sup-2",
        items:[{sku:"CAB-005",qty:800,cost:125},{sku:"CAB-006",qty:200,cost:295},{sku:"CAB-002",qty:500,cost:85}],
        by:uM1.id, br:B1, date:d("2026-06-10",8,0) },
      // Low-stock reorder: CMP-003 and NET-005 running critically low
      { id:"curr-po-02", sup:"seed-sup-1",
        items:[{sku:"CMP-003",qty:400,cost:185},{sku:"NET-005",qty:20,cost:4000},{sku:"CMP-010",qty:120,cost:380}],
        by:uM1.id, br:B1, date:d("2026-06-13",10,0) },
      // Regular mid-June restock
      { id:"curr-po-03", sup:"seed-sup-3",
        items:[{sku:"LED-006",qty:800,cost:75},{sku:"LED-004",qty:200,cost:230},{sku:"AVS-003",qty:100,cost:245}],
        by:uM2.id, br:B2, date:d("2026-06-16",9,0) },
    ];

    for (const po of poSpecs) {
      const sup = await prisma.supplier.findUniqueOrThrow({ where: { id: po.sup } });
      const createdPO = await prisma.purchaseOrder.create({
        data: {
          id: po.id, poNumber: poN(po.date), supplierId: sup.id,
          status: PurchaseOrderStatus.RECEIVED,
          organizationId: org.id, branchId: po.br,
          createdById: po.by, deliveredAt: po.date, createdAt: po.date,
          items: {
            create: po.items.map(i => ({
              itemId: iMap[i.sku].id, quantity: i.qty, costPrice: i.cost, receivedQty: i.qty,
            })),
          },
        },
      });
      for (const i of po.items) {
        await prisma.stockLog.create({
          data: {
            itemId: iMap[i.sku].id, branchId: po.br, organizationId: org.id,
            quantity: i.qty, reason: StockMovementReason.PURCHASE_RECEIVED,
            referenceId: createdPO.id, recordedById: po.by, createdAt: po.date,
          },
        });
      }
    }
    console.log(`✓ ${poSpecs.length} June 2026 purchase orders + stock logs`);
  }

  // ── May stocktake shrinkage: LED-004 in Manchester ────────────────────────
  const existMayShrink = await prisma.stockLog.count({
    where: {
      organizationId: org.id, reason: StockMovementReason.MANUAL_ADJUSTMENT,
      createdAt: { gte: new Date("2026-05-01"), lt: new Date("2026-06-01") },
    },
  });
  if (existMayShrink === 0) {
    await prisma.stockLog.create({
      data: {
        itemId: iMap["LED-004"].id, branchId: B2, organizationId: org.id,
        quantity: -12, reason: StockMovementReason.MANUAL_ADJUSTMENT,
        referenceId: "stocktake-may-2026-mcr", recordedById: uM2.id,
        createdAt: d("2026-05-30", 17, 0),
      },
    });
    console.log("✓ May 2026 stocktake shrinkage: LED-004 Manchester -12 units");
  }

  // ── Final data summary ────────────────────────────────────────────────────
  const [totalSales, totalLogs, totalPOs, totalExp] = await Promise.all([
    prisma.sale.count({ where: { organizationId: org.id } }),
    prisma.stockLog.count({ where: { organizationId: org.id } }),
    prisma.purchaseOrder.count({ where: { organizationId: org.id } }),
    prisma.expense.count({ where: { organizationId: org.id } }),
  ]);

  console.log("\n✅ Current-period seed complete!\n");
  console.log("═══════════════════════════════════════════════════════");
  console.log(` Total sales:      ${totalSales}`);
  console.log(` Total stock logs: ${totalLogs}`);
  console.log(` Total POs:        ${totalPOs}`);
  console.log(` Total expenses:   ${totalExp}`);
  console.log("═══════════════════════════════════════════════════════");
  console.log(" Key AI scenarios seeded:");
  console.log("  • CAB-005 spike Jun 9-11 (council data-centre project)");
  console.log("  • Expense outlier: HVAC repair Jun 5 (£6,200)");
  console.log("  • Trade show: Electronica Birmingham May 13 (£4,800)");
  console.log("  • May stocktake shrinkage: LED-004 Manchester -12");
  console.log("  • CMP-003 & NET-005 near-zero stock → reorder POs Jun 13");
  console.log("");
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
