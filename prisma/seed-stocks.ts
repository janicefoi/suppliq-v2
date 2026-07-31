// prisma/seed-stocks.ts
// Sets realistic "right now" branch stock levels for Meridian Electronics Ltd.
// Designed so every AI feature has something meaningful to detect:
//
//   REORDER ALERTS      — 14 items below their lowStockThreshold
//   OVERSTOCK ALERTS    — 6 items with stock 5-17× their threshold
//   TRANSFER HINTS      — 10 cross-branch imbalances (surplus ↔ deficit)
//   HEALTHY             — remaining items at realistic trading levels
//
// Safe to re-run — uses updateMany which is idempotent.
// Run with:  npx tsx prisma/seed-stocks.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── scenario legend ───────────────────────────────────────────────────────────
//  "BELOW"    qty is under lowStockThreshold — triggers reorder alert
//  "AT"       qty equals threshold — borderline
//  "HEALTHY"  comfortable normal trading level
//  "HIGH"     meaningfully above threshold but not flagged
//  "OVER"     dramatically over threshold — triggers overstock alert
//  "IMBAL"    one branch BELOW / AT  while the other is OVER → transfer hint

type Row = {
  sku:  string;
  b1:   number;  // London qty
  b2:   number;  // Manchester qty
  thr:  number;  // lowStockThreshold (same both branches)
  note: string;
};

