/** Deterministic generator for the demo's three fake supplier feeds.
 *  Seeded RNG -> identical output on every run, so reviewers can
 *  regenerate `data/raw/` and diff.
 *
 *  Run: npm run generate */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, "..", "raw");

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261029);
const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

const BRANDS = ["Nordal", "Kestra", "Vermona", "Deltree", "Oskar"];
const MODELS: Record<string, string[]> = {
  "standing desk": ["LiftDesk", "FlexiRise", "StandPro", "ErgoLift", "UpRight"],
  "desk chair": ["ErgoSit", "PostureFlex", "SwivelPro", "BackForm", "ComfyTask"],
  "monitor arm": ["ArmReach", "ViewLift", "FlexMount", "ScreenHold", "ProArm"],
  "desk lamp": ["LumiTask", "GlowBar", "BrightArc", "SoftBeam", "FocusLite"],
  "bookshelf": ["StackLine", "OpenShelv", "BookCase", "TierRack", "ShelfMax"],
  "filing cabinet": ["DocuStor", "FileSafe", "ArchivPro", "DrawerLine", "Cabinetix"],
};
const CATEGORIES = Object.keys(MODELS);
const DESCS: Record<string, string[]> = {
  "standing desk": [
    "Height-adjustable standing desk, {s}cm top, dual motor.",
    "Electric sit-stand desk {s}cm, memory controller, anti-collision.",
  ],
  "desk chair": [
    "Ergonomic task chair, lumbar support, adjustable arms.",
    "Mesh-back desk chair, synchronous tilt, seat depth adjustment.",
  ],
  "monitor arm": [
    "Single monitor arm, gas spring, VESA 75/100.",
    "Desk-mounted monitor arm, cable management, 2-9kg.",
  ],
  "desk lamp": [
    "LED desk lamp, dimmable, 3 color temperatures.",
    "Architect desk lamp, clamp mount, flicker-free.",
  ],
  "bookshelf": [
    "Open bookshelf, {s} tiers, powder-coated steel frame.",
    "Freestanding shelving unit, {s} levels, oak effect.",
  ],
  "filing cabinet": [
    "Lockable filing cabinet, {s} drawers, ball-bearing slides.",
    "Under-desk pedestal, {s} drawers, anti-tilt mechanism.",
  ],
};

interface Canon { name: string; brand: string; category: string; eurCents: number; stock: number; desc: string }

function canonName(brand: string, cat: string, i: number): string {
  const model = MODELS[cat][i % MODELS[cat].length];
  if (cat === "standing desk") return `${brand} ${model} ${pick([120, 140, 160, 180])}cm`;
  if (cat === "bookshelf" || cat === "filing cabinet") return `${brand} ${model} ${pick([2, 3, 4, 5])}`;
  return `${brand} ${model}`;
}

function canonDesc(cat: string): string {
  return pick(DESCS[cat]).replace("{s}", String(pick([120, 140, 160, 3, 4])));
}

