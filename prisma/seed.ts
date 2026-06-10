import {
  PrismaClient,
  Role,
  PurchaseOrderStatus,
  StockMovementReason,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

const VAT_EXTRACT = 16 / 116;
function extractTax(total: number) {
  return Math.round(total * VAT_EXTRACT * 100) / 100;
}
function d(date: string, h: number, m = 0): Date {
  const dt = new Date(`${date}T00:00:00`);
  dt.setHours(h, m, 0, 0);
  return dt;
}

const _rcpSeq: Record<string, number> = {};
function rcp(date: Date): string {
  const k = date.toISOString().slice(0, 10).replace(/-/g, "");
  _rcpSeq[k] = (_rcpSeq[k] ?? 0) + 1;
  return `RCP-${k}-${String(_rcpSeq[k]).padStart(4, "0")}`;
}

const _poSeq: Record<string, number> = {};
function poNum(date: Date): string {
  const k = date.toISOString().slice(0, 10).replace(/-/g, "");
  _poSeq[k] = (_poSeq[k] ?? 0) + 1;
  return `PO-${k}-${String(_poSeq[k]).padStart(4, "0")}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database…\n");

  // ── Organization ───────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "meridian" },
    update: {},
    create: {
      id: "seed-org-meridian",
      name: "Meridian Electronics Ltd",
      slug: "meridian",
      industry: "Electronics Distribution",
      country: "GB",
      currency: "GBP",
    },
  });
  console.log(`✓ Organization: ${org.name}`);

  // ── Branches ───────────────────────────────────────────────────────────────
  const b1 = await prisma.branch.upsert({
    where: { name_organizationId: { name: "London Branch", organizationId: org.id } },
    update: { address: "14 Finsbury Square, London EC2A 1BR", phone: "+44 20 7946 0300" },
    create: { name: "London Branch", address: "14 Finsbury Square, London EC2A 1BR", phone: "+44 20 7946 0300", organizationId: org.id },
  });
  const b2 = await prisma.branch.upsert({
    where: { name_organizationId: { name: "Manchester Branch", organizationId: org.id } },
    update: { address: "8 Deansgate, Manchester M3 2QT", phone: "+44 161 946 0400" },
    create: { name: "Manchester Branch", address: "8 Deansgate, Manchester M3 2QT", phone: "+44 161 946 0400", organizationId: org.id },
  });
  console.log(`✓ Branches: ${b1.name}, ${b2.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const hw = (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.upsert({ where: { email: "admin@meridian.co.uk" },          update: {}, create: { id: "seed-u-admin", name: "Meridian Admin",  email: "admin@meridian.co.uk",           passwordHash: await hw("admin123"),   role: Role.ADMIN,   organizationId: org.id } });
  const mgr1  = await prisma.user.upsert({ where: { email: "sophie.harris@meridian.co.uk" },  update: {}, create: { id: "seed-u-mgr1",  name: "Sophie Harris",  email: "sophie.harris@meridian.co.uk",  passwordHash: await hw("manager123"), role: Role.MANAGER, organizationId: org.id, branchId: b1.id } });
  const mgr2  = await prisma.user.upsert({ where: { email: "james.walker@meridian.co.uk" },   update: {}, create: { id: "seed-u-mgr2",  name: "James Walker",   email: "james.walker@meridian.co.uk",   passwordHash: await hw("manager123"), role: Role.MANAGER, organizationId: org.id, branchId: b2.id } });
  const cs1   = await prisma.user.upsert({ where: { email: "emma.jones@meridian.co.uk" },     update: {}, create: { id: "seed-u-cs1",   name: "Emma Jones",     email: "emma.jones@meridian.co.uk",     passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b1.id } });
  const cs2   = await prisma.user.upsert({ where: { email: "liam.smith@meridian.co.uk" },     update: {}, create: { id: "seed-u-cs2",   name: "Liam Smith",     email: "liam.smith@meridian.co.uk",     passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b1.id } });
  const cs3   = await prisma.user.upsert({ where: { email: "olivia.brown@meridian.co.uk" },   update: {}, create: { id: "seed-u-cs3",   name: "Olivia Brown",   email: "olivia.brown@meridian.co.uk",   passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b1.id } });
  const cs4   = await prisma.user.upsert({ where: { email: "noah.taylor@meridian.co.uk" },    update: {}, create: { id: "seed-u-cs4",   name: "Noah Taylor",    email: "noah.taylor@meridian.co.uk",    passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b1.id } });
  const cs5   = await prisma.user.upsert({ where: { email: "ava.wilson@meridian.co.uk" },     update: {}, create: { id: "seed-u-cs5",   name: "Ava Wilson",     email: "ava.wilson@meridian.co.uk",     passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b2.id } });
  const cs6   = await prisma.user.upsert({ where: { email: "ethan.moore@meridian.co.uk" },    update: {}, create: { id: "seed-u-cs6",   name: "Ethan Moore",    email: "ethan.moore@meridian.co.uk",    passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b2.id } });
  const cs7   = await prisma.user.upsert({ where: { email: "isabella.clark@meridian.co.uk" }, update: {}, create: { id: "seed-u-cs7",   name: "Isabella Clark", email: "isabella.clark@meridian.co.uk", passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org.id, branchId: b2.id } });
  await prisma.user.upsert({             where: { email: "demo@suppliq.com" },               update: {}, create: { id: "seed-u-demo",  name: "Demo User",      email: "demo@suppliq.com",              passwordHash: await hw("demo1234"),   role: Role.ADMIN,   organizationId: org.id, branchId: b1.id } });
  void admin;
  console.log("✓ 11 users (including demo@suppliq.com)");

  // ── Categories (build id map for item FK) ─────────────────────────────────
  const catNames = ["Components & ICs", "Cables & Connectors", "Power Supplies", "LED & Lighting", "Audio & Visual", "Networking", "Switches & Relays", "Tools & Accessories"];
  const catMap: Record<string, string> = {};
  for (const n of catNames) {
    const cat = await prisma.category.upsert({
      where: { name_organizationId: { name: n, organizationId: org.id } },
      update: {},
      create: { name: n, organizationId: org.id },
    });
    catMap[n] = cat.id;
  }
  console.log(`✓ ${catNames.length} categories`);

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const sup1 = await prisma.supplier.upsert({ where: { id: "seed-sup-1" }, update: {}, create: { id: "seed-sup-1", name: "Eurotech Components GmbH",    phone: "+49 30 1234 5678", email: "orders@eurotech-components.de", address: "Berliner Str. 42, 10115 Berlin, Germany",            notes: "Primary supplier - ICs, MCUs, passive components. Net 30.", organizationId: org.id } });
  const sup2 = await prisma.supplier.upsert({ where: { id: "seed-sup-2" }, update: {}, create: { id: "seed-sup-2", name: "Thames Electronics Ltd",       phone: "+44 20 7946 0100", email: "sales@thameselectronics.co.uk", address: "Park Royal Trade Estate, London NW10 7LQ",            notes: "UK cables, connectors, switches. Fast delivery.",           organizationId: org.id } });
  const sup3 = await prisma.supplier.upsert({ where: { id: "seed-sup-3" }, update: {}, create: { id: "seed-sup-3", name: "Nordic Components AB",         phone: "+46 8 1234 5678",  email: "orders@nordiccomponents.se",   address: "Industrivägen 12, 171 48 Solna, Sweden",              notes: "LED lighting and display modules specialist.",              organizationId: org.id } });
  const sup4 = await prisma.supplier.upsert({ where: { id: "seed-sup-4" }, update: {}, create: { id: "seed-sup-4", name: "Lumitex Power Systems BV",     phone: "+31 20 123 4567",  email: "orders@lumitexpower.nl",       address: "Industrieweg 55, 1043 BW Amsterdam, Netherlands",     notes: "Power supplies, batteries, tools and accessories.",         organizationId: org.id } });
  console.log("✓ 4 suppliers");

  // ── Items ─────────────────────────────────────────────────────────────────
  type IS = { sku: string; name: string; cat: string; rp: number; wp: number; sp: number | null; sup: string; b1: number; b2: number; thr: number };
  const itemSeeds: IS[] = [
    // COMPONENTS & ICs
    { sku:"CMP-001", name:"10K Resistor Pack (100pcs)",               cat:"Components & ICs",    rp:280,  wp:180,  sp:150,  sup:sup1.id, b1:500, b2:250, thr:80 },
    { sku:"CMP-002", name:"100nF Ceramic Capacitor Pack (50pcs)",     cat:"Components & ICs",    rp:350,  wp:240,  sp:null, sup:sup1.id, b1:400, b2:200, thr:60 },
    { sku:"CMP-003", name:"ATmega328P Microcontroller (each)",        cat:"Components & ICs",    rp:420,  wp:310,  sp:280,  sup:sup1.id, b1:200, b2:100, thr:30 },
    { sku:"CMP-004", name:"NE555 Timer IC Pack (10pcs)",              cat:"Components & ICs",    rp:220,  wp:150,  sp:null, sup:sup1.id, b1:300, b2:150, thr:45 },
    { sku:"CMP-005", name:"LM7805 Voltage Regulator Pack (10pcs)",    cat:"Components & ICs",    rp:280,  wp:190,  sp:null, sup:sup1.id, b1:250, b2:125, thr:38 },
    { sku:"CMP-006", name:"1N4007 Rectifier Diode Pack (50pcs)",      cat:"Components & ICs",    rp:250,  wp:170,  sp:null, sup:sup1.id, b1:450, b2:225, thr:65 },
    { sku:"CMP-007", name:"BC547 NPN Transistor Pack (20pcs)",        cat:"Components & ICs",    rp:280,  wp:190,  sp:null, sup:sup1.id, b1:350, b2:175, thr:50 },
    { sku:"CMP-008", name:"10uF Electrolytic Capacitor Pack (20pcs)", cat:"Components & ICs",    rp:320,  wp:220,  sp:null, sup:sup1.id, b1:300, b2:150, thr:45 },
    { sku:"CMP-009", name:"L293D Motor Driver IC (each)",             cat:"Components & ICs",    rp:380,  wp:260,  sp:null, sup:sup1.id, b1:150, b2:75,  thr:22 },
    { sku:"CMP-010", name:"STM32F103C8T6 ARM MCU (each)",             cat:"Components & ICs",    rp:850,  wp:620,  sp:590,  sup:sup1.id, b1:100, b2:50,  thr:15 },
    { sku:"CMP-011", name:"100R Resistor Pack (100pcs)",              cat:"Components & ICs",    rp:280,  wp:180,  sp:null, sup:sup1.id, b1:450, b2:225, thr:65 },
    { sku:"CMP-012", name:"16MHz Crystal Oscillator Pack (5pcs)",     cat:"Components & ICs",    rp:350,  wp:240,  sp:null, sup:sup1.id, b1:200, b2:100, thr:30 },
    // CABLES & CONNECTORS
    { sku:"CAB-001", name:"USB-A to USB-B Cable 1.8m",                cat:"Cables & Connectors", rp:280,  wp:190,  sp:null, sup:sup2.id, b1:200, b2:100, thr:30 },
    { sku:"CAB-002", name:"USB-A to Micro-USB Cable 1.8m",            cat:"Cables & Connectors", rp:250,  wp:170,  sp:null, sup:sup2.id, b1:300, b2:150, thr:45 },
    { sku:"CAB-003", name:"USB-C to USB-C Cable 2m",                  cat:"Cables & Connectors", rp:380,  wp:270,  sp:250,  sup:sup2.id, b1:250, b2:125, thr:38 },
    { sku:"CAB-004", name:"HDMI Cable 2m High Speed",                 cat:"Cables & Connectors", rp:480,  wp:340,  sp:null, sup:sup2.id, b1:150, b2:75,  thr:22 },
    { sku:"CAB-005", name:"Cat6 Ethernet Patch Cable 3m",             cat:"Cables & Connectors", rp:320,  wp:220,  sp:null, sup:sup2.id, b1:200, b2:100, thr:30 },
    { sku:"CAB-006", name:"Cat6 Ethernet Patch Cable 10m",            cat:"Cables & Connectors", rp:680,  wp:490,  sp:null, sup:sup2.id, b1:120, b2:60,  thr:18 },
    { sku:"CAB-007", name:"3.5mm Stereo Audio Cable 1.5m",            cat:"Cables & Connectors", rp:180,  wp:120,  sp:null, sup:sup2.id, b1:180, b2:90,  thr:28 },
    { sku:"CAB-008", name:"JST-PH 2-Pin Connector Pair Pack (10pcs)", cat:"Cables & Connectors", rp:380,  wp:270,  sp:null, sup:sup2.id, b1:150, b2:75,  thr:22 },
    { sku:"CAB-009", name:"DuPont Jumper Wire Set 40pcs M-M/M-F/F-F", cat:"Cables & Connectors", rp:280,  wp:190,  sp:null, sup:sup2.id, b1:300, b2:150, thr:45 },
    { sku:"CAB-010", name:"Coaxial RG6 Cable 10m",                    cat:"Cables & Connectors", rp:580,  wp:420,  sp:null, sup:sup2.id, b1:100, b2:50,  thr:15 },
    // POWER SUPPLIES
    { sku:"PWR-001", name:"5V 2A USB Wall Adapter",                   cat:"Power Supplies",      rp:480,  wp:340,  sp:null, sup:sup4.id, b1:200, b2:100, thr:30 },
    { sku:"PWR-002", name:"12V 2A DC Power Adapter",                  cat:"Power Supplies",      rp:650,  wp:470,  sp:null, sup:sup4.id, b1:160, b2:80,  thr:25 },
    { sku:"PWR-003", name:"12V 5A Desktop Power Supply",              cat:"Power Supplies",      rp:1200, wp:880,  sp:840,  sup:sup4.id, b1:80,  b2:40,  thr:12 },
    { sku:"PWR-004", name:"24V 2A Regulated Power Adapter",           cat:"Power Supplies",      rp:750,  wp:540,  sp:null, sup:sup4.id, b1:100, b2:50,  thr:15 },
    { sku:"PWR-005", name:"AA Alkaline Battery Pack (8pcs)",          cat:"Power Supplies",      rp:320,  wp:220,  sp:null, sup:sup4.id, b1:500, b2:250, thr:80 },
    { sku:"PWR-006", name:"AAA Alkaline Battery Pack (8pcs)",         cat:"Power Supplies",      rp:280,  wp:190,  sp:null, sup:sup4.id, b1:400, b2:200, thr:60 },
    { sku:"PWR-007", name:"9V PP3 Alkaline Battery (each)",           cat:"Power Supplies",      rp:80,   wp:55,   sp:null, sup:sup4.id, b1:500, b2:250, thr:80 },
    { sku:"PWR-008", name:"18650 Li-Ion Cell 3000mAh",                cat:"Power Supplies",      rp:650,  wp:470,  sp:null, sup:sup4.id, b1:120, b2:60,  thr:18 },
    // LED & LIGHTING
    { sku:"LED-001", name:"LED Strip 12V RGB 5m Reel",                cat:"LED & Lighting",      rp:1200, wp:880,  sp:840,  sup:sup3.id, b1:80,  b2:40,  thr:12 },
    { sku:"LED-002", name:"LED Strip 12V Neutral White 5m (4000K)",   cat:"LED & Lighting",      rp:980,  wp:720,  sp:null, sup:sup3.id, b1:90,  b2:45,  thr:14 },
    { sku:"LED-003", name:"LED Strip 12V Warm White 5m (3000K)",      cat:"LED & Lighting",      rp:980,  wp:720,  sp:null, sup:sup3.id, b1:85,  b2:42,  thr:13 },
    { sku:"LED-004", name:"LED Recessed Downlight Panel 10W 4000K",   cat:"LED & Lighting",      rp:580,  wp:420,  sp:null, sup:sup3.id, b1:120, b2:60,  thr:18 },
    { sku:"LED-005", name:"LED Recessed Downlight Panel 10W 3000K",   cat:"LED & Lighting",      rp:580,  wp:420,  sp:null, sup:sup3.id, b1:110, b2:55,  thr:16 },
    { sku:"LED-006", name:"LED Bulb E27 9W 6500K Daylight",           cat:"LED & Lighting",      rp:280,  wp:190,  sp:null, sup:sup3.id, b1:400, b2:200, thr:60 },
    { sku:"LED-007", name:"LED Flood Light 30W 5000K Outdoor",        cat:"LED & Lighting",      rp:1800, wp:1320, sp:null, sup:sup3.id, b1:50,  b2:25,  thr:8  },
    { sku:"LED-008", name:"LED Constant Voltage Driver 60W 12V",      cat:"LED & Lighting",      rp:850,  wp:620,  sp:null, sup:sup3.id, b1:80,  b2:40,  thr:12 },
    { sku:"LED-009", name:"LED Constant Voltage Driver 100W 12V",     cat:"LED & Lighting",      rp:1200, wp:880,  sp:null, sup:sup3.id, b1:60,  b2:30,  thr:10 },
    // AUDIO & VISUAL
    { sku:"AVS-001", name:"Passive Piezo Buzzer Module 5V",           cat:"Audio & Visual",      rp:180,  wp:120,  sp:null, sup:sup3.id, b1:300, b2:150, thr:45 },
    { sku:"AVS-002", name:"Active Buzzer Module 5V",                  cat:"Audio & Visual",      rp:220,  wp:150,  sp:null, sup:sup3.id, b1:280, b2:140, thr:42 },
    { sku:"AVS-003", name:"0.96in OLED Display I2C Module (SSD1306)", cat:"Audio & Visual",      rp:580,  wp:420,  sp:390,  sup:sup3.id, b1:150, b2:75,  thr:22 },
    { sku:"AVS-004", name:"2.4in TFT LCD SPI Display Module",         cat:"Audio & Visual",      rp:980,  wp:720,  sp:null, sup:sup3.id, b1:80,  b2:40,  thr:12 },
    { sku:"AVS-005", name:"Electret Microphone Breakout Module",      cat:"Audio & Visual",      rp:280,  wp:190,  sp:null, sup:sup3.id, b1:200, b2:100, thr:30 },
    { sku:"AVS-006", name:"PAM8403 Class-D Audio Amplifier Module",   cat:"Audio & Visual",      rp:380,  wp:270,  sp:null, sup:sup3.id, b1:150, b2:75,  thr:22 },
    { sku:"AVS-007", name:"IR Remote Control Kit 38kHz",              cat:"Audio & Visual",      rp:320,  wp:220,  sp:null, sup:sup3.id, b1:200, b2:100, thr:30 },
    { sku:"AVS-008", name:"4-Digit 7-Segment Display Module",         cat:"Audio & Visual",      rp:450,  wp:320,  sp:null, sup:sup3.id, b1:150, b2:75,  thr:22 },
    // NETWORKING
    { sku:"NET-001", name:"ESP8266 NodeMCU WiFi Module",              cat:"Networking",          rp:350,  wp:250,  sp:null, sup:sup1.id, b1:200, b2:100, thr:30 },
    { sku:"NET-002", name:"ESP32 DevKit-C Development Board",         cat:"Networking",          rp:680,  wp:490,  sp:460,  sup:sup1.id, b1:150, b2:75,  thr:22 },
    { sku:"NET-003", name:"Bluetooth HC-05 Serial Module",            cat:"Networking",          rp:480,  wp:340,  sp:null, sup:sup1.id, b1:120, b2:60,  thr:18 },
    { sku:"NET-004", name:"LoRa SX1278 433MHz Module",                cat:"Networking",          rp:850,  wp:620,  sp:null, sup:sup1.id, b1:80,  b2:40,  thr:12 },
    { sku:"NET-005", name:"Raspberry Pi 4 Model B 4GB",               cat:"Networking",          rp:6800, wp:5200, sp:4900, sup:sup1.id, b1:25,  b2:12,  thr:4  },
    { sku:"NET-006", name:"8-Port Gigabit Unmanaged Network Switch",  cat:"Networking",          rp:2800, wp:2050, sp:null, sup:sup2.id, b1:35,  b2:18,  thr:5  },
    { sku:"NET-007", name:"RJ45 Cat6 Keystone Jack Pack (10pcs)",     cat:"Networking",          rp:380,  wp:270,  sp:null, sup:sup2.id, b1:150, b2:75,  thr:22 },
    { sku:"NET-008", name:"USB WiFi Adapter 300Mbps 2.4GHz",          cat:"Networking",          rp:850,  wp:620,  sp:null, sup:sup2.id, b1:100, b2:50,  thr:15 },
    // SWITCHES & RELAYS
    { sku:"SWR-001", name:"Tactile Push Button Pack (20pcs)",         cat:"Switches & Relays",   rp:180,  wp:120,  sp:null, sup:sup2.id, b1:400, b2:200, thr:60 },
    { sku:"SWR-002", name:"SPST Toggle Switch Pack (5pcs)",           cat:"Switches & Relays",   rp:280,  wp:190,  sp:null, sup:sup2.id, b1:250, b2:125, thr:38 },
    { sku:"SWR-003", name:"Rotary Encoder Module with Switch",        cat:"Switches & Relays",   rp:320,  wp:220,  sp:null, sup:sup2.id, b1:180, b2:90,  thr:28 },
    { sku:"SWR-004", name:"5V Single-Channel Relay Module",           cat:"Switches & Relays",   rp:350,  wp:250,  sp:null, sup:sup2.id, b1:200, b2:100, thr:30 },
    { sku:"SWR-005", name:"5V 4-Channel Relay Module",                cat:"Switches & Relays",   rp:850,  wp:620,  sp:null, sup:sup2.id, b1:100, b2:50,  thr:15 },
    { sku:"SWR-006", name:"Micro Limit Switch Pack (5pcs)",           cat:"Switches & Relays",   rp:380,  wp:270,  sp:null, sup:sup2.id, b1:180, b2:90,  thr:28 },
    { sku:"SWR-007", name:"Slide Switch Pack (10pcs)",                cat:"Switches & Relays",   rp:220,  wp:150,  sp:null, sup:sup2.id, b1:300, b2:150, thr:45 },
    { sku:"SWR-008", name:"DIN Rail Miniature MCB 16A Single Pole",   cat:"Switches & Relays",   rp:1800, wp:1320, sp:null, sup:sup2.id, b1:60,  b2:30,  thr:10 },
    // TOOLS & ACCESSORIES
    { sku:"TOL-001", name:"Soldering Station 60W Temperature Adj.",   cat:"Tools & Accessories", rp:1800, wp:1320, sp:null, sup:sup4.id, b1:40,  b2:20,  thr:6  },
    { sku:"TOL-002", name:"Solder Wire 60/40 0.7mm Rosin Core 100g",  cat:"Tools & Accessories", rp:680,  wp:490,  sp:null, sup:sup4.id, b1:100, b2:50,  thr:15 },
    { sku:"TOL-003", name:"No-Clean Flux Paste 50g",                  cat:"Tools & Accessories", rp:450,  wp:320,  sp:null, sup:sup4.id, b1:120, b2:60,  thr:18 },
    { sku:"TOL-004", name:"Heat Shrink Tubing Assortment Kit",        cat:"Tools & Accessories", rp:350,  wp:250,  sp:null, sup:sup4.id, b1:200, b2:100, thr:30 },
    { sku:"TOL-005", name:"Solderless Breadboard 830-Point",          cat:"Tools & Accessories", rp:580,  wp:420,  sp:null, sup:sup4.id, b1:150, b2:75,  thr:22 },
    { sku:"TOL-006", name:"Digital Multimeter Auto-ranging True RMS", cat:"Tools & Accessories", rp:1800, wp:1320, sp:1250, sup:sup4.id, b1:50,  b2:25,  thr:8  },
    { sku:"TOL-007", name:"Wire Stripper and Crimping Tool",          cat:"Tools & Accessories", rp:850,  wp:620,  sp:null, sup:sup4.id, b1:60,  b2:30,  thr:10 },
    { sku:"TOL-008", name:"Helping Hands Soldering Stand",            cat:"Tools & Accessories", rp:680,  wp:490,  sp:null, sup:sup4.id, b1:70,  b2:35,  thr:10 },
    { sku:"TOL-009", name:"Antistatic ESD Wrist Strap",               cat:"Tools & Accessories", rp:280,  wp:190,  sp:null, sup:sup4.id, b1:200, b2:100, thr:30 },
    { sku:"TOL-010", name:"PCB Degreaser / Flux Remover Spray 400ml", cat:"Tools & Accessories", rp:580,  wp:420,  sp:null, sup:sup4.id, b1:100, b2:50,  thr:15 },
    { sku:"TOL-011", name:"Cable Ties 200mm Black (100pcs)",          cat:"Tools & Accessories", rp:280,  wp:190,  sp:null, sup:sup4.id, b1:300, b2:150, thr:45 },
    { sku:"TOL-012", name:"Electrical Insulation Tape 19mm (Black)",  cat:"Tools & Accessories", rp:120,  wp:80,   sp:null, sup:sup4.id, b1:400, b2:200, thr:60 },
  ];

  const iMap: Record<string, { id: string; rp: number; wp: number }> = {};
  for (const s of itemSeeds) {
    const item = await prisma.item.upsert({
      where:  { sku_organizationId: { sku: s.sku, organizationId: org.id } },
      update: { retailPrice: s.rp, wholesalePrice: s.wp, specialPrice: s.sp },
      create: {
        sku: s.sku,
        name: s.name,
        categoryId: catMap[s.cat],
        retailPrice: s.rp,
        wholesalePrice: s.wp,
        specialPrice: s.sp,
        supplierId: s.sup,
        organizationId: org.id,
      },
    });
    await prisma.branchStock.upsert({
      where:  { itemId_branchId: { itemId: item.id, branchId: b1.id } },
      update: { stockQty: s.b1, lowStockThreshold: s.thr },
      create: { itemId: item.id, branchId: b1.id, stockQty: s.b1, lowStockThreshold: s.thr },
    });
    await prisma.branchStock.upsert({
      where:  { itemId_branchId: { itemId: item.id, branchId: b2.id } },
      update: { stockQty: s.b2, lowStockThreshold: s.thr },
      create: { itemId: item.id, branchId: b2.id, stockQty: s.b2, lowStockThreshold: s.thr },
    });
    iMap[s.sku] = { id: item.id, rp: s.rp, wp: s.wp };
  }
  console.log(`✓ ${itemSeeds.length} items + branch stocks`);

  // ── Customers ─────────────────────────────────────────────────────────────
  type CS = { id: string; name: string; phone: string; address: string; br: string };
  const custSpecs: CS[] = [
    { id:"seed-c-001", name:"Oliver Thompson",   phone:"+44 7700 100001", address:"12 Baker Street, London W1U 3BG",       br:b1.id },
    { id:"seed-c-002", name:"Charlotte Davies",  phone:"+44 7700 100002", address:"5 Kings Road, London SW3 4NT",          br:b1.id },
    { id:"seed-c-003", name:"Harry Evans",       phone:"+44 7700 100003", address:"23 High Street, Reading RG1 1LG",       br:b1.id },
    { id:"seed-c-004", name:"Amelia Wilson",     phone:"+44 7700 100004", address:"78 Broad Lane, Birmingham B1 2JP",      br:b1.id },
    { id:"seed-c-005", name:"George Taylor",     phone:"+44 7700 100005", address:"14 Church Street, Oxford OX1 1DL",      br:b1.id },
    { id:"seed-c-006", name:"Jessica Brown",     phone:"+44 7700 100006", address:"9 Market Place, Leeds LS1 6DU",         br:b1.id },
    { id:"seed-c-007", name:"William Martin",    phone:"+44 7700 100007", address:"31 Victoria Road, London N4 3SQ",       br:b1.id },
    { id:"seed-c-008", name:"Sophie Anderson",   phone:"+44 7700 100008", address:"7 Castle Street, Edinburgh EH1 2DP",    br:b1.id },
    { id:"seed-c-009", name:"Jack Thomas",       phone:"+44 7700 100009", address:"19 Mill Lane, Manchester M14 5RX",      br:b1.id },
    { id:"seed-c-010", name:"Emily Jackson",     phone:"+44 7700 100010", address:"44 Park Avenue, Bristol BS1 4RN",       br:b1.id },
    { id:"seed-c-011", name:"James White",       phone:"+44 7700 100011", address:"2 Station Road, Sheffield S1 2GG",      br:b1.id },
    { id:"seed-c-012", name:"Lily Harris",       phone:"+44 7700 100012", address:"67 Grove Street, Liverpool L1 5DL",     br:b1.id },
    { id:"seed-c-013", name:"Benjamin Clark",    phone:"+44 7700 100013", address:"11 Bridge Road, Cardiff CF10 2EF",      br:b1.id },
    { id:"seed-c-014", name:"Grace Lewis",       phone:"+44 7711 100001", address:"5 Commercial Street, London E1 6LT",    br:b2.id },
    { id:"seed-c-015", name:"Ethan Robinson",    phone:"+44 7711 100002", address:"88 Deansgate, Manchester M3 2ER",       br:b2.id },
    { id:"seed-c-016", name:"Isabella Walker",   phone:"+44 7711 100003", address:"33 Princes Street, Edinburgh EH2 2BY",  br:b2.id },
    { id:"seed-c-017", name:"Mason Hall",        phone:"+44 7711 100004", address:"16 Bold Street, Liverpool L1 4DS",      br:b2.id },
    { id:"seed-c-018", name:"Ava Allen",         phone:"+44 7711 100005", address:"9 Regent Street, London W1B 4EA",       br:b2.id },
    { id:"seed-c-019", name:"Lucas Young",       phone:"+44 7711 100006", address:"21 Corn Street, Bristol BS1 1HT",       br:b2.id },
    { id:"seed-c-020", name:"Mia Hernandez",     phone:"+44 7711 100007", address:"12 Grey Street, Newcastle NE1 6EE",     br:b2.id },
    { id:"seed-c-021", name:"Elijah Scott",      phone:"+44 7711 100008", address:"4 Leopold Square, Sheffield S1 2JG",    br:b2.id },
    { id:"seed-c-022", name:"Harper King",       phone:"+44 7711 100009", address:"77 Castle Street, Manchester M3 4LZ",   br:b2.id },
    { id:"seed-c-023", name:"Evelyn Wright",     phone:"+44 7711 100010", address:"3 Exchange Street, Norwich NR2 1AX",    br:b2.id },
  ];
  for (const c of custSpecs)
    await prisma.customer.upsert({
      where:  { id: c.id },
      update: {},
      create: { id: c.id, name: c.name, phone: c.phone, address: c.address, branchId: c.br, organizationId: org.id, creditBalance: 0 },
    });
  console.log(`✓ ${custSpecs.length} customers`);

  // ── Sales + StockLogs ─────────────────────────────────────────────────────
  const B1 = b1.id, B2 = b2.id;
  const M1 = mgr1.id, M2 = mgr2.id;
  const C1 = cs1.id, C2 = cs2.id, C3 = cs3.id, C4 = cs4.id;
  const C5 = cs5.id, C6 = cs6.id, C7 = cs7.id;

  const existSales = await prisma.sale.count({
    where: { organizationId: org.id },
  });

  if (existSales >= 10) {
    console.log(`✓ Sales already seeded (${existSales}), skipping`);
  } else {
    type LS = { sku: string; qty: number };
    type SS = {
      br: string; emp: string; cust: string | null;
      type: "RETAIL" | "WHOLESALE"; pay: "PAID" | "CREDIT";
      disc: number; date: Date; lines: LS[];
    };

    const p = (sku: string, type: "RETAIL" | "WHOLESALE") =>
      type === "RETAIL" ? iMap[sku].rp : iMap[sku].wp;
    const calc = (lines: LS[], type: "RETAIL" | "WHOLESALE", disc: number) => {
      const ll = lines.map(l => ({
        itemId: iMap[l.sku].id,
        qty: l.qty,
        unitPrice: p(l.sku, type),
        subtotal: p(l.sku, type) * l.qty,
      }));
      const total = ll.reduce((s, l) => s + l.subtotal, 0) - disc;
      return { ll, total, taxAmt: extractTax(total) };
    }

    const specs: SS[] = [
      // ── APRIL 2026 ──────────────────────────────────────────────────────────
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-04",9,20),  lines:[{sku:"CMP-001",qty:3},{sku:"PWR-007",qty:6}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-04",11,0),  lines:[{sku:"CAB-001",qty:2},{sku:"CAB-002",qty:4}] },
      { br:B1, emp:C2, cust:"seed-c-004", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-04-07",10,0),  lines:[{sku:"NET-001",qty:2},{sku:"CMP-003",qty:3}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-07",14,30), lines:[{sku:"PWR-005",qty:6},{sku:"PWR-006",qty:4}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-08",9,45),  lines:[{sku:"LED-006",qty:8},{sku:"LED-004",qty:3}] },
      { br:B2, emp:C5, cust:"seed-c-017", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-04-08",11,20), lines:[{sku:"CAB-003",qty:2},{sku:"CAB-004",qty:2}] },
      // Big wholesale: Jessica Brown (electronics retailer)
      { br:B1, emp:M1, cust:"seed-c-006", type:"WHOLESALE", pay:"CREDIT", disc:2000, date:d("2026-04-10",9,0),
        lines:[{sku:"NET-005",qty:5},{sku:"NET-006",qty:5},{sku:"LED-001",qty:15},{sku:"LED-004",qty:20},{sku:"CAB-006",qty:25},{sku:"PWR-003",qty:12},{sku:"AVS-004",qty:5},{sku:"LED-007",qty:5}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-10",13,0),  lines:[{sku:"CMP-004",qty:2},{sku:"PWR-007",qty:4}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:50,   date:d("2026-04-11",10,30), lines:[{sku:"TOL-011",qty:5},{sku:"TOL-012",qty:8}] },
      { br:B2, emp:C6, cust:"seed-c-021", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-04-11",11,0),  lines:[{sku:"NET-001",qty:1},{sku:"CMP-010",qty:2}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-14",9,0),   lines:[{sku:"CAB-009",qty:3},{sku:"SWR-001",qty:5}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-14",14,0),  lines:[{sku:"CAB-002",qty:5},{sku:"PWR-007",qty:8}] },
      { br:B1, emp:M1, cust:"seed-c-008", type:"WHOLESALE", pay:"CREDIT", disc:0,    date:d("2026-04-15",9,0),   lines:[{sku:"SWR-004",qty:30},{sku:"SWR-007",qty:50},{sku:"CAB-005",qty:40},{sku:"CAB-001",qty:30}] },
      { br:B2, emp:M2, cust:"seed-c-015", type:"WHOLESALE", pay:"CREDIT", disc:500,  date:d("2026-04-15",10,0),  lines:[{sku:"CMP-007",qty:20},{sku:"CMP-008",qty:20},{sku:"PWR-005",qty:60}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-15",15,30), lines:[{sku:"CMP-009",qty:3},{sku:"CMP-012",qty:4}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-16",10,0),  lines:[{sku:"CAB-008",qty:4},{sku:"CAB-010",qty:2},{sku:"CAB-009",qty:5}] },
      { br:B2, emp:C7, cust:"seed-c-022", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-04-16",11,30), lines:[{sku:"NET-003",qty:1},{sku:"AVS-003",qty:2}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-18",9,15),  lines:[{sku:"TOL-002",qty:3},{sku:"TOL-003",qty:2}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-18",13,0),  lines:[{sku:"SWR-003",qty:2},{sku:"SWR-006",qty:3}] },
      { br:B1, emp:C4, cust:"seed-c-003", type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-21",10,0),  lines:[{sku:"LED-001",qty:4},{sku:"LED-008",qty:2}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-04-21",14,30), lines:[{sku:"AVS-003",qty:2},{sku:"AVS-004",qty:1}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-22",9,30),  lines:[{sku:"PWR-007",qty:30},{sku:"CMP-004",qty:8}] },
      { br:B2, emp:M2, cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:0,    date:d("2026-04-22",10,0),  lines:[{sku:"CAB-005",qty:30},{sku:"CAB-006",qty:20},{sku:"CAB-002",qty:50}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-23",11,0),  lines:[{sku:"TOL-004",qty:4},{sku:"TOL-009",qty:5}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-23",14,0),  lines:[{sku:"SWR-008",qty:1},{sku:"LED-007",qty:2}] },
      // Big wholesale: Charlotte Davies (large electronics distributor)
      { br:B1, emp:M1, cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:1500, date:d("2026-04-25",9,0),
        lines:[{sku:"NET-005",qty:8},{sku:"NET-006",qty:8},{sku:"LED-001",qty:20},{sku:"LED-007",qty:8},{sku:"LED-009",qty:8},{sku:"LED-004",qty:20},{sku:"CAB-006",qty:25},{sku:"PWR-003",qty:12},{sku:"TOL-001",qty:6},{sku:"TOL-006",qty:6},{sku:"SWR-008",qty:5},{sku:"NET-004",qty:8},{sku:"CAB-005",qty:30},{sku:"NET-002",qty:10}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-25",13,0),  lines:[{sku:"PWR-005",qty:8},{sku:"PWR-006",qty:6}] },
      { br:B1, emp:C3, cust:"seed-c-009", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-04-26",10,0),  lines:[{sku:"NET-002",qty:2},{sku:"NET-003",qty:1}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-26",14,0),  lines:[{sku:"LED-002",qty:3},{sku:"LED-003",qty:3}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-28",9,30),  lines:[{sku:"TOL-005",qty:2},{sku:"TOL-008",qty:1}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:50,   date:d("2026-04-28",11,30), lines:[{sku:"AVS-007",qty:2},{sku:"SWR-002",qty:3}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-29",10,0),  lines:[{sku:"CMP-010",qty:2},{sku:"CMP-003",qty:3}] },
      { br:B2, emp:C5, cust:"seed-c-020", type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-29",13,30), lines:[{sku:"TOL-010",qty:3},{sku:"TOL-003",qty:4}] },

      // ── MAY 2026 ────────────────────────────────────────────────────────────
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-02",9,0),   lines:[{sku:"LED-004",qty:5},{sku:"LED-005",qty:5},{sku:"LED-006",qty:10}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-02",14,0),  lines:[{sku:"CMP-005",qty:4},{sku:"PWR-007",qty:8}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-05",9,30),  lines:[{sku:"AVS-001",qty:5},{sku:"AVS-002",qty:5}] },
      { br:B1, emp:M1, cust:"seed-c-011", type:"WHOLESALE", pay:"CREDIT", disc:500,  date:d("2026-05-05",10,0),  lines:[{sku:"CAB-001",qty:50},{sku:"CAB-002",qty:60},{sku:"CAB-005",qty:50},{sku:"CAB-006",qty:30}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-05",14,0),  lines:[{sku:"LED-006",qty:15},{sku:"LED-004",qty:5}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-06",10,30), lines:[{sku:"NET-001",qty:2},{sku:"NET-003",qty:2}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-05-06",14,0),  lines:[{sku:"TOL-001",qty:1},{sku:"TOL-006",qty:1}] },
      { br:B1, emp:C1, cust:"seed-c-001", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-05-07",9,0),   lines:[{sku:"PWR-007",qty:40},{sku:"CMP-004",qty:10}] },
      { br:B2, emp:M2, cust:"seed-c-016", type:"WHOLESALE", pay:"CREDIT", disc:0,    date:d("2026-05-07",10,30), lines:[{sku:"CAB-005",qty:40},{sku:"CAB-006",qty:30},{sku:"CAB-009",qty:80}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-07",15,0),  lines:[{sku:"SWR-004",qty:3},{sku:"SWR-005",qty:2}] },
      // Big wholesale: Ethan Robinson (networking reseller)
      { br:B2, emp:M2, cust:"seed-c-015", type:"WHOLESALE", pay:"CREDIT", disc:1000, date:d("2026-05-08",9,0),
        lines:[{sku:"CMP-001",qty:100},{sku:"CMP-006",qty:80},{sku:"CAB-002",qty:80},{sku:"LED-006",qty:100},{sku:"PWR-005",qty:80},{sku:"CAB-005",qty:60},{sku:"PWR-001",qty:50},{sku:"SWR-001",qty:80},{sku:"SWR-007",qty:60},{sku:"CMP-007",qty:60},{sku:"TOL-011",qty:50},{sku:"TOL-012",qty:80}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-08",11,30), lines:[{sku:"PWR-005",qty:5},{sku:"PWR-006",qty:5}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-09",9,30),  lines:[{sku:"CMP-003",qty:3},{sku:"CMP-010",qty:2}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-09",13,0),  lines:[{sku:"CAB-004",qty:2},{sku:"AVS-008",qty:2}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-12",9,15),  lines:[{sku:"LED-001",qty:5},{sku:"LED-008",qty:3}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-12",10,30), lines:[{sku:"TOL-010",qty:2},{sku:"TOL-002",qty:2}] },
      { br:B1, emp:M1, cust:"seed-c-013", type:"WHOLESALE", pay:"CREDIT", disc:300,  date:d("2026-05-12",11,0),  lines:[{sku:"CMP-009",qty:15},{sku:"CMP-005",qty:20},{sku:"SWR-004",qty:15}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-13",10,0),  lines:[{sku:"NET-002",qty:1},{sku:"NET-001",qty:2}] },
      { br:B2, emp:C5, cust:"seed-c-023", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-05-13",14,0),  lines:[{sku:"NET-006",qty:1},{sku:"CAB-006",qty:4}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-14",9,30),  lines:[{sku:"PWR-002",qty:5},{sku:"PWR-004",qty:3}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-14",13,30), lines:[{sku:"LED-007",qty:2},{sku:"LED-009",qty:2}] },
      // Big wholesale: Lucas Young (LED lighting contractor)
      { br:B2, emp:M2, cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:3000, date:d("2026-05-15",9,0),
        lines:[{sku:"NET-005",qty:5},{sku:"NET-006",qty:10},{sku:"LED-001",qty:20},{sku:"LED-007",qty:8},{sku:"LED-008",qty:10},{sku:"CAB-006",qty:30},{sku:"PWR-003",qty:15},{sku:"SWR-008",qty:8}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-15",11,0),  lines:[{sku:"CMP-011",qty:5},{sku:"PWR-007",qty:6}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-16",9,0),   lines:[{sku:"CAB-008",qty:5},{sku:"CAB-010",qty:3}] },
      { br:B2, emp:C5, cust:"seed-c-022", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-05-16",11,30), lines:[{sku:"AVS-003",qty:2},{sku:"AVS-004",qty:2}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-05-16",15,0),  lines:[{sku:"TOL-004",qty:5},{sku:"TOL-009",qty:6}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-19",10,0),  lines:[{sku:"SWR-003",qty:3},{sku:"SWR-006",qty:4}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-19",13,0),  lines:[{sku:"LED-002",qty:3},{sku:"LED-003",qty:3}] },
      { br:B1, emp:M1, cust:"seed-c-006", type:"WHOLESALE", pay:"PAID",   disc:0,    date:d("2026-05-20",9,30),  lines:[{sku:"NET-006",qty:3},{sku:"NET-007",qty:8},{sku:"CAB-006",qty:10}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-20",14,0),  lines:[{sku:"CMP-012",qty:4},{sku:"CMP-008",qty:6}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-21",9,15),  lines:[{sku:"AVS-001",qty:3},{sku:"AVS-002",qty:3}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-21",11,0),  lines:[{sku:"PWR-006",qty:8},{sku:"PWR-007",qty:10}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:50,   date:d("2026-05-21",14,30), lines:[{sku:"TOL-005",qty:2},{sku:"AVS-003",qty:1}] },
      // Big wholesale: Jessica Brown again
      { br:B1, emp:M1, cust:"seed-c-006", type:"WHOLESALE", pay:"CREDIT", disc:1150, date:d("2026-05-22",9,0),
        lines:[{sku:"NET-005",qty:6},{sku:"NET-006",qty:6},{sku:"LED-001",qty:25},{sku:"CAB-002",qty:60},{sku:"PWR-005",qty:60},{sku:"CAB-005",qty:40},{sku:"CMP-003",qty:30}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-22",13,30), lines:[{sku:"TOL-011",qty:4},{sku:"CMP-011",qty:5}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-23",9,30),  lines:[{sku:"LED-006",qty:20},{sku:"LED-004",qty:6}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-23",11,0),  lines:[{sku:"SWR-002",qty:4},{sku:"SWR-001",qty:6}] },
      { br:B1, emp:C3, cust:"seed-c-005", type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-23",15,30), lines:[{sku:"PWR-007",qty:20},{sku:"PWR-005",qty:8}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-26",10,0),  lines:[{sku:"CMP-010",qty:2},{sku:"NET-004",qty:2}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-26",13,30), lines:[{sku:"CAB-007",qty:6},{sku:"CAB-010",qty:4}] },
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-27",9,0),   lines:[{sku:"TOL-003",qty:5},{sku:"TOL-002",qty:3}] },
      { br:B2, emp:M2, cust:"seed-c-021", type:"WHOLESALE", pay:"CREDIT", disc:0,    date:d("2026-05-27",10,30), lines:[{sku:"CAB-005",qty:30},{sku:"CAB-002",qty:40},{sku:"PWR-005",qty:50}] },
      // Big wholesale: Charlotte Davies again
      { br:B1, emp:M1, cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:1500, date:d("2026-05-28",9,0),
        lines:[{sku:"NET-007",qty:30},{sku:"CMP-001",qty:150},{sku:"CAB-002",qty:100},{sku:"LED-006",qty:150},{sku:"SWR-001",qty:100},{sku:"CMP-006",qty:120},{sku:"PWR-005",qty:100},{sku:"CAB-005",qty:80},{sku:"TOL-012",qty:120},{sku:"SWR-007",qty:100}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-28",14,0),  lines:[{sku:"CMP-004",qty:3},{sku:"CMP-005",qty:3}] },
      { br:B1, emp:C2, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-29",10,0),  lines:[{sku:"TOL-007",qty:1},{sku:"TOL-008",qty:1}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-29",11,30), lines:[{sku:"LED-004",qty:4},{sku:"LED-005",qty:4}] },
      { br:B1, emp:C3, cust:"seed-c-007", type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-29",14,0),  lines:[{sku:"NET-002",qty:1},{sku:"NET-001",qty:2}] },
      { br:B1, emp:C4, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-30",9,30),  lines:[{sku:"TOL-010",qty:4},{sku:"TOL-011",qty:5}] },
      { br:B2, emp:C5, cust:null,         type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-05-30",13,0),  lines:[{sku:"AVS-003",qty:1},{sku:"PWR-007",qty:8}] },

      // ── JUNE 2026 ────────────────────────────────────────────────────────────
      { br:B1, emp:C1, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-02",9,15),  lines:[{sku:"CAB-005",qty:4},{sku:"CAB-009",qty:8}] },
      { br:B2, emp:C7, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-02",10,30), lines:[{sku:"SWR-004",qty:5},{sku:"SWR-007",qty:8}] },
      { br:B1, emp:C2, cust:"seed-c-010", type:"RETAIL",    pay:"CREDIT", disc:0,    date:d("2026-06-02",14,0),  lines:[{sku:"NET-002",qty:1},{sku:"CMP-010",qty:1}] },
      { br:B2, emp:C6, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-03",9,30),  lines:[{sku:"PWR-005",qty:6},{sku:"PWR-007",qty:6}] },
      { br:B1, emp:C3, cust:null,         type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-03",11,0),  lines:[{sku:"CMP-001",qty:3},{sku:"CMP-006",qty:3},{sku:"TOL-004",qty:2}] },
      { br:B2, emp:M2, cust:"seed-c-014", type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-03",14,0),  lines:[{sku:"LED-006",qty:10},{sku:"LED-004",qty:5},{sku:"LED-001",qty:2}] },
    ];

    specs.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const spec of specs) {
      const rcpNum = rcp(spec.date);
      const { ll, total, taxAmt } = calc(spec.lines, spec.type, spec.disc);

      const sale = await prisma.sale.upsert({
        where:  { receiptNumber_organizationId: { receiptNumber: rcpNum, organizationId: org.id } },
        update: {},
        create: {
          receiptNumber: rcpNum,
          saleType: spec.type,
          paymentStatus: spec.pay,
          discountAmount: spec.disc,
          taxAmount: taxAmt,
          totalAmount: total,
          isVoid: false,
          customerId: spec.cust,
          employeeId: spec.emp,
          branchId: spec.br,
          organizationId: org.id,
          createdAt: spec.date,
          items: {
            create: ll.map(l => ({
              itemId: l.itemId,
              quantity: l.qty,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal,
            })),
          },
        },
      });

      // StockLog for each sold line item (AI training signal: demand history)
      for (const l of ll) {
        await prisma.stockLog.create({
          data: {
            itemId: l.itemId,
            branchId: spec.br,
            organizationId: org.id,
            quantity: -l.qty,
            reason: StockMovementReason.SALE,
            referenceId: sale.id,
            recordedById: spec.emp,
            createdAt: spec.date,
          },
        });
      }
    }
    console.log(`✓ ${specs.length} sales + stock logs`);

    // ── Credit Payments ──────────────────────────────────────────────────────
    const cpSpecs = [
      { id:"seed-cp-01", cust:"seed-c-006", amt:50000, by:M1, date:d("2026-05-05",10,0),  notes:"BACS transfer - partial" },
      { id:"seed-cp-02", cust:"seed-c-006", amt:30000, by:M1, date:d("2026-05-20",9,0),   notes:"Bank transfer" },
      { id:"seed-cp-03", cust:"seed-c-002", amt:60000, by:M1, date:d("2026-05-10",10,0),  notes:"Bank transfer" },
      { id:"seed-cp-04", cust:"seed-c-002", amt:40000, by:C1, date:d("2026-05-26",9,30),  notes:"Cash settlement" },
      { id:"seed-cp-05", cust:"seed-c-015", amt:40000, by:M2, date:d("2026-05-20",9,0),   notes:"CHAPS payment" },
      { id:"seed-cp-06", cust:"seed-c-019", amt:50000, by:M2, date:d("2026-05-28",10,0),  notes:"Cheque payment" },
      { id:"seed-cp-07", cust:"seed-c-008", amt:8000,  by:C1, date:d("2026-05-01",10,0),  notes:"Cash" },
      { id:"seed-cp-08", cust:"seed-c-004", amt:3500,  by:C2, date:d("2026-04-20",11,0),  notes:"Card payment" },
      { id:"seed-cp-09", cust:"seed-c-011", amt:12000, by:M1, date:d("2026-05-15",9,0),   notes:"Cash" },
      { id:"seed-cp-10", cust:"seed-c-021", amt:5000,  by:M2, date:d("2026-06-01",10,0),  notes:"Bank transfer" },
      { id:"seed-cp-11", cust:"seed-c-017", amt:2500,  by:C5, date:d("2026-04-25",11,0),  notes:"Cash" },
      { id:"seed-cp-12", cust:"seed-c-016", amt:6000,  by:C6, date:d("2026-05-19",10,0),  notes:"BACS partial" },
      { id:"seed-cp-13", cust:"seed-c-013", amt:4000,  by:C2, date:d("2026-05-18",9,0),   notes:"Cash" },
      { id:"seed-cp-14", cust:"seed-c-001", amt:1500,  by:C1, date:d("2026-05-12",10,0),  notes:"Card payment" },
      { id:"seed-cp-15", cust:"seed-c-022", amt:2000,  by:C7, date:d("2026-05-20",14,0),  notes:"Cash" },
    ];
    for (const cp of cpSpecs)
      await prisma.creditPayment.upsert({
        where:  { id: cp.id },
        update: {},
        create: { id: cp.id, customerId: cp.cust, amount: cp.amt, notes: cp.notes, recordedById: cp.by, createdAt: cp.date },
      });
    console.log(`✓ ${cpSpecs.length} credit payments`);

    // ── Recalculate credit balances ──────────────────────────────────────────
    for (const cust of custSpecs) {
      const owed = specs.filter(s => s.cust === cust.id && s.pay === "CREDIT")
        .reduce((sum, s) => sum + calc(s.lines, s.type, s.disc).total, 0);
      const paid = cpSpecs.filter(p => p.cust === cust.id)
        .reduce((sum, p) => sum + p.amt, 0);
      const bal = Math.max(0, owed - paid);
      if (bal > 0)
        await prisma.customer.update({ where: { id: cust.id }, data: { creditBalance: bal } });
    }
    console.log("✓ Credit balances updated");
  }

  // ── Purchase Orders ───────────────────────────────────────────────────────
  const existPOs = await prisma.purchaseOrder.count({
    where: { id: { startsWith: "seed-po-" } },
  });

  if (existPOs > 0) {
    console.log(`✓ Purchase orders already seeded (${existPOs}), skipping`);
  } else {
    type POS = { id: string; sup: string; sku: string; qty: number; cost: number; by: string; br: string; date: Date };
    const poSpecs: POS[] = [
      { id:"seed-po-01", sup:sup1.id, sku:"CMP-001", qty:1000, cost:90,   by:M1, br:B1, date:d("2026-03-01",10,0) },
      { id:"seed-po-02", sup:sup1.id, sku:"CMP-003", qty:500,  cost:190,  by:M1, br:B1, date:d("2026-03-01",10,0) },
      { id:"seed-po-03", sup:sup1.id, sku:"CMP-010", qty:200,  cost:390,  by:M1, br:B1, date:d("2026-03-05",9,0)  },
      { id:"seed-po-04", sup:sup1.id, sku:"NET-002",  qty:100,  cost:330,  by:M2, br:B2, date:d("2026-03-08",10,0) },
      { id:"seed-po-05", sup:sup2.id, sku:"CAB-002",  qty:500,  cost:90,   by:M1, br:B1, date:d("2026-03-12",9,0)  },
      { id:"seed-po-06", sup:sup2.id, sku:"CAB-005",  qty:400,  cost:130,  by:M2, br:B2, date:d("2026-03-12",9,0)  },
      { id:"seed-po-07", sup:sup3.id, sku:"LED-006",  qty:800,  cost:80,   by:M1, br:B1, date:d("2026-03-15",10,0) },
      { id:"seed-po-08", sup:sup3.id, sku:"LED-001",  qty:150,  cost:550,  by:M2, br:B2, date:d("2026-03-15",10,0) },
      { id:"seed-po-09", sup:sup4.id, sku:"PWR-005",  qty:600,  cost:110,  by:M1, br:B1, date:d("2026-03-20",9,0)  },
      { id:"seed-po-10", sup:sup4.id, sku:"PWR-001",  qty:400,  cost:180,  by:M2, br:B2, date:d("2026-03-20",9,0)  },
      { id:"seed-po-11", sup:sup1.id, sku:"CMP-006",  qty:800,  cost:70,   by:M1, br:B1, date:d("2026-04-01",10,0) },
      { id:"seed-po-12", sup:sup2.id, sku:"NET-006",  qty:30,   cost:1400, by:M1, br:B1, date:d("2026-04-05",9,0)  },
      { id:"seed-po-13", sup:sup1.id, sku:"NET-005",  qty:20,   cost:4200, by:M2, br:B2, date:d("2026-04-10",10,0) },
      { id:"seed-po-14", sup:sup4.id, sku:"TOL-011",  qty:300,  cost:100,  by:M1, br:B1, date:d("2026-04-15",9,0)  },
      { id:"seed-po-15", sup:sup1.id, sku:"NET-001",  qty:300,  cost:140,  by:M1, br:B1, date:d("2026-04-20",10,0) },
      { id:"seed-po-16", sup:sup3.id, sku:"LED-007",  qty:50,   cost:900,  by:M2, br:B2, date:d("2026-04-25",9,0)  },
      { id:"seed-po-17", sup:sup3.id, sku:"LED-004",  qty:200,  cost:240,  by:M2, br:B2, date:d("2026-05-01",10,0) },
      { id:"seed-po-18", sup:sup1.id, sku:"CMP-007",  qty:500,  cost:90,   by:M1, br:B1, date:d("2026-05-10",9,0)  },
      { id:"seed-po-19", sup:sup4.id, sku:"PWR-006",  qty:500,  cost:90,   by:M2, br:B2, date:d("2026-05-15",10,0) },
      { id:"seed-po-20", sup:sup2.id, sku:"CAB-002",  qty:400,  cost:90,   by:M1, br:B1, date:d("2026-05-20",9,0)  },
    ];

    for (const po of poSpecs) {
      const createdPO = await prisma.purchaseOrder.create({
        data: {
          id: po.id,
          poNumber: poNum(po.date),
          supplierId: po.sup,
          status: PurchaseOrderStatus.RECEIVED,
          organizationId: org.id,
          branchId: po.br,
          createdById: po.by,
          deliveredAt: po.date,
          createdAt: po.date,
          items: {
            create: [{
              itemId: iMap[po.sku].id,
              quantity: po.qty,
              costPrice: po.cost,
              receivedQty: po.qty,
            }],
          },
        },
      });

      // StockLog for this PO receipt (AI training signal: replenishment history)
      await prisma.stockLog.create({
        data: {
          itemId: iMap[po.sku].id,
          branchId: po.br,
          organizationId: org.id,
          quantity: po.qty,
          reason: StockMovementReason.PURCHASE_RECEIVED,
          referenceId: createdPO.id,
          recordedById: po.by,
          createdAt: po.date,
        },
      });
    }
    console.log(`✓ ${poSpecs.length} purchase orders + stock logs`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORGANISATION 2 - Ngumo General Supplies (Building & Hardware)
  // ═══════════════════════════════════════════════════════════════════════════

  const org2 = await prisma.organization.upsert({
    where: { slug: "bergmann" },
    update: {},
    create: { id: "seed-org-bergmann", name: "Bergmann Großhandel GmbH", slug: "bergmann", industry: "Building & Hardware", country: "DE", currency: "EUR" },
  });
  console.log(`\n✓ Org 2: ${org2.name}`);

  const nb1 = await prisma.branch.upsert({
    where: { name_organizationId: { name: "Berlin Branch", organizationId: org2.id } },
    update: {},
    create: { name: "Berlin Branch", address: "Alexanderplatz 7, 10178 Berlin", phone: "+49 30 1234 5670", organizationId: org2.id },
  });
  const nb2 = await prisma.branch.upsert({
    where: { name_organizationId: { name: "Hamburg Branch", organizationId: org2.id } },
    update: {},
    create: { name: "Hamburg Branch", address: "Reeperbahn 22, 20359 Hamburg", phone: "+49 40 1234 5671", organizationId: org2.id },
  });
  console.log(`✓ Branches: ${nb1.name}, ${nb2.name}`);

  const nAdmin = await prisma.user.upsert({ where: { email: "admin@bergmann-handel.de" },    update: {}, create: { id: "seed-n-admin", name: "Bergmann Admin", email: "admin@bergmann-handel.de",    passwordHash: await hw("admin123"),   role: Role.ADMIN,   organizationId: org2.id } });
  const nMgr   = await prisma.user.upsert({ where: { email: "manager@bergmann-handel.de" },  update: {}, create: { id: "seed-n-mgr",   name: "Store Manager", email: "manager@bergmann-handel.de",  passwordHash: await hw("manager123"), role: Role.MANAGER, organizationId: org2.id, branchId: nb1.id } });
  const nCs1   = await prisma.user.upsert({ where: { email: "cashier1@bergmann-handel.de" }, update: {}, create: { id: "seed-n-cs1",   name: "Cashier One",   email: "cashier1@bergmann-handel.de", passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org2.id, branchId: nb1.id } });
  const nCs2   = await prisma.user.upsert({ where: { email: "cashier2@bergmann-handel.de" }, update: {}, create: { id: "seed-n-cs2",   name: "Cashier Two",   email: "cashier2@bergmann-handel.de", passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org2.id, branchId: nb1.id } });
  const nCs3   = await prisma.user.upsert({ where: { email: "cashier3@bergmann-handel.de" }, update: {}, create: { id: "seed-n-cs3",   name: "Cashier Three", email: "cashier3@bergmann-handel.de", passwordHash: await hw("cashier123"), role: Role.CASHIER, organizationId: org2.id, branchId: nb2.id } });
  void nAdmin;
  console.log("✓ 5 users (Org 2)");

  const nCatNames = ["Hardware", "Plumbing", "Electrical", "Paints"];
  const nCatMap: Record<string, string> = {};
  for (const n of nCatNames) {
    const cat = await prisma.category.upsert({
      where: { name_organizationId: { name: n, organizationId: org2.id } },
      update: {},
      create: { name: n, organizationId: org2.id },
    });
    nCatMap[n] = cat.id;
  }
  console.log(`✓ ${nCatNames.length} categories (Org 2)`);

  const nSup1 = await prisma.supplier.upsert({ where: { id: "seed-nsup-1" }, update: {}, create: { id: "seed-nsup-1", name: "Bau Depot GmbH",           phone: "+49 30 9876 5432", email: "orders@baudepot.de",     address: "Gewerbegebiet Nord, 12681 Berlin",        organizationId: org2.id } });
  const nSup2 = await prisma.supplier.upsert({ where: { id: "seed-nsup-2" }, update: {}, create: { id: "seed-nsup-2", name: "ElektroFachhändler AG",    phone: "+49 30 9876 5433", email: "sales@elektrofach.de",   address: "Kurfürstendamm 12, 10719 Berlin",         organizationId: org2.id } });
  console.log("✓ 2 suppliers (Org 2)");

  type NIS = { sku: string; name: string; cat: string; rp: number; wp: number; sup: string; b1: number; b2: number; thr: number };
  const nItemSeeds: NIS[] = [
    { sku:"HAR-001", name:"Claw Hammer 500g",              cat:"Hardware",   rp:650,  wp:500,  sup:nSup1.id, b1:80,  b2:40,  thr:15 },
    { sku:"HAR-002", name:"Nails Box 200pcs 2in",          cat:"Hardware",   rp:280,  wp:220,  sup:nSup1.id, b1:200, b2:100, thr:30 },
    { sku:"HAR-003", name:"Measuring Tape 5m",             cat:"Hardware",   rp:350,  wp:280,  sup:nSup1.id, b1:80,  b2:40,  thr:12 },
    { sku:"HAR-004", name:"Screwdriver Set 6pc",           cat:"Hardware",   rp:480,  wp:380,  sup:nSup1.id, b1:60,  b2:30,  thr:10 },
    { sku:"HAR-005", name:"Combination Pliers 8in",        cat:"Hardware",   rp:380,  wp:300,  sup:nSup1.id, b1:70,  b2:35,  thr:10 },
    { sku:"PLM-001", name:"PVC Pipe 0.5in x 1m",          cat:"Plumbing",   rp:180,  wp:140,  sup:nSup1.id, b1:200, b2:100, thr:30 },
    { sku:"PLM-002", name:"Ball Valve 0.5in Chrome",       cat:"Plumbing",   rp:320,  wp:250,  sup:nSup1.id, b1:100, b2:50,  thr:15 },
    { sku:"PLM-003", name:"Pipe Wrench 14in",              cat:"Plumbing",   rp:720,  wp:580,  sup:nSup1.id, b1:40,  b2:20,  thr:6  },
    { sku:"ELC-001", name:"Wall Switch Single 10A",        cat:"Electrical", rp:120,  wp:90,   sup:nSup2.id, b1:250, b2:120, thr:40 },
    { sku:"ELC-002", name:"Power Socket 3-Pin 15A",        cat:"Electrical", rp:180,  wp:140,  sup:nSup2.id, b1:200, b2:100, thr:30 },
    { sku:"ELC-003", name:"Extension Cable 5m 4-Way",      cat:"Electrical", rp:420,  wp:320,  sup:nSup2.id, b1:80,  b2:40,  thr:12 },
    { sku:"ELC-004", name:"LED Bulb 9W B22 Daylight",      cat:"Electrical", rp:85,   wp:60,   sup:nSup2.id, b1:400, b2:200, thr:60 },
    { sku:"PAI-001", name:"Wall Paint 4L White Crown",     cat:"Paints",     rp:1200, wp:950,  sup:nSup2.id, b1:60,  b2:30,  thr:10 },
    { sku:"PAI-002", name:"Wall Paint 20L White Crown",    cat:"Paints",     rp:5500, wp:4400, sup:nSup2.id, b1:20,  b2:10,  thr:4  },
    { sku:"PAI-003", name:"Undercoat Primer 4L",           cat:"Paints",     rp:980,  wp:780,  sup:nSup2.id, b1:40,  b2:20,  thr:8  },
  ];

  const nIMap: Record<string, { id: string; rp: number; wp: number }> = {};
  for (const s of nItemSeeds) {
    const item = await prisma.item.upsert({
      where:  { sku_organizationId: { sku: s.sku, organizationId: org2.id } },
      update: { retailPrice: s.rp, wholesalePrice: s.wp },
      create: { sku: s.sku, name: s.name, categoryId: nCatMap[s.cat], retailPrice: s.rp, wholesalePrice: s.wp, supplierId: s.sup, organizationId: org2.id },
    });
    await prisma.branchStock.upsert({
      where:  { itemId_branchId: { itemId: item.id, branchId: nb1.id } },
      update: { stockQty: s.b1, lowStockThreshold: s.thr },
      create: { itemId: item.id, branchId: nb1.id, stockQty: s.b1, lowStockThreshold: s.thr },
    });
    await prisma.branchStock.upsert({
      where:  { itemId_branchId: { itemId: item.id, branchId: nb2.id } },
      update: { stockQty: s.b2, lowStockThreshold: s.thr },
      create: { itemId: item.id, branchId: nb2.id, stockQty: s.b2, lowStockThreshold: s.thr },
    });
    nIMap[s.sku] = { id: item.id, rp: s.rp, wp: s.wp };
  }
  console.log(`✓ ${nItemSeeds.length} items + branch stocks (Org 2)`);

  type NCS2 = { id: string; name: string; phone: string; address: string; br: string };
  const nCustSpecs: NCS2[] = [
    { id:"seed-nc-1", name:"Lukas Becker",   phone:"+49 30 1234 5601", address:"Unter den Linden 12, 10117 Berlin",    br:nb1.id },
    { id:"seed-nc-2", name:"Anna Schulz",    phone:"+49 30 1234 5602", address:"Alexanderplatz 3, 10178 Berlin",       br:nb1.id },
    { id:"seed-nc-3", name:"Markus Fischer", phone:"+49 40 1234 5603", address:"Hamburger Straße 44, 22083 Hamburg",   br:nb2.id },
    { id:"seed-nc-4", name:"Lena Wagner",    phone:"+49 40 1234 5604", address:"Reeperbahn 18, 20359 Hamburg",         br:nb2.id },
    { id:"seed-nc-5", name:"Felix Müller",   phone:"+49 30 1234 5605", address:"Friedrichstraße 88, 10117 Berlin",     br:nb1.id },
  ];
  for (const c of nCustSpecs)
    await prisma.customer.upsert({
      where:  { id: c.id },
      update: {},
      create: { id: c.id, name: c.name, phone: c.phone, address: c.address, branchId: c.br, organizationId: org2.id, creditBalance: 0 },
    });
  console.log(`✓ ${nCustSpecs.length} customers (Org 2)`);

  const NB1 = nb1.id, NB2 = nb2.id;
  const NM = nMgr.id, NC1 = nCs1.id, NC2 = nCs2.id, NC3 = nCs3.id;

  const existNSales = await prisma.sale.count({ where: { organizationId: org2.id } });
  if (existNSales >= 5) {
    console.log(`✓ Sales already seeded for Org 2 (${existNSales}), skipping`);
  } else {
    type NLS = { sku: string; qty: number };
    const np = (sku: string, type: "RETAIL" | "WHOLESALE") =>
      type === "RETAIL" ? nIMap[sku].rp : nIMap[sku].wp;
    const ncalc = (lines: NLS[], type: "RETAIL" | "WHOLESALE", disc: number) => {
      const ll = lines.map(l => ({ itemId: nIMap[l.sku].id, qty: l.qty, unitPrice: np(l.sku, type), subtotal: np(l.sku, type) * l.qty }));
      const total = ll.reduce((s, l) => s + l.subtotal, 0) - disc;
      return { ll, total, taxAmt: extractTax(total) };
    };
    type NSS = { br: string; emp: string; cust: string | null; type: "RETAIL" | "WHOLESALE"; pay: "PAID" | "CREDIT"; disc: number; date: Date; lines: NLS[] };
    const nSpecs: NSS[] = [
      // March 2026
      { br:NB1, emp:NC1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-03-02",9,30),  lines:[{sku:"HAR-001",qty:3},{sku:"HAR-002",qty:5}] },
      { br:NB1, emp:NM,  cust:"seed-nc-1",type:"RETAIL",    pay:"CREDIT", disc:0,   date:d("2026-03-03",10,0),  lines:[{sku:"PLM-001",qty:5},{sku:"PLM-002",qty:2}] },
      { br:NB2, emp:NC3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-03-05",11,0),  lines:[{sku:"ELC-001",qty:10},{sku:"ELC-002",qty:8}] },
      { br:NB1, emp:NC2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:50,  date:d("2026-03-06",13,0),  lines:[{sku:"ELC-004",qty:20},{sku:"HAR-003",qty:2}] },
      { br:NB1, emp:NM,  cust:"seed-nc-2",type:"WHOLESALE", pay:"CREDIT", disc:300, date:d("2026-03-08",9,0),   lines:[{sku:"HAR-001",qty:10},{sku:"HAR-004",qty:8}] },
      { br:NB2, emp:NC3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-03-10",14,0),  lines:[{sku:"PAI-001",qty:4},{sku:"PAI-003",qty:2}] },
      { br:NB1, emp:NC1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-03-12",10,30), lines:[{sku:"ELC-003",qty:3},{sku:"ELC-004",qty:10}] },
      { br:NB1, emp:NC2, cust:"seed-nc-5",type:"RETAIL",    pay:"CREDIT", disc:0,   date:d("2026-03-14",11,0),  lines:[{sku:"PLM-001",qty:8},{sku:"PLM-002",qty:3}] },
      // April 2026
      { br:NB1, emp:NC1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-04-01",9,30),  lines:[{sku:"HAR-001",qty:5},{sku:"HAR-002",qty:10}] },
      { br:NB2, emp:NC3, cust:"seed-nc-3",type:"RETAIL",    pay:"CREDIT", disc:0,   date:d("2026-04-03",10,0),  lines:[{sku:"ELC-001",qty:15},{sku:"ELC-004",qty:30}] },
      { br:NB1, emp:NC1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:100, date:d("2026-04-05",11,30), lines:[{sku:"PAI-001",qty:6},{sku:"PAI-002",qty:1}] },
      { br:NB1, emp:NM,  cust:"seed-nc-1",type:"WHOLESALE", pay:"PAID",   disc:0,   date:d("2026-04-07",9,0),   lines:[{sku:"PLM-001",qty:30},{sku:"PLM-002",qty:15}] },
      { br:NB2, emp:NC3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-04-09",14,0),  lines:[{sku:"ELC-002",qty:12},{sku:"ELC-003",qty:5}] },
      { br:NB1, emp:NC2, cust:"seed-nc-2",type:"RETAIL",    pay:"CREDIT", disc:200, date:d("2026-04-12",10,0),  lines:[{sku:"HAR-003",qty:3},{sku:"HAR-005",qty:4}] },
      { br:NB1, emp:NM,  cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,   date:d("2026-04-14",13,0),  lines:[{sku:"PAI-003",qty:3},{sku:"ELC-004",qty:20}] },
    ];

    nSpecs.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const spec of nSpecs) {
      const rcpNum = rcp(spec.date);
      const { ll, total, taxAmt } = ncalc(spec.lines, spec.type, spec.disc);

      const sale = await prisma.sale.upsert({
        where:  { receiptNumber_organizationId: { receiptNumber: rcpNum, organizationId: org2.id } },
        update: {},
        create: {
          receiptNumber: rcpNum,
          saleType: spec.type,
          paymentStatus: spec.pay,
          discountAmount: spec.disc,
          taxAmount: taxAmt,
          totalAmount: total,
          isVoid: false,
          customerId: spec.cust,
          employeeId: spec.emp,
          branchId: spec.br,
          organizationId: org2.id,
          createdAt: spec.date,
          items: { create: ll.map(l => ({ itemId: l.itemId, quantity: l.qty, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
        },
      });

      for (const l of ll) {
        await prisma.stockLog.create({
          data: { itemId: l.itemId, branchId: spec.br, organizationId: org2.id, quantity: -l.qty, reason: StockMovementReason.SALE, referenceId: sale.id, recordedById: spec.emp, createdAt: spec.date },
        });
      }
    }
    console.log(`✓ ${nSpecs.length} sales + stock logs (Org 2)`);

    for (const cust of nCustSpecs) {
      const owed = nSpecs.filter(s => s.cust === cust.id && s.pay === "CREDIT")
        .reduce((sum, s) => sum + ncalc(s.lines, s.type, s.disc).total, 0);
      if (owed > 0)
        await prisma.customer.update({ where: { id: cust.id }, data: { creditBalance: owed } });
    }
  }

  const existNPOs = await prisma.purchaseOrder.count({ where: { id: { startsWith: "seed-npo-" } } });
  if (existNPOs > 0) {
    console.log(`✓ Purchase orders already seeded for Org 2 (${existNPOs}), skipping`);
  } else {
    type NPOS = { id: string; sup: string; sku: string; qty: number; cost: number; by: string; br: string; date: Date };
    const nPoSpecs: NPOS[] = [
      { id:"seed-npo-01", sup:nSup1.id, sku:"HAR-001", qty:200, cost:400, by:NM, br:NB1, date:d("2026-01-15",10,0) },
      { id:"seed-npo-02", sup:nSup1.id, sku:"PLM-001", qty:500, cost:100, by:NM, br:NB1, date:d("2026-01-20",10,0) },
      { id:"seed-npo-03", sup:nSup2.id, sku:"ELC-001", qty:500, cost:65,  by:NM, br:NB1, date:d("2026-02-01",10,0) },
      { id:"seed-npo-04", sup:nSup2.id, sku:"PAI-001", qty:100, cost:800, by:NM, br:NB1, date:d("2026-02-10",10,0) },
    ];

    for (const po of nPoSpecs) {
      const createdPO = await prisma.purchaseOrder.create({
        data: {
          id: po.id,
          poNumber: poNum(po.date),
          supplierId: po.sup,
          status: PurchaseOrderStatus.RECEIVED,
          organizationId: org2.id,
          branchId: po.br,
          createdById: po.by,
          deliveredAt: po.date,
          createdAt: po.date,
          items: { create: [{ itemId: nIMap[po.sku].id, quantity: po.qty, costPrice: po.cost, receivedQty: po.qty }] },
        },
      });
      await prisma.stockLog.create({
        data: { itemId: nIMap[po.sku].id, branchId: po.br, organizationId: org2.id, quantity: po.qty, reason: StockMovementReason.PURCHASE_RECEIVED, referenceId: createdPO.id, recordedById: po.by, createdAt: po.date },
      });
    }
    console.log(`✓ ${nPoSpecs.length} purchase orders + stock logs (Org 2)`);
  }

  console.log("\n✅ Seed complete!\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" LOGIN CREDENTIALS - Meridian Electronics Ltd (meridian)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" ADMIN");
  console.log("   admin@meridian.co.uk              admin123");
  console.log("");
  console.log(" MANAGERS");
  console.log("   sophie.harris@meridian.co.uk      manager123   (London Branch)");
  console.log("   james.walker@meridian.co.uk       manager123   (Manchester Branch)");
  console.log("");
  console.log(" CASHIERS - London Branch");
  console.log("   emma.jones@meridian.co.uk         cashier123");
  console.log("   liam.smith@meridian.co.uk         cashier123");
  console.log("   olivia.brown@meridian.co.uk       cashier123");
  console.log("   noah.taylor@meridian.co.uk        cashier123");
  console.log("");
  console.log(" CASHIERS - Manchester Branch");
  console.log("   ava.wilson@meridian.co.uk         cashier123");
  console.log("   ethan.moore@meridian.co.uk        cashier123");
  console.log("   isabella.clark@meridian.co.uk     cashier123");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" DEMO ACCOUNT (read-only - landing page demo button)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   demo@suppliq.com                 demo1234");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" LOGIN CREDENTIALS - Bergmann Grosshandel GmbH (bergmann)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" ADMIN");
  console.log("   admin@bergmann-handel.de          admin123");
  console.log("");
  console.log(" MANAGER - Berlin Branch");
  console.log("   manager@bergmann-handel.de        manager123");
  console.log("");
  console.log(" CASHIERS");
  console.log("   cashier1@bergmann-handel.de       cashier123   (Berlin Branch)");
  console.log("   cashier2@bergmann-handel.de       cashier123   (Berlin Branch)");
  console.log("   cashier3@bergmann-handel.de       cashier123   (Hamburg Branch)");
  console.log("═══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