const stocks: Row[] = [
  // ══════════════════════════════════════════════════════════════════════
  //  COMPONENTS & ICs
  // ══════════════════════════════════════════════════════════════════════
  // CMP-001  10K Resistor (100pcs) — bread-and-butter, always moving
  { sku:"CMP-001", b1:420, b2:210, thr:80,  note:"HEALTHY" },

  // CMP-002  100nF Capacitor (50pcs) — London ran down; Manchester can cover
  { sku:"CMP-002", b1:48,  b2:195, thr:60,  note:"IMBAL: B1 BELOW (48<60), B2 HIGH" },

  // CMP-003  ATmega328P MCU — already updated by seed-history; reinforce
  { sku:"CMP-003", b1:32,  b2:14,  thr:30,  note:"IMBAL: B1 barely above, B2 BELOW (14<30)" },

  // CMP-004  NE555 Timer (10pcs) — healthy across both
  { sku:"CMP-004", b1:285, b2:142, thr:45,  note:"HEALTHY" },

  // CMP-005  LM7805 Regulator (10pcs) — over-ordered London; Manchester critical
  { sku:"CMP-005", b1:218, b2:11,  thr:38,  note:"IMBAL: B1 OVER (218≈5.7×), B2 BELOW (11<38)" },

  // CMP-006  1N4007 Diode (50pcs) — healthy
  { sku:"CMP-006", b1:385, b2:192, thr:65,  note:"HEALTHY" },

  // CMP-007  BC547 Transistor (20pcs) — healthy, consumed steadily
  { sku:"CMP-007", b1:312, b2:156, thr:50,  note:"HEALTHY" },

  // CMP-008  10uF Capacitor (20pcs) — healthy
  { sku:"CMP-008", b1:265, b2:132, thr:45,  note:"HEALTHY" },

  // CMP-009  L293D Motor Driver — London nearly out; Manchester can transfer
  { sku:"CMP-009", b1:9,   b2:68,  thr:22,  note:"IMBAL: B1 BELOW (9<22), B2 HIGH → transfer ~25 to B1" },

  // CMP-010  STM32F103 ARM MCU — both low from high demand; already set
  { sku:"CMP-010", b1:18,  b2:8,   thr:15,  note:"IMBAL: B1 barely above, B2 BELOW (8<15)" },

  // CMP-011  100R Resistor (100pcs) — healthy
  { sku:"CMP-011", b1:435, b2:218, thr:65,  note:"HEALTHY" },

  // CMP-012  16MHz Crystal (5pcs) — London slipped just below threshold
  { sku:"CMP-012", b1:24,  b2:96,  thr:30,  note:"IMBAL: B1 BELOW (24<30), B2 HEALTHY → transfer ~20 to B1" },

  // ══════════════════════════════════════════════════════════════════════
  //  CABLES & CONNECTORS
  // ══════════════════════════════════════════════════════════════════════
  // CAB-001  USB-A to USB-B — London depleted by several wholesale orders
  { sku:"CAB-001", b1:21,  b2:92,  thr:30,  note:"IMBAL: B1 BELOW (21<30), B2 HIGH → transfer ~30 to B1" },

  // CAB-002  Micro-USB 1.8m — healthy, fast mover well-stocked
  { sku:"CAB-002", b1:265, b2:132, thr:45,  note:"HEALTHY" },

  // CAB-003  USB-C to USB-C — healthy
  { sku:"CAB-003", b1:215, b2:108, thr:38,  note:"HEALTHY" },

  // CAB-004  HDMI Cable 2m — London critically low; Manchester has plenty
  { sku:"CAB-004", b1:8,   b2:118, thr:22,  note:"IMBAL: B1 BELOW (8<22), B2 HIGH → transfer ~50 to B1" },

  // CAB-005  Cat6 3m — spike consumed stock; new PO Jun 10 arriving shortly
  { sku:"CAB-005", b1:42,  b2:28,  thr:30,  note:"B1 HIGH, B2 BELOW (28<30) — replenishment PO in transit" },

  // CAB-006  Cat6 10m — dramatically overstocked both branches
  { sku:"CAB-006", b1:278, b2:138, thr:18,  note:"OVER: B1 15×, B2 7.7× threshold" },

  // CAB-007  3.5mm Audio — over-ordered; streaming killed demand
  { sku:"CAB-007", b1:275, b2:138, thr:28,  note:"OVER: B1 9.8×, B2 4.9× threshold; very slow mover" },

  // CAB-008  JST-PH Connector (10pcs) — healthy
  { sku:"CAB-008", b1:138, b2:69,  thr:22,  note:"HEALTHY" },

  // CAB-009  DuPont Jumper Set — healthy
  { sku:"CAB-009", b1:278, b2:139, thr:45,  note:"HEALTHY" },

  // CAB-010  Coaxial RG6 10m — London nearly out; Manchester overstocked
  { sku:"CAB-010", b1:7,   b2:82,  thr:15,  note:"IMBAL: B1 BELOW (7<15), B2 OVER (82=5.5×) → transfer ~35 to B1" },

  // ══════════════════════════════════════════════════════════════════════
  //  POWER SUPPLIES
  // ══════════════════════════════════════════════════════════════════════
  // PWR-001  5V 2A USB Adapter — London bare; Manchester loaded
  { sku:"PWR-001", b1:9,   b2:182, thr:30,  note:"IMBAL: B1 BELOW (9<30), B2 OVER (182=6×) → transfer ~70 to B1" },

  // PWR-002  12V 2A DC Adapter — healthy
  { sku:"PWR-002", b1:148, b2:74,  thr:25,  note:"HEALTHY" },

  // PWR-003  12V 5A Desktop PSU — over-ordered; slow premium item
  { sku:"PWR-003", b1:95,  b2:48,  thr:12,  note:"OVER: B1 7.9×, B2 4× threshold" },

  // PWR-004  24V 2A Adapter — over-ordered; niche demand lower than forecast
  { sku:"PWR-004", b1:145, b2:72,  thr:15,  note:"OVER: B1 9.7×, B2 4.8× threshold" },

  // PWR-005  AA Battery (8pcs) — fast mover, healthy
  { sku:"PWR-005", b1:415, b2:208, thr:80,  note:"HEALTHY" },

  // PWR-006  AAA Battery (8pcs) — healthy
  { sku:"PWR-006", b1:358, b2:179, thr:60,  note:"HEALTHY" },

  // PWR-007  9V PP3 Battery — high velocity, well-stocked
  { sku:"PWR-007", b1:375, b2:188, thr:80,  note:"HEALTHY" },

  // PWR-008  18650 Li-Ion Cell — healthy
  { sku:"PWR-008", b1:108, b2:54,  thr:18,  note:"HEALTHY" },

  // ══════════════════════════════════════════════════════════════════════
  //  LED & LIGHTING
  // ══════════════════════════════════════════════════════════════════════
  // LED-001  RGB LED Strip 5m — healthy after Christmas spike subsided
  { sku:"LED-001", b1:62,  b2:31,  thr:12,  note:"HEALTHY" },

  // LED-002  Neutral White Strip — healthy
  { sku:"LED-002", b1:75,  b2:38,  thr:14,  note:"HEALTHY" },

  // LED-003  Warm White Strip — healthy
  { sku:"LED-003", b1:70,  b2:35,  thr:13,  note:"HEALTHY" },

  // LED-004  Downlight 4000K — healthy (Manchester slightly lower after shrinkage)
  { sku:"LED-004", b1:108, b2:42,  thr:18,  note:"HEALTHY; B2 lower after May shrinkage" },

  // LED-005  Downlight 3000K — London well-stocked; Manchester critically low
  { sku:"LED-005", b1:96,  b2:7,   thr:16,  note:"IMBAL: B2 BELOW (7<16), B1 HEALTHY → transfer ~30 to B2" },

  // LED-006  LED Bulb E27 — flagship fast mover; healthy both
  { sku:"LED-006", b1:325, b2:162, thr:60,  note:"HEALTHY" },

  // LED-007  Flood Light 30W — dramatically overstocked (seasonal miss)
  { sku:"LED-007", b1:140, b2:72,  thr:8,   note:"OVER: B1 17.5×, B2 9× threshold; summer/winter miss" },

  // LED-008  LED Driver 60W — healthy
  { sku:"LED-008", b1:68,  b2:34,  thr:12,  note:"HEALTHY" },

  // LED-009  LED Driver 100W — healthy
  { sku:"LED-009", b1:52,  b2:26,  thr:10,  note:"HEALTHY" },

  // ══════════════════════════════════════════════════════════════════════
  //  AUDIO & VISUAL
  // ══════════════════════════════════════════════════════════════════════
  // AVS-001  Piezo Buzzer — healthy
  { sku:"AVS-001", b1:265, b2:132, thr:45,  note:"HEALTHY" },

  // AVS-002  Active Buzzer — healthy
  { sku:"AVS-002", b1:242, b2:121, thr:42,  note:"HEALTHY" },

  // AVS-003  OLED Display I2C — healthy; steady maker demand
  { sku:"AVS-003", b1:125, b2:62,  thr:22,  note:"HEALTHY" },

  // AVS-004  2.4in TFT LCD — London healthy; Manchester nearly out
  { sku:"AVS-004", b1:72,  b2:6,   thr:12,  note:"IMBAL: B2 BELOW (6<12), B1 HEALTHY → transfer ~20 to B2" },

  // AVS-005  Microphone Breakout — London below threshold; Manchester fine
  { sku:"AVS-005", b1:22,  b2:95,  thr:30,  note:"IMBAL: B1 BELOW (22<30), B2 HIGH → transfer ~25 to B1" },

  // AVS-006  PAM8403 Audio Amp — healthy
  { sku:"AVS-006", b1:138, b2:69,  thr:22,  note:"HEALTHY" },

  // AVS-007  IR Remote Kit — over-ordered; smart-home shift reduced demand
  { sku:"AVS-007", b1:182, b2:91,  thr:30,  note:"OVER: B1 6×, B2 3× threshold; demand declined" },

  // AVS-008  7-Segment Display — healthy
  { sku:"AVS-008", b1:138, b2:69,  thr:22,  note:"HEALTHY" },

  // ══════════════════════════════════════════════════════════════════════
  //  NETWORKING
  // ══════════════════════════════════════════════════════════════════════
  // NET-001  ESP8266 WiFi Module — healthy
  { sku:"NET-001", b1:172, b2:86,  thr:30,  note:"HEALTHY" },

  // NET-002  ESP32 DevKit — recovering after Nov spike; healthy
  { sku:"NET-002", b1:88,  b2:38,  thr:22,  note:"HEALTHY; post-spike restock settled" },

  // NET-003  HC-05 Bluetooth — healthy
  { sku:"NET-003", b1:112, b2:56,  thr:18,  note:"HEALTHY" },

  // NET-004  LoRa SX1278 433MHz — London comfortable; Manchester running out
  { sku:"NET-004", b1:72,  b2:8,   thr:12,  note:"IMBAL: B2 BELOW (8<12), B1 HIGH → transfer ~20 to B2" },

  // NET-005  Raspberry Pi 4 4GB — critically low both branches (£68 item!)
  { sku:"NET-005", b1:4,   b2:2,   thr:4,   note:"CRITICAL: B1 AT threshold, B2 BELOW (2<4) — high-value gap" },

  // NET-006  8-Port Switch — London at threshold; steady demand from contractors
  { sku:"NET-006", b1:5,   b2:16,  thr:5,   note:"B1 AT threshold (5=5), B2 HEALTHY" },

  // NET-007  RJ45 Keystone (10pcs) — London fine; Manchester almost out
  { sku:"NET-007", b1:128, b2:13,  thr:22,  note:"IMBAL: B2 BELOW (13<22), B1 HIGH → transfer ~50 to B2" },

  // NET-008  USB WiFi 300Mbps — over-ordered; slow-moving product
  { sku:"NET-008", b1:162, b2:81,  thr:15,  note:"OVER: B1 10.8×, B2 5.4× threshold; slow seller" },

  // ══════════════════════════════════════════════════════════════════════
  //  SWITCHES & RELAYS
  // ══════════════════════════════════════════════════════════════════════
  // SWR-001  Tactile Buttons (20pcs) — fast mover, well-stocked
  { sku:"SWR-001", b1:318, b2:159, thr:60,  note:"HEALTHY" },

  // SWR-002  SPST Toggle Switch (5pcs) — over-ordered; lower project demand
  { sku:"SWR-002", b1:188, b2:94,  thr:38,  note:"OVER: B1 4.9×, B2 2.5× threshold" },

  // SWR-003  Rotary Encoder — London just slipped below; Manchester comfortable
  { sku:"SWR-003", b1:24,  b2:88,  thr:28,  note:"IMBAL: B1 BELOW (24<28), B2 HIGH → transfer ~30 to B1" },

  // SWR-004  5V Single Relay — healthy
  { sku:"SWR-004", b1:168, b2:84,  thr:30,  note:"HEALTHY" },

  // SWR-005  5V 4-Channel Relay — London plenty; Manchester critically low
  { sku:"SWR-005", b1:88,  b2:7,   thr:15,  note:"IMBAL: B2 BELOW (7<15), B1 HIGH → transfer ~30 to B2" },

  // SWR-006  Micro Limit Switch (5pcs) — healthy
  { sku:"SWR-006", b1:162, b2:81,  thr:28,  note:"HEALTHY" },

  // SWR-007  Slide Switch (10pcs) — healthy
  { sku:"SWR-007", b1:258, b2:129, thr:45,  note:"HEALTHY" },

  // SWR-008  DIN Rail MCB 16A — London nearly out; high-value safety item (£18)
  { sku:"SWR-008", b1:6,   b2:26,  thr:10,  note:"IMBAL: B1 BELOW (6<10), B2 HEALTHY → transfer ~10 to B1" },

  // ══════════════════════════════════════════════════════════════════════
  //  TOOLS & ACCESSORIES
  // ══════════════════════════════════════════════════════════════════════
  // TOL-001  Soldering Station 60W — London almost out; high-value item (£18)
  { sku:"TOL-001", b1:4,   b2:18,  thr:6,   note:"IMBAL: B1 BELOW (4<6), B2 HEALTHY → transfer ~6 to B1" },

  // TOL-002  Solder Wire 100g — healthy
  { sku:"TOL-002", b1:88,  b2:44,  thr:15,  note:"HEALTHY" },

  // TOL-003  Flux Paste 50g — healthy
  { sku:"TOL-003", b1:105, b2:52,  thr:18,  note:"HEALTHY" },

  // TOL-004  Heat Shrink Kit — healthy
  { sku:"TOL-004", b1:178, b2:89,  thr:30,  note:"HEALTHY" },

  // TOL-005  Breadboard 830pt — healthy
  { sku:"TOL-005", b1:138, b2:69,  thr:22,  note:"HEALTHY" },

  // TOL-006  Digital Multimeter — healthy; premium slow-mover but stocked right
  { sku:"TOL-006", b1:42,  b2:21,  thr:8,   note:"HEALTHY" },

  // TOL-007  Wire Stripper — healthy
  { sku:"TOL-007", b1:55,  b2:28,  thr:10,  note:"HEALTHY" },

  // TOL-008  Helping Hands Stand — very slow mover; over-ordered both branches
  { sku:"TOL-008", b1:122, b2:61,  thr:10,  note:"OVER: B1 12.2×, B2 6.1× threshold; poor demand" },

  // TOL-009  ESD Wrist Strap — healthy
  { sku:"TOL-009", b1:175, b2:88,  thr:30,  note:"HEALTHY" },

  // TOL-010  PCB Degreaser Spray — London below threshold; Manchester has plenty
  { sku:"TOL-010", b1:11,  b2:46,  thr:15,  note:"IMBAL: B1 BELOW (11<15), B2 HIGH → transfer ~18 to B1" },

  // TOL-011  Cable Ties 200mm — fast mover, healthy
  { sku:"TOL-011", b1:258, b2:129, thr:45,  note:"HEALTHY" },

  // TOL-012  Insulation Tape — high velocity, well-stocked
  { sku:"TOL-012", b1:345, b2:172, thr:60,  note:"HEALTHY" },
];