/** Build the canonical product universe (~70 unique products). */
function buildUniverse(n: number): Canon[] {
  const out: Canon[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (out.length < n) {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const brand = pick(BRANDS);
    const name = canonName(brand, cat, i);
    if (seen.has(name)) { i++; continue; }
    seen.add(name);
    out.push({
      name, brand, category: cat,
      eurCents: int(4_900, 89_900),
      stock: int(0, 40),
      desc: canonDesc(cat),
    });
    i++;
  }
  return out;
}

/** Reword a product name for a cross-supplier near-duplicate. */
function reword(name: string, brand: string): string {
  const stripped = name.replace(brand, "").trim();
  const words = stripped.split(/\s+/).reverse();
  return pick([`${words.join(" ")} ${brand}`, `${brand} ${words.join(" ")}`]);
}

const universe = buildUniverse(70);

// ---------- supplier-a: CSV, USD prices, mostly clean ----------
const aRows: string[] = ["item_name,brand,category,cost_usd,stock,tags"];
const usd = (eurCents: number) => ((eurCents / 100) * 1.08).toFixed(2);
const aProducts = universe.slice(0, 34);
for (const p of aProducts) {
  aRows.push(`${p.name},${p.brand},${p.category},${usd(p.eurCents)},${p.stock},office;${p.category.replace(/ /g, "-")}`);
}
// a-side of cross-supplier near-duplicates (also appear in b/c reworded)
const crossA = universe.slice(34, 38);
for (const p of crossA) {
  aRows.push(`${p.name},${p.brand},${p.category},${usd(p.eurCents)},${p.stock},office;${p.category.replace(/ /g, "-")}`);
}
// supplier-a defects: 3
aRows.push(`${aProducts[0].name},${aProducts[0].brand},${aProducts[0].category},${usd(aProducts[0].eurCents)},-3,office`);
aRows.push(`${aProducts[1].name},${aProducts[1].brand},${aProducts[1].category},0.00,12,office`);
aRows.push(`,${aProducts[2].brand},${aProducts[2].category},${usd(aProducts[2].eurCents)},7,office`);

// ---------- supplier-b: JSON, nested, EUR strings, HTML ----------
const bProducts = universe.slice(20, 50);
const bRows = bProducts.map((p, i) => {
  const base = {
    id: `b-${1000 + i}`,
    product: { title: p.name, maker: p.brand },
    pricing: {
      amount: `€${(p.eurCents / 100).toFixed(2).replace(".", ",")}`,
      currency: "EUR",
      unit: "units",
    },
    desc_html: `<p>${p.desc.replace(/^./, (c) => c.toUpperCase())} <b>${p.brand}</b> quality.</p>`,
    inventory: { count: p.stock },
    lead_time_days: int(2, 14),
    _internal_sku: `SKU-${int(10000, 99999)}`,
  };
  return base;
});
// one record whose price is in cents — normalize must divide by 100
(bRows[4].pricing as { amount: unknown; unit: string }).amount = bProducts[4].eurCents;
(bRows[4].pricing as { unit: string }).unit = "cents";
// supplier-b defects: 7
(bRows[6].pricing as { amount: unknown }).amount = null;                       // missing price
(bRows[9].pricing as { amount: unknown }).amount = null;                       // missing price
(bRows[12].pricing as { unit: string }).unit = "dollars";                      // ambiguous unit
(bRows[15].pricing as { unit: string }).unit = "dollars";                      // ambiguous unit
(bRows[18].product as { title: string }).title = "";                           // empty title
(bRows[21].pricing as { amount: unknown }).amount = "-50,00";                  // negative price
(bRows[24].pricing as { amount: unknown }).amount = "on request";              // unparseable price

// ---------- supplier-c: JSONL, inconsistent keys, dirtiest feed ----------
const cProducts = universe.slice(40, 55);
const crossFromA = universe.slice(34, 38);       // same products as crossA, reworded
const crossFromB = universe.slice(44, 48);       // same products as in b feed, reworded
const cLines: Record<string, unknown>[] = [];

let ci = 0;
const cId = () => `c-${200 + ci++}`;
const pushGood = (p: Canon, reworded: boolean) => {
  const name = reworded ? reword(p.name, p.brand) : p.name;
  const variant = ci % 3;
  if (variant === 0) {
    cLines.push({ id: cId(), name, price_eur: p.eurCents / 100, qty: p.stock, vendor: p.brand, cat: p.category, desc: p.desc });
  } else if (variant === 1) {
    cLines.push({ id: cId(), title: name, cost: `EUR ${(p.eurCents / 100).toFixed(2)}`, quantity: p.stock, brand: p.brand, category_text: p.category, notes: p.desc });
  } else {
    cLines.push({ id: cId(), name, price: p.eurCents / 100, stock: p.stock, vendor: p.brand, category: p.category, notes: p.desc });
  }
};
for (const p of cProducts) pushGood(p, false);
for (const p of crossFromA) pushGood(p, true);
for (const p of crossFromB) pushGood(p, true);

// exact duplicates inside supplier-c: 5 rows repeated verbatim, new ids
for (const p of cProducts.slice(0, 5)) {
  cLines.push({ id: cId(), name: p.name, price_eur: p.eurCents / 100, qty: p.stock, vendor: p.brand, cat: p.category, desc: p.desc });
}

// supplier-c defects: 21
const defects: Record<string, unknown>[] = [
  { id: cId(), name: null, price_eur: 120, qty: 4, vendor: "Nordal", cat: "desk lamp" },
  { id: cId(), price_eur: 340, qty: 2, vendor: "Kestra", cat: "standing desk" },            // no name key
  { id: cId(), name: "", price_eur: 88, qty: 9, vendor: "Vermona", cat: "bookshelf" },
  { id: cId(), name: "   ", price: 55, stock: 3, vendor: "Deltree", category: "desk lamp" },
  { id: cId(), title: "Oskar DockLamp", price_eur: "call us", qty: 6, vendor: "Oskar", cat: "desk lamp" },
  { id: cId(), name: "Kestra TradeChair", cost: "call us", quantity: 11, brand: "Kestra", category_text: "desk chair" },
  { id: cId(), name: "Vermona BulkShelf", price_eur: "TBD", qty: 2, vendor: "Vermona", cat: "bookshelf" },
  { id: cId(), name: "Deltree QuoteDesk", price: "TBD", stock: 1, vendor: "Deltree", category: "standing desk" },
  { id: cId(), name: "Nordal StockArm", price_eur: 65, qty: "many", vendor: "Nordal", cat: "monitor arm" },
  { id: cId(), name: "Kestra PlentyChair", price_eur: 210, qty: "plenty", vendor: "Kestra", cat: "desk chair" },
  { id: cId(), name: "Oskar NegDesk", price_eur: -199, qty: 5, vendor: "Oskar", cat: "standing desk" },
  { id: cId(), name: "Vermona MinusLamp", price: -40, stock: 8, vendor: "Vermona", category: "desk lamp" },
  { id: cId(), name: "Deltree MegaDesk 9000", price_eur: 99999999, qty: 1, vendor: "Deltree", cat: "standing desk" },
  { id: cId(), name: "Nordal NoStock", price_eur: 130, vendor: "Nordal", cat: "desk lamp" },        // no stock key
  { id: cId(), name: "Kestra VoidPrice", qty: 4, vendor: "Kestra", cat: "desk chair" },            // no price key
  { id: cId(), name: "Oskar GhostShelf", qty: 2, vendor: "Oskar", cat: "bookshelf" },              // no price key
  { id: cId(), name: "Vermona MysteryArm", price_eur: 75, qty: 3, vendor: "Vermona" },             // no category
  { id: cId(), name: 42, price_eur: 99, qty: 7, vendor: "Deltree", cat: "desk lamp" },             // name wrong type
  { id: cId(), name: "Nordal OddStock", price_eur: 145, qty: "12ish", vendor: "Nordal", cat: "desk lamp" },
  { id: cId(), name: "Kestra WeirdCat", price_eur: 300, qty: 2, vendor: "Kestra", cat: "banana" }, // unknown category
  { id: cId(), name: "Oskar BlankBrand", price_eur: 150, qty: 6, cat: "bookshelf" },               // no brand/vendor
];
cLines.push(...defects);

// ---------- write ----------
mkdirSync(RAW, { recursive: true });
writeFileSync(join(RAW, "supplier-a.csv"), aRows.join("\n") + "\n");
writeFileSync(join(RAW, "supplier-b.json"), JSON.stringify(bRows, null, 2) + "\n");
writeFileSync(join(RAW, "supplier-c.jsonl"), cLines.map((l) => JSON.stringify(l)).join("\n") + "\n");

console.log(`wrote supplier-a.csv  (${aRows.length - 1} rows)`);
console.log(`wrote supplier-b.json (${bRows.length} rows)`);
console.log(`wrote supplier-c.jsonl (${cLines.length} rows)`);
console.log(`total raw records: ${aRows.length - 1 + bRows.length + cLines.length}`);
