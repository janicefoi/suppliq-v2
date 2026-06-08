import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const VAT_EXTRACT = 16 / 116;
function extractTax(total: number) { return Math.round(total * VAT_EXTRACT * 100) / 100; }
function d(date: string, h: number, m = 0): Date { const dt = new Date(`${date}T00:00:00`); dt.setHours(h, m, 0, 0); return dt; }

const _seq: Record<string, number> = {};
function rcp(date: Date): string {
  const k = date.toISOString().slice(0, 10).replace(/-/g, "");
  _seq[k] = (_seq[k] ?? 0) + 1;
  return `RCP-${k}-${String(_seq[k]).padStart(4, "0")}`;
}

async function main() {
  console.log("Seeding database…\n");

  // ── Branches ──────────────────────────────────────────────────────────────
  const b1 = await prisma.branch.upsert({
    where:  { name: "Mukai Branch" },
    update: { address: "PO BOX 4901 Eldoret Mukai", phone: "0722560051/0763560052", paybill: "315469", pin: "P0S1656847U" },
    create: { name: "Mukai Branch", address: "PO BOX 4901 Eldoret Mukai", phone: "0722560051/0763560052", paybill: "315469", pin: "P0S1656847U" },
  });
  const b2 = await prisma.branch.upsert({
    where:  { name: "Zulu Arcade Branch" },
    update: { address: "PO BOX 30100 ELD Zulu Arcade", phone: "0712891212/0722560051", paybill: "858018", pin: "P0S1656847U" },
    create: { name: "Zulu Arcade Branch", address: "PO BOX 30100 ELD Zulu Arcade", phone: "0712891212/0722560051", paybill: "858018", pin: "P0S1656847U" },
  });
  console.log(`✓ Branches: ${b1.name}, ${b2.name}`);

  // ── Users (10 total) ──────────────────────────────────────────────────────
  const hw = (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.upsert({ where: { email: "admin@jsh.co.ke" },         update: {}, create: { id: "seed-u-admin", name: "JSH Admin",       email: "admin@jsh.co.ke",           passwordHash: await hw("admin123"),    role: Role.ADMIN } });
  const mgr1  = await prisma.user.upsert({ where: { email: "lucy.wangare@jsh.co.ke" },  update: {}, create: { id: "seed-u-mgr1",  name: "Lucy Wangare",  email: "lucy.wangare@jsh.co.ke",  passwordHash: await hw("manager123"),  role: Role.MANAGER, branchId: b1.id } });
  const mgr2  = await prisma.user.upsert({ where: { email: "peter.kamau@jsh.co.ke" },   update: {}, create: { id: "seed-u-mgr2",  name: "Peter Kamau",   email: "peter.kamau@jsh.co.ke",   passwordHash: await hw("manager123"),  role: Role.MANAGER, branchId: b2.id } });
  const cs1   = await prisma.user.upsert({ where: { email: "mary.akinyi@jsh.co.ke" },   update: {}, create: { id: "seed-u-cs1",   name: "Mary Akinyi",   email: "mary.akinyi@jsh.co.ke",   passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b1.id } });
  const cs2   = await prisma.user.upsert({ where: { email: "james.otieno@jsh.co.ke" },  update: {}, create: { id: "seed-u-cs2",   name: "James Otieno",  email: "james.otieno@jsh.co.ke",  passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b1.id } });
  const cs3   = await prisma.user.upsert({ where: { email: "brian.kiptoo@jsh.co.ke" },  update: {}, create: { id: "seed-u-cs3",   name: "Brian Kiptoo",  email: "brian.kiptoo@jsh.co.ke",  passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b1.id } });
  const cs4   = await prisma.user.upsert({ where: { email: "susan.chebet@jsh.co.ke" },  update: {}, create: { id: "seed-u-cs4",   name: "Susan Chebet",  email: "susan.chebet@jsh.co.ke",  passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b1.id } });
  const cs5   = await prisma.user.upsert({ where: { email: "david.mwangi@jsh.co.ke" },  update: {}, create: { id: "seed-u-cs5",   name: "David Mwangi",  email: "david.mwangi@jsh.co.ke",  passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b2.id } });
  const cs6   = await prisma.user.upsert({ where: { email: "faith.njoroge@jsh.co.ke" }, update: {}, create: { id: "seed-u-cs6",   name: "Faith Njoroge", email: "faith.njoroge@jsh.co.ke", passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b2.id } });
  const cs7   = await prisma.user.upsert({ where: { email: "kevin.njoroge@jsh.co.ke" }, update: {}, create: { id: "seed-u-cs7",   name: "Kevin Njoroge", email: "kevin.njoroge@jsh.co.ke", passwordHash: await hw("cashier123"),  role: Role.CASHIER, branchId: b2.id } });
  void admin;
  console.log("✓ 10 users");

  // ── Categories ────────────────────────────────────────────────────────────
  for (const n of ["Engine Parts","Electrical","Brakes","Tyres & Tubes","Oils & Lubricants","Body Parts","Transmission","Filters"])
    await prisma.category.upsert({ where: { name: n }, update: {}, create: { name: n } });
  console.log("✓ 8 categories");

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const sup1 = await prisma.supplier.upsert({ where: { id: "seed-sup-1" }, update: {}, create: { id: "seed-sup-1", name: "Mombasa Auto Spares Ltd",   phone: "0712000001", email: "orders@mombasaauto.co.ke",  address: "Mombasa Road, Industrial Area, Nairobi", notes: "Primary supplier — net 30 payment terms" } });
  const sup2 = await prisma.supplier.upsert({ where: { id: "seed-sup-2" }, update: {}, create: { id: "seed-sup-2", name: "Eldoret Motor Accessories", phone: "0721000002", email: "sales@eldoretmoto.co.ke",   address: "Uganda Road, Eldoret",                   notes: "Local supplier — fast delivery" } });
  const sup3 = await prisma.supplier.upsert({ where: { id: "seed-sup-3" }, update: {}, create: { id: "seed-sup-3", name: "Nairobi Tyre & Tube Hub",   phone: "0733000003", email: "info@nairobityres.co.ke",   address: "Kirinyaga Road, Nairobi",                 notes: "Tyres and tubes specialist" } });
  const sup4 = await prisma.supplier.upsert({ where: { id: "seed-sup-4" }, update: {}, create: { id: "seed-sup-4", name: "General Moto Supplies",     phone: "0700000004", email: "gms@motosupplies.co.ke",    address: "Nakuru Town, Nakuru County",              notes: "Oils, filters, and consumables" } });
  console.log("✓ 4 suppliers");

  // ── Items (83 brand-specific parts) ──────────────────────────────────────
  type IS = { sku: string; name: string; cat: string; rp: number; wp: number; sp: number|null; sup: string; b1: number; b2: number; thr: number };
  const itemSeeds: IS[] = [
    // ENGINE PARTS
    { sku:"ENG-001", name:"Piston Ring Set — Honda CG125",          cat:"Engine Parts",      rp:850,  wp:700,  sp:620,  sup:sup1.id, b1:80,  b2:40,  thr:15 },
    { sku:"ENG-002", name:"Piston Ring Set — TVS Star City",         cat:"Engine Parts",      rp:820,  wp:680,  sp:null, sup:sup1.id, b1:80,  b2:40,  thr:15 },
    { sku:"ENG-003", name:"Piston Ring Set — BM150",                 cat:"Engine Parts",      rp:880,  wp:720,  sp:650,  sup:sup1.id, b1:80,  b2:40,  thr:15 },
    { sku:"ENG-004", name:"Piston Ring Set — HLX 125",               cat:"Engine Parts",      rp:800,  wp:660,  sp:null, sup:sup1.id, b1:70,  b2:35,  thr:12 },
    { sku:"ENG-005", name:"Piston Ring Set — Bajaj Boxer",           cat:"Engine Parts",      rp:860,  wp:710,  sp:640,  sup:sup1.id, b1:70,  b2:35,  thr:12 },
    { sku:"ENG-006", name:"Cylinder Head Gasket — Honda CG125",      cat:"Engine Parts",      rp:650,  wp:520,  sp:470,  sup:sup1.id, b1:70,  b2:35,  thr:10 },
    { sku:"ENG-007", name:"Cylinder Head Gasket — TVS Star City",    cat:"Engine Parts",      rp:620,  wp:500,  sp:null, sup:sup1.id, b1:65,  b2:32,  thr:10 },
    { sku:"ENG-008", name:"Cylinder Head Gasket — BM150",            cat:"Engine Parts",      rp:680,  wp:540,  sp:null, sup:sup1.id, b1:65,  b2:30,  thr:10 },
    { sku:"ENG-009", name:"Cylinder Head Gasket — BM125",            cat:"Engine Parts",      rp:640,  wp:510,  sp:null, sup:sup1.id, b1:60,  b2:28,  thr:8  },
    { sku:"ENG-010", name:"Full Engine Gasket Set — Honda CG125",    cat:"Engine Parts",      rp:1200, wp:950,  sp:null, sup:sup1.id, b1:45,  b2:22,  thr:8  },
    { sku:"ENG-011", name:"Full Engine Gasket Set — BM150",          cat:"Engine Parts",      rp:1300, wp:1050, sp:null, sup:sup1.id, b1:40,  b2:20,  thr:8  },
    { sku:"ENG-012", name:"Crankshaft Bearing Set (2 pcs)",          cat:"Engine Parts",      rp:480,  wp:380,  sp:null, sup:sup1.id, b1:60,  b2:30,  thr:10 },
    { sku:"ENG-013", name:"Valve Set — TVS Star City",               cat:"Engine Parts",      rp:550,  wp:430,  sp:null, sup:sup1.id, b1:55,  b2:28,  thr:8  },
    { sku:"ENG-014", name:"Valve Set — Honda CG125",                 cat:"Engine Parts",      rp:580,  wp:460,  sp:null, sup:sup1.id, b1:55,  b2:28,  thr:8  },
    { sku:"ENG-015", name:"Camshaft — BM150",                        cat:"Engine Parts",      rp:2200, wp:1800, sp:null, sup:sup1.id, b1:28,  b2:14,  thr:5  },
    { sku:"ENG-016", name:"Piston + Ring Set — BM150",               cat:"Engine Parts",      rp:1400, wp:1150, sp:1050, sup:sup1.id, b1:65,  b2:30,  thr:10 },
    { sku:"ENG-017", name:"Piston + Ring Set — Bajaj Boxer",         cat:"Engine Parts",      rp:1350, wp:1100, sp:null, sup:sup1.id, b1:55,  b2:25,  thr:8  },
    { sku:"ENG-018", name:"Con Rod — Honda CG125",                   cat:"Engine Parts",      rp:950,  wp:780,  sp:null, sup:sup1.id, b1:50,  b2:24,  thr:8  },
    { sku:"ENG-019", name:"Oil Seal Set — Universal",                cat:"Engine Parts",      rp:320,  wp:250,  sp:null, sup:sup1.id, b1:90,  b2:45,  thr:15 },
    { sku:"ENG-020", name:"Timing Chain — BM150 / BM100",            cat:"Engine Parts",      rp:380,  wp:300,  sp:null, sup:sup1.id, b1:85,  b2:42,  thr:15 },
    { sku:"ENG-021", name:"Timing Chain — HLX 125 YOG",             cat:"Engine Parts",      rp:360,  wp:290,  sp:null, sup:sup1.id, b1:80,  b2:38,  thr:12 },
    // ELECTRICAL
    { sku:"ELE-001", name:"CDI Unit — Honda CB150",                  cat:"Electrical",        rp:1200, wp:980,  sp:null, sup:sup1.id, b1:40,  b2:20,  thr:6  },
    { sku:"ELE-002", name:"CDI Unit — TVS Star City",                cat:"Electrical",        rp:1100, wp:900,  sp:null, sup:sup1.id, b1:40,  b2:20,  thr:6  },
    { sku:"ELE-003", name:"CDI Unit — BM150",                        cat:"Electrical",        rp:1150, wp:940,  sp:null, sup:sup1.id, b1:40,  b2:20,  thr:6  },
    { sku:"ELE-004", name:"CDI Unit — Yamaha YBR",                   cat:"Electrical",        rp:1050, wp:860,  sp:null, sup:sup1.id, b1:35,  b2:18,  thr:5  },
    { sku:"ELE-005", name:"Ignition Coil — Universal 12V",           cat:"Electrical",        rp:850,  wp:680,  sp:null, sup:sup1.id, b1:55,  b2:28,  thr:8  },
    { sku:"ELE-006", name:"Rectifier / Regulator — Yamaha YBR",     cat:"Electrical",        rp:750,  wp:600,  sp:null, sup:sup1.id, b1:45,  b2:22,  thr:6  },
    { sku:"ELE-007", name:"Rectifier / Regulator — TVS Star",       cat:"Electrical",        rp:720,  wp:580,  sp:null, sup:sup1.id, b1:42,  b2:20,  thr:6  },
    { sku:"ELE-008", name:"Starter Motor Brush Set",                 cat:"Electrical",        rp:320,  wp:250,  sp:null, sup:sup2.id, b1:75,  b2:38,  thr:12 },
    { sku:"ELE-009", name:"Headlight Bulb 12V 35/35W",               cat:"Electrical",        rp:80,   wp:60,   sp:null, sup:sup2.id, b1:300, b2:150, thr:50 },
    { sku:"ELE-010", name:"Horn — Universal 12V",                    cat:"Electrical",        rp:220,  wp:170,  sp:null, sup:sup2.id, b1:90,  b2:45,  thr:15 },
    { sku:"ELE-011", name:"D/Switch Assembly — BM150",               cat:"Electrical",        rp:680,  wp:550,  sp:null, sup:sup2.id, b1:60,  b2:30,  thr:10 },
    { sku:"ELE-012", name:"D/Switch Assembly — Honda CG125",         cat:"Electrical",        rp:650,  wp:520,  sp:null, sup:sup2.id, b1:55,  b2:28,  thr:10 },
    // BRAKES
    { sku:"BRA-001", name:"Brake Pad Set — TVS Star City",           cat:"Brakes",            rp:420,  wp:330,  sp:290,  sup:sup2.id, b1:160, b2:80,  thr:25 },
    { sku:"BRA-002", name:"Brake Pad Set — BM150",                   cat:"Brakes",            rp:400,  wp:320,  sp:null, sup:sup2.id, b1:140, b2:70,  thr:20 },
    { sku:"BRA-003", name:"Brake Pad Set — Honda CG125 / Universal", cat:"Brakes",            rp:420,  wp:330,  sp:290,  sup:sup2.id, b1:150, b2:75,  thr:25 },
    { sku:"BRA-004", name:"Brake Shoes — Rear Universal",            cat:"Brakes",            rp:350,  wp:270,  sp:null, sup:sup2.id, b1:120, b2:60,  thr:20 },
    { sku:"BRA-005", name:"Brake Shoes — TVS Star City",             cat:"Brakes",            rp:340,  wp:265,  sp:null, sup:sup2.id, b1:110, b2:55,  thr:18 },
    { sku:"BRA-006", name:"Brake Cable — Front Honda CG125",         cat:"Brakes",            rp:180,  wp:140,  sp:null, sup:sup2.id, b1:130, b2:65,  thr:20 },
    { sku:"BRA-007", name:"Brake Cable — Rear Universal",            cat:"Brakes",            rp:160,  wp:120,  sp:null, sup:sup2.id, b1:140, b2:70,  thr:20 },
    { sku:"BRA-008", name:"Brake Disc — Honda CB150",                cat:"Brakes",            rp:1800, wp:1450, sp:null, sup:sup2.id, b1:22,  b2:10,  thr:4  },
    { sku:"BRA-009", name:"Brake Lever Set — Universal",             cat:"Brakes",            rp:280,  wp:220,  sp:null, sup:sup2.id, b1:80,  b2:40,  thr:12 },
    // TYRES & TUBES
    { sku:"TYR-001", name:"Inner Tube 2.75-17",                      cat:"Tyres & Tubes",     rp:280,  wp:220,  sp:null, sup:sup3.id, b1:200, b2:100, thr:30 },
    { sku:"TYR-002", name:"Inner Tube 3.00-18",                      cat:"Tyres & Tubes",     rp:300,  wp:240,  sp:null, sup:sup3.id, b1:180, b2:90,  thr:28 },
    { sku:"TYR-003", name:"S/RUN Tube 300/17",                       cat:"Tyres & Tubes",     rp:180,  wp:150,  sp:null, sup:sup3.id, b1:280, b2:140, thr:40 },
    { sku:"TYR-004", name:"Inner Tube 2.50-18",                      cat:"Tyres & Tubes",     rp:260,  wp:200,  sp:null, sup:sup3.id, b1:160, b2:80,  thr:25 },
    { sku:"TYR-005", name:"Tyre 2.75-17 Front",                      cat:"Tyres & Tubes",     rp:1200, wp:950,  sp:null, sup:sup3.id, b1:55,  b2:28,  thr:10 },
    { sku:"TYR-006", name:"Tyre 3.00-18 Rear",                       cat:"Tyres & Tubes",     rp:1350, wp:1050, sp:null, sup:sup3.id, b1:48,  b2:24,  thr:8  },
    { sku:"TYR-007", name:"Tyre 2.50-18 Universal",                  cat:"Tyres & Tubes",     rp:1100, wp:880,  sp:null, sup:sup3.id, b1:40,  b2:20,  thr:8  },
    // OILS & LUBRICANTS
    { sku:"OIL-001", name:"Engine Oil 20W-50 — 1 Litre",             cat:"Oils & Lubricants", rp:380,  wp:300,  sp:null, sup:sup4.id, b1:350, b2:180, thr:50 },
    { sku:"OIL-002", name:"Engine Oil 10W-40 — 1 Litre",             cat:"Oils & Lubricants", rp:400,  wp:320,  sp:null, sup:sup4.id, b1:280, b2:140, thr:40 },
    { sku:"OIL-003", name:"Gear Oil 80W-90 — 1 Litre",               cat:"Oils & Lubricants", rp:280,  wp:220,  sp:null, sup:sup4.id, b1:160, b2:80,  thr:25 },
    { sku:"OIL-004", name:"Chain Lubricant Spray 400ml",              cat:"Oils & Lubricants", rp:320,  wp:250,  sp:null, sup:sup4.id, b1:100, b2:50,  thr:15 },
    { sku:"OIL-005", name:"Brake Fluid DOT4 — 500ml",                cat:"Oils & Lubricants", rp:450,  wp:360,  sp:null, sup:sup4.id, b1:70,  b2:35,  thr:10 },
    // BODY PARTS
    { sku:"BOD-001", name:"Side Mirror — Universal (Pair)",           cat:"Body Parts",        rp:350,  wp:270,  sp:null, sup:sup2.id, b1:80,  b2:40,  thr:12 },
    { sku:"BOD-002", name:"Rear Mudguard — Honda CG125",              cat:"Body Parts",        rp:580,  wp:450,  sp:null, sup:sup2.id, b1:45,  b2:22,  thr:8  },
    { sku:"BOD-003", name:"Rear Mudguard — TVS Star City",            cat:"Body Parts",        rp:550,  wp:420,  sp:null, sup:sup2.id, b1:42,  b2:20,  thr:8  },
    { sku:"BOD-004", name:"Front Fork Seal Set",                      cat:"Body Parts",        rp:420,  wp:330,  sp:null, sup:sup2.id, b1:65,  b2:32,  thr:10 },
    { sku:"BOD-005", name:"Footrest — Universal (Pair)",              cat:"Body Parts",        rp:480,  wp:380,  sp:null, sup:sup2.id, b1:55,  b2:28,  thr:8  },
    { sku:"BOD-006", name:"Headlight Assembly — BM150",               cat:"Body Parts",        rp:1800, wp:1450, sp:null, sup:sup2.id, b1:35,  b2:18,  thr:6  },
    { sku:"BOD-007", name:"Tail Light Assembly — Universal",          cat:"Body Parts",        rp:580,  wp:460,  sp:null, sup:sup2.id, b1:50,  b2:25,  thr:8  },
    { sku:"BOD-008", name:"Side Panel Set — TVS Star City",           cat:"Body Parts",        rp:1200, wp:960,  sp:null, sup:sup2.id, b1:30,  b2:15,  thr:5  },
    // TRANSMISSION
    { sku:"TRN-001", name:"Drive Chain 428H-122L",                    cat:"Transmission",      rp:420,  wp:340,  sp:null, sup:sup2.id, b1:130, b2:65,  thr:20 },
    { sku:"TRN-002", name:"Drive Chain 420H-120L",                    cat:"Transmission",      rp:380,  wp:300,  sp:null, sup:sup2.id, b1:120, b2:60,  thr:18 },
    { sku:"TRN-003", name:"Front Sprocket 14T — Honda CG125",         cat:"Transmission",      rp:280,  wp:220,  sp:null, sup:sup2.id, b1:100, b2:50,  thr:15 },
    { sku:"TRN-004", name:"Front Sprocket 15T — BM150",               cat:"Transmission",      rp:300,  wp:240,  sp:null, sup:sup2.id, b1:90,  b2:45,  thr:12 },
    { sku:"TRN-005", name:"Rear Sprocket 34T — Honda CG125",          cat:"Transmission",      rp:450,  wp:360,  sp:null, sup:sup2.id, b1:90,  b2:45,  thr:12 },
    { sku:"TRN-006", name:"Rear Sprocket 36T — TVS Star",             cat:"Transmission",      rp:480,  wp:380,  sp:null, sup:sup2.id, b1:80,  b2:40,  thr:12 },
    { sku:"TRN-007", name:"Clutch Plate Set — Bajaj Boxer",           cat:"Transmission",      rp:650,  wp:520,  sp:null, sup:sup1.id, b1:55,  b2:28,  thr:8  },
    { sku:"TRN-008", name:"Clutch Plate Set — BM150",                 cat:"Transmission",      rp:700,  wp:560,  sp:null, sup:sup1.id, b1:50,  b2:25,  thr:8  },
    { sku:"TRN-009", name:"Clutch Cable — Universal",                 cat:"Transmission",      rp:150,  wp:120,  sp:null, sup:sup2.id, b1:160, b2:80,  thr:25 },
    { sku:"TRN-010", name:"Axle Rear — TVS Star City",                cat:"Transmission",      rp:350,  wp:280,  sp:null, sup:sup2.id, b1:70,  b2:35,  thr:10 },
    { sku:"TRN-011", name:"Axle Rear — Honda CG150",                  cat:"Transmission",      rp:380,  wp:300,  sp:null, sup:sup2.id, b1:65,  b2:32,  thr:10 },
    { sku:"TRN-012", name:"Axle Front — BM150",                       cat:"Transmission",      rp:320,  wp:255,  sp:null, sup:sup2.id, b1:60,  b2:30,  thr:10 },
    { sku:"TRN-013", name:"Centre Stand — Universal",                 cat:"Transmission",      rp:580,  wp:460,  sp:null, sup:sup2.id, b1:45,  b2:22,  thr:8  },
    { sku:"TRN-014", name:"Swing Arm — BM150",                        cat:"Transmission",      rp:3500, wp:2800, sp:null, sup:sup2.id, b1:40,  b2:20,  thr:5  },
    { sku:"TRN-015", name:"Swing Arm Bar — WY125",                    cat:"Transmission",      rp:1800, wp:1450, sp:null, sup:sup2.id, b1:45,  b2:22,  thr:6  },
    // FILTERS
    { sku:"FIL-001", name:"Oil Filter — Honda CB150",                 cat:"Filters",           rp:280,  wp:220,  sp:null, sup:sup4.id, b1:120, b2:60,  thr:20 },
    { sku:"FIL-002", name:"Air Filter — Honda CG125",                 cat:"Filters",           rp:320,  wp:250,  sp:null, sup:sup4.id, b1:110, b2:55,  thr:18 },
    { sku:"FIL-003", name:"Air Filter — Yamaha YBR",                  cat:"Filters",           rp:350,  wp:270,  sp:null, sup:sup4.id, b1:100, b2:50,  thr:15 },
    { sku:"FIL-004", name:"Air Filter — TVS Star City",               cat:"Filters",           rp:300,  wp:240,  sp:null, sup:sup4.id, b1:105, b2:52,  thr:18 },
    { sku:"FIL-005", name:"Air Filter — BM150",                       cat:"Filters",           rp:330,  wp:260,  sp:null, sup:sup4.id, b1:100, b2:50,  thr:15 },
    { sku:"FIL-006", name:"Oil Filter — Universal",                   cat:"Filters",           rp:260,  wp:200,  sp:null, sup:sup4.id, b1:130, b2:65,  thr:20 },
  ];

  const iMap: Record<string, { id: string; rp: number; wp: number }> = {};
  for (const s of itemSeeds) {
    const item = await prisma.item.upsert({
      where:  { sku: s.sku },
      update: { retailPrice: s.rp, wholesalePrice: s.wp, specialPrice: s.sp },
      create: { sku: s.sku, name: s.name, category: s.cat, retailPrice: s.rp, wholesalePrice: s.wp, specialPrice: s.sp, supplierId: s.sup },
    });
    await prisma.branchStock.upsert({ where: { itemId_branchId: { itemId: item.id, branchId: b1.id } }, update: { stockQty: s.b1, lowStockThreshold: s.thr }, create: { itemId: item.id, branchId: b1.id, stockQty: s.b1, lowStockThreshold: s.thr } });
    await prisma.branchStock.upsert({ where: { itemId_branchId: { itemId: item.id, branchId: b2.id } }, update: { stockQty: s.b2, lowStockThreshold: s.thr }, create: { itemId: item.id, branchId: b2.id, stockQty: s.b2, lowStockThreshold: s.thr } });
    iMap[s.sku] = { id: item.id, rp: s.rp, wp: s.wp };
  }
  console.log(`✓ ${itemSeeds.length} items + branch stocks`);

  // ── Customers ─────────────────────────────────────────────────────────────
  type CS = { id: string; name: string; phone: string; address: string; br: string };
  const custSpecs: CS[] = [
    // Mukai Branch
    { id:"seed-c-001", name:"Charles Kiprop",    phone:"0722100001", address:"Eldoret Town, Uasin Gishu",  br:b1.id },
    { id:"seed-c-002", name:"William Baloo",     phone:"0722100002", address:"Eldoret, Huruma Estate",     br:b1.id },
    { id:"seed-c-003", name:"Joseph Mutai",      phone:"0722100003", address:"Turbo, Uasin Gishu",         br:b1.id },
    { id:"seed-c-004", name:"Samuel Koech",      phone:"0722100004", address:"Eldoret, Langas Estate",     br:b1.id },
    { id:"seed-c-005", name:"Alice Chepkemoi",   phone:"0722100005", address:"Moi's Bridge, Eldoret",      br:b1.id },
    { id:"seed-c-006", name:"Daniel Kiprotich",  phone:"0722100006", address:"Eldoret, Kamukunji",         br:b1.id },
    { id:"seed-c-007", name:"Grace Jepchirchir", phone:"0722100007", address:"Eldoret, Pioneer",           br:b1.id },
    { id:"seed-c-008", name:"Robert Sang",       phone:"0722100008", address:"Ziwa, Uasin Gishu",          br:b1.id },
    { id:"seed-c-009", name:"Moses Kibet",       phone:"0722100009", address:"Burnt Forest, Eldoret",      br:b1.id },
    { id:"seed-c-010", name:"Esther Ngetich",    phone:"0722100010", address:"Eldoret, Kapsoya",           br:b1.id },
    { id:"seed-c-011", name:"Francis Rutto",     phone:"0722100011", address:"Ainabkoi, Eldoret",          br:b1.id },
    { id:"seed-c-012", name:"Ann Cherono",       phone:"0722100012", address:"Eldoret, Kipkaren",          br:b1.id },
    { id:"seed-c-013", name:"Benson Cheruiyot",  phone:"0722100013", address:"Eldoret, Langas",            br:b1.id },
    // Zulu Arcade Branch
    { id:"seed-c-014", name:"John Mwangi",       phone:"0712100001", address:"Eldoret CBD",                br:b2.id },
    { id:"seed-c-015", name:"Mary Wanjiru",      phone:"0712100002", address:"Eldoret, Zulu",              br:b2.id },
    { id:"seed-c-016", name:"Peter Njoroge",     phone:"0712100003", address:"Eldoret, Maili Tatu",        br:b2.id },
    { id:"seed-c-017", name:"Sarah Kamau",       phone:"0712100004", address:"Eldoret, Section 58",        br:b2.id },
    { id:"seed-c-018", name:"David Mutua",       phone:"0712100005", address:"Eldoret, Kerio Valley",      br:b2.id },
    { id:"seed-c-019", name:"Elizabeth Njeri",   phone:"0712100006", address:"Eldoret, Annex",             br:b2.id },
    { id:"seed-c-020", name:"Paul Kariuki",      phone:"0712100007", address:"Eldoret Town Centre",        br:b2.id },
    { id:"seed-c-021", name:"Agnes Wairimu",     phone:"0712100008", address:"Eldoret, Kimumu",            br:b2.id },
    { id:"seed-c-022", name:"Jackline Achieng",  phone:"0712100009", address:"Eldoret, Kapseret",          br:b2.id },
    { id:"seed-c-023", name:"George Omondi",     phone:"0712100010", address:"Eldoret, Huruma",            br:b2.id },
  ];
  for (const c of custSpecs)
    await prisma.customer.upsert({ where: { id: c.id }, update: {}, create: { id: c.id, name: c.name, phone: c.phone, address: c.address, branchId: c.br, creditBalance: 0 } });
  console.log(`✓ ${custSpecs.length} customers`);

  // ── Employee / branch shorthands (used in sales + POs) ──────────────────
  const B1 = b1.id, B2 = b2.id;
  const M1 = mgr1.id, M2 = mgr2.id;
  const C1 = cs1.id, C2 = cs2.id, C3 = cs3.id, C4 = cs4.id;
  const C5 = cs5.id, C6 = cs6.id, C7 = cs7.id;

  // ── Sales ─────────────────────────────────────────────────────────────────
  const existSales = await prisma.sale.count({ where: { employee: { email: { endsWith: "@jsh.co.ke" } } } });
  if (existSales >= 10) {
    console.log(`✓ Sales already seeded (${existSales}), skipping`);
  } else {
    type LS = { sku: string; qty: number };
    type SS = { br: string; emp: string; cust: string|null; type: "RETAIL"|"WHOLESALE"; pay: "PAID"|"CREDIT"; disc: number; date: Date; lines: LS[] };

    function p(sku: string, type: "RETAIL"|"WHOLESALE") { return type === "RETAIL" ? iMap[sku].rp : iMap[sku].wp; }
    function calc(lines: LS[], type: "RETAIL"|"WHOLESALE", disc: number) {
      const ll = lines.map(l => ({ itemId: iMap[l.sku].id, qty: l.qty, unitPrice: p(l.sku, type), subtotal: p(l.sku, type) * l.qty }));
      const total = ll.reduce((s, l) => s + l.subtotal, 0) - disc;
      return { ll, total, taxAmt: extractTax(total) };
    }

    const specs: SS[] = [
      // ── APRIL 2026 ────────────────────────────────────────────────────────

      // Apr 4
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-04",9,20),  lines:[{sku:"ENG-001",qty:2},{sku:"OIL-001",qty:4}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-04",11,0),  lines:[{sku:"BRA-001",qty:2},{sku:"BRA-007",qty:3}] },
      // Apr 7
      { br:B1, emp:C2, cust:"seed-c-004", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-04-07",10,0),  lines:[{sku:"ELE-001",qty:2},{sku:"FIL-001",qty:3}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-07",14,30), lines:[{sku:"OIL-001",qty:5},{sku:"OIL-003",qty:3}] },
      // Apr 8
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-08",9,45),  lines:[{sku:"TYR-001",qty:3},{sku:"TYR-003",qty:5}] },
      { br:B2, emp:C5, cust:"seed-c-017", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-04-08",11,20), lines:[{sku:"BRA-003",qty:2},{sku:"BRA-006",qty:4}] },
      // Apr 10 ── BIG WHOLESALE: Daniel Kiprotich (B1, ~115k)
      { br:B1, emp:M1, cust:"seed-c-006", type:"WHOLESALE", pay:"CREDIT", disc:2000, date:d("2026-04-10",9,0),
        lines:[{sku:"ENG-016",qty:20},{sku:"ENG-008",qty:20},{sku:"BRA-001",qty:30},{sku:"TYR-003",qty:50},{sku:"TRN-001",qty:30},{sku:"ELE-003",qty:20},{sku:"OIL-001",qty:50},{sku:"TRN-014",qty:8}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-10",13,0),  lines:[{sku:"ENG-006",qty:1},{sku:"OIL-002",qty:3}] },
      // Apr 11
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:50,   date:d("2026-04-11",10,30), lines:[{sku:"FIL-002",qty:2},{sku:"FIL-004",qty:2}] },
      { br:B2, emp:C6, cust:"seed-c-021", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-04-11",11,0),  lines:[{sku:"ELE-005",qty:2},{sku:"ELE-008",qty:3}] },
      // Apr 14
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-14",9,0),   lines:[{sku:"BOD-001",qty:2},{sku:"ELE-010",qty:2}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-14",14,0),  lines:[{sku:"TYR-002",qty:4},{sku:"OIL-001",qty:4}] },
      // Apr 15 — medium sales
      { br:B1, emp:M1, cust:"seed-c-008", type:"WHOLESALE", pay:"CREDIT", disc:0,  date:d("2026-04-15",9,0),   lines:[{sku:"BRA-001",qty:20},{sku:"BRA-004",qty:20},{sku:"BRA-006",qty:30},{sku:"TRN-001",qty:15}] },
      { br:B2, emp:M2, cust:"seed-c-015", type:"WHOLESALE", pay:"CREDIT", disc:500, date:d("2026-04-15",10,0),  lines:[{sku:"ENG-002",qty:10},{sku:"ENG-007",qty:10},{sku:"OIL-001",qty:30}] },
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-15",15,30), lines:[{sku:"ENG-012",qty:2},{sku:"ENG-019",qty:3}] },
      // Apr 16
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-16",10,0),  lines:[{sku:"TRN-003",qty:3},{sku:"TRN-005",qty:2},{sku:"TRN-009",qty:5}] },
      { br:B2, emp:C7, cust:"seed-c-022", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-04-16",11,30), lines:[{sku:"ELE-006",qty:1},{sku:"FIL-003",qty:2}] },
      // Apr 18
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-18",9,15),  lines:[{sku:"OIL-004",qty:4},{sku:"OIL-005",qty:2}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-18",13,0),  lines:[{sku:"BOD-004",qty:1},{sku:"BOD-005",qty:2}] },
      // Apr 21
      { br:B1, emp:C4, cust:"seed-c-003", type:"RETAIL",  pay:"PAID",   disc:0,    date:d("2026-04-21",10,0),  lines:[{sku:"ENG-020",qty:5},{sku:"ENG-021",qty:5}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-04-21",14,30), lines:[{sku:"TRN-007",qty:2},{sku:"TRN-008",qty:2}] },
      // Apr 22
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-22",9,30),  lines:[{sku:"ELE-009",qty:20},{sku:"ELE-010",qty:5}] },
      { br:B2, emp:M2, cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:0,  date:d("2026-04-22",10,0),   lines:[{sku:"TRN-002",qty:20},{sku:"TRN-004",qty:15},{sku:"TRN-006",qty:15}] },
      // Apr 23
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-23",11,0),  lines:[{sku:"FIL-005",qty:3},{sku:"FIL-006",qty:4}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-23",14,0),  lines:[{sku:"BRA-008",qty:1},{sku:"BOD-007",qty:2}] },
      // Apr 25 ── BIG WHOLESALE: William Baloo (B1, ~107k)
      { br:B1, emp:M1, cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:1500, date:d("2026-04-25",9,0),
        lines:[{sku:"ENG-001",qty:15},{sku:"ENG-006",qty:15},{sku:"BRA-003",qty:30},{sku:"TYR-001",qty:40},{sku:"TRN-001",qty:20},{sku:"ELE-005",qty:15},{sku:"FIL-002",qty:20},{sku:"OIL-001",qty:30},{sku:"TRN-003",qty:20},{sku:"TRN-005",qty:20},{sku:"BOD-006",qty:5},{sku:"ENG-010",qty:10},{sku:"TRN-009",qty:20},{sku:"ELE-001",qty:10}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-25",13,0),  lines:[{sku:"OIL-001",qty:6},{sku:"OIL-002",qty:4}] },
      // Apr 26
      { br:B1, emp:C3, cust:"seed-c-009", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-04-26",10,0),  lines:[{sku:"ELE-003",qty:2},{sku:"ELE-007",qty:1}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-26",14,0),  lines:[{sku:"TYR-005",qty:2},{sku:"TYR-006",qty:2}] },
      // Apr 28
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-28",9,30),  lines:[{sku:"BOD-002",qty:1},{sku:"BOD-003",qty:2}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:50,   date:d("2026-04-28",11,30), lines:[{sku:"BRA-009",qty:3},{sku:"BRA-005",qty:4}] },
      // Apr 29
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-04-29",10,0),  lines:[{sku:"ENG-013",qty:3},{sku:"ENG-014",qty:2}] },
      { br:B2, emp:C5, cust:"seed-c-020", type:"RETAIL",  pay:"PAID",   disc:0,    date:d("2026-04-29",13,30), lines:[{sku:"FIL-001",qty:4},{sku:"OIL-003",qty:5}] },

      // ── MAY 2026 ──────────────────────────────────────────────────────────

      // May 2
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-02",9,0),   lines:[{sku:"TRN-010",qty:3},{sku:"TRN-011",qty:3},{sku:"TRN-012",qty:4}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-02",14,0),  lines:[{sku:"ENG-004",qty:2},{sku:"OIL-002",qty:4}] },
      // May 5
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-05",9,30),  lines:[{sku:"ELE-011",qty:3},{sku:"ELE-012",qty:2}] },
      { br:B1, emp:M1, cust:"seed-c-011", type:"WHOLESALE", pay:"CREDIT", disc:500, date:d("2026-05-05",10,0),  lines:[{sku:"BRA-001",qty:25},{sku:"BRA-002",qty:25},{sku:"BRA-004",qty:30},{sku:"BRA-007",qty:40}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-05",14,0),  lines:[{sku:"TYR-003",qty:10},{sku:"TYR-004",qty:5}] },
      // May 6
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-06",10,30), lines:[{sku:"ENG-017",qty:2},{sku:"ENG-018",qty:2}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-05-06",14,0),  lines:[{sku:"BOD-001",qty:3},{sku:"BOD-004",qty:2}] },
      // May 7
      { br:B1, emp:C1, cust:"seed-c-001", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-05-07",9,0),   lines:[{sku:"ELE-009",qty:30},{sku:"ELE-010",qty:8}] },
      { br:B2, emp:M2, cust:"seed-c-016", type:"WHOLESALE", pay:"CREDIT", disc:0,  date:d("2026-05-07",10,30), lines:[{sku:"TRN-001",qty:20},{sku:"TRN-002",qty:20},{sku:"TRN-009",qty:40}] },
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-07",15,0),  lines:[{sku:"FIL-004",qty:3},{sku:"FIL-005",qty:3}] },
      // May 8 ── BIG WHOLESALE: Mary Wanjiru (B2, ~104k)
      { br:B2, emp:M2, cust:"seed-c-015", type:"WHOLESALE", pay:"CREDIT", disc:1000, date:d("2026-05-08",9,0),
        lines:[{sku:"ENG-002",qty:20},{sku:"ENG-007",qty:20},{sku:"BRA-001",qty:40},{sku:"TYR-003",qty:50},{sku:"TRN-002",qty:30},{sku:"ELE-002",qty:20},{sku:"OIL-001",qty:50},{sku:"TRN-010",qty:10},{sku:"TRN-011",qty:10},{sku:"ENG-013",qty:10},{sku:"BOD-003",qty:10},{sku:"BOD-008",qty:5}] },
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-08",11,30), lines:[{sku:"OIL-001",qty:5},{sku:"OIL-004",qty:3}] },
      // May 9
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-09",9,30),  lines:[{sku:"ENG-003",qty:2},{sku:"ENG-009",qty:2}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-09",13,0),  lines:[{sku:"TRN-013",qty:2},{sku:"BOD-005",qty:2}] },
      // May 12
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-12",9,15),  lines:[{sku:"TYR-001",qty:5},{sku:"TYR-003",qty:10}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-12",10,30), lines:[{sku:"FIL-001",qty:3},{sku:"FIL-006",qty:4}] },
      { br:B1, emp:M1, cust:"seed-c-013", type:"WHOLESALE", pay:"CREDIT", disc:300, date:d("2026-05-12",11,0),  lines:[{sku:"ENG-005",qty:10},{sku:"ENG-012",qty:10},{sku:"TRN-007",qty:8}] },
      // May 13
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-13",10,0),  lines:[{sku:"ELE-004",qty:2},{sku:"ELE-006",qty:2}] },
      { br:B2, emp:C5, cust:"seed-c-023", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-05-13",14,0),  lines:[{sku:"BRA-008",qty:2},{sku:"BRA-009",qty:4}] },
      // May 14
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-14",9,30),  lines:[{sku:"OIL-002",qty:6},{sku:"OIL-003",qty:4}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-14",13,30), lines:[{sku:"BOD-006",qty:2},{sku:"BOD-007",qty:3}] },
      // May 15 ── BIG WHOLESALE: Elizabeth Njeri (B2, ~127k)
      { br:B2, emp:M2, cust:"seed-c-019", type:"WHOLESALE", pay:"CREDIT", disc:3000, date:d("2026-05-15",9,0),
        lines:[{sku:"ENG-003",qty:30},{sku:"BRA-002",qty:30},{sku:"TYR-002",qty:50},{sku:"ELE-003",qty:20},{sku:"ELE-005",qty:20},{sku:"OIL-001",qty:50},{sku:"TRN-008",qty:20},{sku:"TRN-014",qty:10}] },
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-15",11,0),  lines:[{sku:"ENG-011",qty:1},{sku:"OIL-005",qty:2}] },
      // May 16
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-16",9,0),   lines:[{sku:"TRN-004",qty:4},{sku:"TRN-006",qty:3}] },
      { br:B2, emp:C5, cust:"seed-c-022", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-05-16",11,30), lines:[{sku:"ELE-007",qty:2},{sku:"ELE-008",qty:3}] },
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-05-16",15,0),  lines:[{sku:"FIL-002",qty:4},{sku:"FIL-005",qty:4}] },
      // May 19
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-19",10,0),  lines:[{sku:"BRA-003",qty:3},{sku:"BRA-005",qty:4}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-19",13,0),  lines:[{sku:"TYR-006",qty:2},{sku:"TYR-007",qty:2}] },
      // May 20
      { br:B1, emp:M1, cust:"seed-c-006", type:"WHOLESALE", pay:"PAID",  disc:0,   date:d("2026-05-20",9,30),  lines:[{sku:"TRN-015",qty:5},{sku:"TRN-013",qty:5},{sku:"BOD-004",qty:10}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-20",14,0),  lines:[{sku:"ENG-019",qty:4},{sku:"ENG-020",qty:3}] },
      // May 21
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-21",9,15),  lines:[{sku:"ELE-011",qty:2},{sku:"ELE-012",qty:2}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-21",11,0),  lines:[{sku:"OIL-001",qty:8},{sku:"OIL-002",qty:5}] },
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:50,   date:d("2026-05-21",14,30), lines:[{sku:"BOD-001",qty:2},{sku:"BOD-007",qty:2}] },
      // May 22 ── BIG WHOLESALE: Daniel Kiprotich again (B1, ~116k)
      { br:B1, emp:M1, cust:"seed-c-006", type:"WHOLESALE", pay:"CREDIT", disc:1150, date:d("2026-05-22",9,0),
        lines:[{sku:"ENG-016",qty:25},{sku:"TRN-014",qty:9},{sku:"ELE-011",qty:30},{sku:"BRA-001",qty:30},{sku:"OIL-001",qty:40},{sku:"TRN-001",qty:20},{sku:"ENG-015",qty:10}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-22",13,30), lines:[{sku:"FIL-004",qty:3},{sku:"ENG-021",qty:4}] },
      // May 23
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-23",9,30),  lines:[{sku:"TYR-001",qty:6},{sku:"TYR-003",qty:8}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-23",11,0),  lines:[{sku:"BRA-004",qty:5},{sku:"BRA-007",qty:6}] },
      { br:B1, emp:C3, cust:"seed-c-005", type:"RETAIL",  pay:"PAID",   disc:0,    date:d("2026-05-23",15,30), lines:[{sku:"ELE-009",qty:10},{sku:"OIL-001",qty:5}] },
      // May 26
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-26",10,0),  lines:[{sku:"ENG-014",qty:3},{sku:"ENG-004",qty:2}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-26",13,30), lines:[{sku:"TRN-010",qty:4},{sku:"TRN-012",qty:4}] },
      // May 27
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-27",9,0),   lines:[{sku:"OIL-003",qty:6},{sku:"OIL-004",qty:4}] },
      { br:B2, emp:M2, cust:"seed-c-021", type:"WHOLESALE", pay:"CREDIT", disc:0,  date:d("2026-05-27",10,30), lines:[{sku:"TRN-002",qty:15},{sku:"BRA-001",qty:20},{sku:"OIL-001",qty:25}] },
      // May 28 ── BIG WHOLESALE: William Baloo again (B1, ~132k)
      { br:B1, emp:M1, cust:"seed-c-002", type:"WHOLESALE", pay:"CREDIT", disc:1500, date:d("2026-05-28",9,0),
        lines:[{sku:"TRN-015",qty:20},{sku:"ENG-018",qty:20},{sku:"BRA-003",qty:30},{sku:"TYR-001",qty:40},{sku:"ELE-001",qty:20},{sku:"ENG-010",qty:10},{sku:"OIL-001",qty:50},{sku:"TRN-003",qty:20},{sku:"TRN-005",qty:20},{sku:"BOD-006",qty:10}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-28",14,0),  lines:[{sku:"ENG-007",qty:2},{sku:"FIL-003",qty:3}] },
      // May 29
      { br:B1, emp:C2, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-29",10,0),  lines:[{sku:"BOD-002",qty:1},{sku:"BOD-005",qty:2}] },
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-29",11,30), lines:[{sku:"TYR-002",qty:4},{sku:"TYR-004",qty:3}] },
      { br:B1, emp:C3, cust:"seed-c-007", type:"RETAIL",  pay:"PAID",   disc:0,    date:d("2026-05-29",14,0),  lines:[{sku:"ENG-001",qty:2},{sku:"ELE-005",qty:1}] },
      // May 30
      { br:B1, emp:C4, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-05-30",9,30),  lines:[{sku:"FIL-006",qty:5},{sku:"FIL-001",qty:3}] },
      { br:B2, emp:C5, cust:null,       type:"RETAIL",    pay:"PAID",   disc:100,  date:d("2026-05-30",13,0),  lines:[{sku:"ELE-001",qty:1},{sku:"OIL-002",qty:4}] },

      // ── JUNE 2026 ─────────────────────────────────────────────────────────

      // Jun 2
      { br:B1, emp:C1, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-02",9,15),  lines:[{sku:"TRN-001",qty:3},{sku:"TRN-009",qty:6}] },
      { br:B2, emp:C7, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-02",10,30), lines:[{sku:"BRA-002",qty:4},{sku:"BRA-005",qty:5}] },
      { br:B1, emp:C2, cust:"seed-c-010", type:"RETAIL",  pay:"CREDIT", disc:0,    date:d("2026-06-02",14,0),  lines:[{sku:"ELE-002",qty:2},{sku:"ELE-007",qty:1}] },
      // Jun 3 (today)
      { br:B2, emp:C6, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-03",9,30),  lines:[{sku:"OIL-001",qty:5},{sku:"OIL-005",qty:2}] },
      { br:B1, emp:C3, cust:null,       type:"RETAIL",    pay:"PAID",   disc:0,    date:d("2026-06-03",11,0),  lines:[{sku:"ENG-001",qty:1},{sku:"ENG-006",qty:1},{sku:"FIL-002",qty:2}] },
      { br:B2, emp:M2, cust:"seed-c-014", type:"RETAIL",  pay:"PAID",   disc:0,    date:d("2026-06-03",14,0),  lines:[{sku:"TYR-003",qty:8},{sku:"TYR-001",qty:4},{sku:"ENG-003",qty:1}] },
    ];

    // Sort chronologically then assign receipt numbers + create
    specs.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const spec of specs) {
      const rcpNum = rcp(spec.date);
      const { ll, total, taxAmt } = calc(spec.lines, spec.type, spec.disc);
      await prisma.sale.upsert({
        where:  { receiptNumber: rcpNum },
        update: {},
        create: {
          receiptNumber: rcpNum,
          saleType: spec.type, paymentStatus: spec.pay,
          discountAmount: spec.disc, taxAmount: taxAmt, totalAmount: total,
          isVoid: false,
          customerId: spec.cust, employeeId: spec.emp, branchId: spec.br,
          createdAt: spec.date,
          items: { create: ll.map(l => ({ itemId: l.itemId, quantity: l.qty, unitPrice: l.unitPrice, subtotal: l.subtotal })) },
        },
      });
    }
    console.log(`✓ ${specs.length} sales`);

    // ── Credit Payments ────────────────────────────────────────────────────
    const cpSpecs = [
      { id:"seed-cp-01", cust:"seed-c-006", amt:50000, by:M1, date:d("2026-05-05",10,0),  notes:"Bank transfer — partial" },
      { id:"seed-cp-02", cust:"seed-c-006", amt:30000, by:M1, date:d("2026-05-20",9,0),   notes:"M-Pesa" },
      { id:"seed-cp-03", cust:"seed-c-002", amt:60000, by:M1, date:d("2026-05-10",10,0),  notes:"Bank transfer" },
      { id:"seed-cp-04", cust:"seed-c-002", amt:40000, by:C1, date:d("2026-05-26",9,30),  notes:"Cash settlement" },
      { id:"seed-cp-05", cust:"seed-c-015", amt:40000, by:M2, date:d("2026-05-20",9,0),   notes:"Bank transfer" },
      { id:"seed-cp-06", cust:"seed-c-019", amt:50000, by:M2, date:d("2026-05-28",10,0),  notes:"Cheque payment" },
      { id:"seed-cp-07", cust:"seed-c-008", amt:8000,  by:C1, date:d("2026-05-01",10,0),  notes:"Cash" },
      { id:"seed-cp-08", cust:"seed-c-004", amt:3500,  by:C2, date:d("2026-04-20",11,0),  notes:"M-Pesa" },
      { id:"seed-cp-09", cust:"seed-c-011", amt:12000, by:M1, date:d("2026-05-15",9,0),   notes:"Cash" },
      { id:"seed-cp-10", cust:"seed-c-021", amt:5000,  by:M2, date:d("2026-06-01",10,0),  notes:"M-Pesa" },
      { id:"seed-cp-11", cust:"seed-c-017", amt:2500,  by:C5, date:d("2026-04-25",11,0),  notes:"Cash" },
      { id:"seed-cp-12", cust:"seed-c-016", amt:6000,  by:C6, date:d("2026-05-19",10,0),  notes:"M-Pesa partial" },
      { id:"seed-cp-13", cust:"seed-c-013", amt:4000,  by:C2, date:d("2026-05-18",9,0),   notes:"Cash" },
      { id:"seed-cp-14", cust:"seed-c-001", amt:1500,  by:C1, date:d("2026-05-12",10,0),  notes:"M-Pesa" },
      { id:"seed-cp-15", cust:"seed-c-022", amt:2000,  by:C7, date:d("2026-05-20",14,0),  notes:"Cash" },
    ];
    for (const cp of cpSpecs)
      await prisma.creditPayment.upsert({ where: { id: cp.id }, update: {}, create: { id: cp.id, customerId: cp.cust, amount: cp.amt, notes: cp.notes, recordedById: cp.by, createdAt: cp.date } });
    console.log(`✓ ${cpSpecs.length} credit payments`);

    // ── Recalculate credit balances ────────────────────────────────────────
    for (const cust of custSpecs) {
      const owed = specs.filter(s => s.cust === cust.id && s.pay === "CREDIT").reduce((sum, s) => sum + calc(s.lines, s.type, s.disc).total, 0);
      const paid = cpSpecs.filter(p => p.cust === cust.id).reduce((sum, p) => sum + p.amt, 0);
      const bal  = Math.max(0, owed - paid);
      if (bal > 0) await prisma.customer.update({ where: { id: cust.id }, data: { creditBalance: bal } });
    }
    console.log("✓ Credit balances updated");
  }

  // ── Purchase Orders ───────────────────────────────────────────────────────
  const existPOs = await prisma.purchaseOrder.count({ where: { id: { startsWith: "seed-po-" } } });
  if (existPOs > 0) {
    console.log(`✓ POs already seeded (${existPOs})`);
  } else {
    const poData = [
      { id:"seed-po-01", sup:sup1.id, sku:"ENG-001", qty:200, cost:580,  by:M1, br:B1, date:d("2026-03-01",10,0) },
      { id:"seed-po-02", sup:sup1.id, sku:"ENG-003", qty:200, cost:600,  by:M1, br:B1, date:d("2026-03-01",10,0) },
      { id:"seed-po-03", sup:sup1.id, sku:"ENG-016", qty:150, cost:960,  by:M1, br:B1, date:d("2026-03-05",9,0)  },
      { id:"seed-po-04", sup:sup1.id, sku:"ELE-003", qty:80,  cost:780,  by:M2, br:B2, date:d("2026-03-08",10,0) },
      { id:"seed-po-05", sup:sup2.id, sku:"BRA-001", qty:300, cost:260,  by:M1, br:B1, date:d("2026-03-12",9,0)  },
      { id:"seed-po-06", sup:sup2.id, sku:"BRA-002", qty:250, cost:240,  by:M2, br:B2, date:d("2026-03-12",9,0)  },
      { id:"seed-po-07", sup:sup3.id, sku:"TYR-003", qty:400, cost:110,  by:M1, br:B1, date:d("2026-03-15",10,0) },
      { id:"seed-po-08", sup:sup3.id, sku:"TYR-001", qty:250, cost:170,  by:M2, br:B2, date:d("2026-03-15",10,0) },
      { id:"seed-po-09", sup:sup4.id, sku:"OIL-001", qty:500, cost:230,  by:M1, br:B1, date:d("2026-03-20",9,0)  },
      { id:"seed-po-10", sup:sup4.id, sku:"OIL-002", qty:400, cost:250,  by:M2, br:B2, date:d("2026-03-20",9,0)  },
      { id:"seed-po-11", sup:sup1.id, sku:"ELE-001", qty:80,  cost:810,  by:M1, br:B1, date:d("2026-04-01",10,0) },
      { id:"seed-po-12", sup:sup2.id, sku:"TRN-014", qty:50,  cost:2300, by:M1, br:B1, date:d("2026-04-05",9,0)  },
      { id:"seed-po-13", sup:sup2.id, sku:"TRN-015", qty:60,  cost:1200, by:M2, br:B2, date:d("2026-04-10",10,0) },
      { id:"seed-po-14", sup:sup4.id, sku:"FIL-002", qty:200, cost:190,  by:M1, br:B1, date:d("2026-04-15",9,0)  },
      { id:"seed-po-15", sup:sup1.id, sku:"ENG-015", qty:40,  cost:1450, by:M1, br:B1, date:d("2026-04-20",10,0) },
      { id:"seed-po-16", sup:sup2.id, sku:"BOD-006", qty:50,  cost:1180, by:M2, br:B2, date:d("2026-04-25",9,0)  },
      { id:"seed-po-17", sup:sup3.id, sku:"TYR-002", qty:300, cost:185,  by:M2, br:B2, date:d("2026-05-01",10,0) },
      { id:"seed-po-18", sup:sup1.id, sku:"ELE-005", qty:100, cost:560,  by:M1, br:B1, date:d("2026-05-10",9,0)  },
      { id:"seed-po-19", sup:sup4.id, sku:"OIL-001", qty:300, cost:230,  by:M2, br:B2, date:d("2026-05-15",10,0) },
      { id:"seed-po-20", sup:sup2.id, sku:"BRA-003", qty:250, cost:255,  by:M1, br:B1, date:d("2026-05-20",9,0)  },
    ];
    for (const po of poData)
      await prisma.purchaseOrder.create({ data: { id: po.id, supplierId: po.sup, itemId: iMap[po.sku].id, quantity: po.qty, costPrice: po.cost, recordedById: po.by, branchId: po.br, createdAt: po.date } });
    console.log(`✓ ${poData.length} purchase orders`);
  }

  console.log("\n✅ Seed complete!\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" LOGIN CREDENTIALS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" ADMIN");
  console.log("   admin@jsh.co.ke              admin123");
  console.log("");
  console.log(" MANAGERS");
  console.log("   lucy.wangare@jsh.co.ke        manager123   (Mukai Branch)");
  console.log("   peter.kamau@jsh.co.ke         manager123   (Zulu Arcade Branch)");
  console.log("");
  console.log(" CASHIERS — Mukai Branch");
  console.log("   mary.akinyi@jsh.co.ke         cashier123");
  console.log("   james.otieno@jsh.co.ke        cashier123");
  console.log("   brian.kiptoo@jsh.co.ke        cashier123");
  console.log("   susan.chebet@jsh.co.ke        cashier123");
  console.log("");
  console.log(" CASHIERS — Zulu Arcade Branch");
  console.log("   david.mwangi@jsh.co.ke        cashier123");
  console.log("   faith.njoroge@jsh.co.ke       cashier123");
  console.log("   kevin.njoroge@jsh.co.ke       cashier123");
  console.log("═══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