async function main() {
  console.log("\nUpdating Meridian branch stock levels…\n");

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "meridian" } });
  const b1  = await prisma.branch.findFirstOrThrow({ where: { name: "London Branch",     organizationId: org.id } });
  const b2  = await prisma.branch.findFirstOrThrow({ where: { name: "Manchester Branch", organizationId: org.id } });

  const items = await prisma.item.findMany({
    where:  { organizationId: org.id },
    select: { id: true, sku: true },
  });
  const iMap: Record<string, string> = {};
  for (const i of items) iMap[i.sku] = i.id;

  let updated = 0, missing = 0;
  for (const row of stocks) {
    const itemId = iMap[row.sku];
    if (!itemId) { console.warn(`  SKU ${row.sku} not found — skipping`); missing++; continue; }

    await prisma.branchStock.updateMany({
      where: { itemId, branchId: b1.id },
      data:  { stockQty: row.b1, lowStockThreshold: row.thr },
    });
    await prisma.branchStock.updateMany({
      where: { itemId, branchId: b2.id },
      data:  { stockQty: row.b2, lowStockThreshold: row.thr },
    });
    updated++;
  }

  console.log(`✓ Updated ${updated} items (${missing} SKUs not found)\n`);

  // ── Summary of scenarios ────────────────────────────────────────────────
  const below: string[] = [], over: string[] = [], imbal: string[] = [];
  for (const r of stocks) {
    if (r.note.startsWith("OVER"))    over.push(r.sku);
    else if (r.note.startsWith("IMBAL") || r.note.includes("BELOW")) imbal.push(r.sku);
  }

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(" REORDER ALERTS  — items at or below lowStockThreshold");
  console.log("───────────────────────────────────────────────────────────────────");
  const alert: [string,string,number,number,number][] = [
    ["CMP-002","London",    48,  60, 0],
    ["CMP-003","Manchester",14,  30, 0],
    ["CMP-005","Manchester",11,  38, 0],
    ["CMP-009","London",     9,  22, 0],
    ["CMP-010","Manchester", 8,  15, 0],
    ["CMP-012","London",    24,  30, 0],
    ["CAB-001","London",    21,  30, 0],
    ["CAB-004","London",     8,  22, 0],
    ["CAB-005","Manchester",28,  30, 0],
    ["CAB-010","London",     7,  15, 0],
    ["PWR-001","London",     9,  30, 0],
    ["LED-005","Manchester", 7,  16, 0],
    ["AVS-004","Manchester", 6,  12, 0],
    ["AVS-005","London",    22,  30, 0],
    ["NET-004","Manchester", 8,  12, 0],
    ["NET-005","London",     4,   4, 0],
    ["NET-005","Manchester", 2,   4, 0],
    ["NET-006","London",     5,   5, 0],
    ["NET-007","Manchester",13,  22, 0],
    ["SWR-003","London",    24,  28, 0],
    ["SWR-005","Manchester", 7,  15, 0],
    ["SWR-008","London",     6,  10, 0],
    ["TOL-001","London",     4,   6, 0],
    ["TOL-010","London",    11,  15, 0],
  ];
  for (const [sku, branch, qty, thr] of alert)
    console.log(`  ${sku.padEnd(10)} ${branch.padEnd(12)} qty:${String(qty).padStart(3)}  thr:${String(thr).padStart(3)}  ${qty < thr ? "⚠ BELOW" : "— AT threshold"}`);

  console.log("\n OVERSTOCK ALERTS — items with stock 4×+ above threshold");
  console.log("───────────────────────────────────────────────────────────────────");
  const ov: [string,string,number,number][] = [
    ["CAB-006","London",    278, 18],
    ["CAB-006","Manchester",138, 18],
    ["CAB-007","London",    275, 28],
    ["CAB-007","Manchester",138, 28],
    ["LED-007","London",    140,  8],
    ["LED-007","Manchester", 72,  8],
    ["PWR-003","London",     95, 12],
    ["PWR-003","Manchester", 48, 12],
    ["PWR-004","London",    145, 15],
    ["AVS-007","London",    182, 30],
    ["AVS-007","Manchester", 91, 30],
    ["NET-008","London",    162, 15],
    ["NET-008","Manchester", 81, 15],
    ["SWR-002","London",    188, 38],
    ["TOL-008","London",    122, 10],
    ["TOL-008","Manchester", 61, 10],
  ];
  for (const [sku, branch, qty, thr] of ov)
    console.log(`  ${sku.padEnd(10)} ${branch.padEnd(12)} qty:${String(qty).padStart(3)}  thr:${String(thr).padStart(3)}  ratio:${(qty/thr).toFixed(1)}×`);

  console.log("\n TRANSFER HINTS — surplus in one branch, deficit in the other");
  console.log("───────────────────────────────────────────────────────────────────");
  const tr: [string,number,number,number,string][] = [
    ["CMP-002",  48, 195, 60, "Transfer ~30 Manchester→London"],
    ["CMP-005",  11, 218, 38, "Transfer ~80 London→Manchester"],
    ["CMP-009",   9,  68, 22, "Transfer ~25 Manchester→London"],
    ["CMP-010",  18,   8, 15, "Both low — order from supplier"],
    ["CMP-012",  24,  96, 30, "Transfer ~20 Manchester→London"],
    ["CAB-001",  21,  92, 30, "Transfer ~30 Manchester→London"],
    ["CAB-004",   8, 118, 22, "Transfer ~50 Manchester→London"],
    ["CAB-010",   7,  82, 15, "Transfer ~35 Manchester→London"],
    ["PWR-001",   9, 182, 30, "Transfer ~70 Manchester→London"],
    ["LED-005",  96,   7, 16, "Transfer ~30 London→Manchester"],
    ["AVS-004",  72,   6, 12, "Transfer ~20 London→Manchester"],
    ["AVS-005",  22,  95, 30, "Transfer ~25 Manchester→London"],
    ["NET-004",  72,   8, 12, "Transfer ~20 London→Manchester"],
    ["NET-007", 128,  13, 22, "Transfer ~50 London→Manchester"],
    ["SWR-003",  24,  88, 28, "Transfer ~30 Manchester→London"],
    ["SWR-005",  88,   7, 15, "Transfer ~30 London→Manchester"],
    ["SWR-008",   6,  26, 10, "Transfer ~10 Manchester→London"],
    ["TOL-001",   4,  18,  6, "Transfer ~6 Manchester→London (high-value!)"],
    ["TOL-010",  11,  46, 15, "Transfer ~18 Manchester→London"],
  ];
  for (const [sku, b1q, b2q, thr, action] of tr)
    console.log(`  ${sku.padEnd(10)} LDN:${String(b1q).padStart(3)} MCR:${String(b2q).padStart(3)} thr:${String(thr).padStart(3)}  → ${action}`);

  console.log("\n✅ Stock scenarios ready.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
