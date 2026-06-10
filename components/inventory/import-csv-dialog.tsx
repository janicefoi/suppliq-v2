"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Download, CheckCircle2, XCircle, AlertTriangle,
  FileText, Loader2, X,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { importItems, type ImportItemRow, type ImportSummary } from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";

// ── CSV parsing ────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuote = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ",") { fields.push(cur); cur = ""; }
        else { cur += ch; }
      }
    }
    fields.push(cur);
    rows.push(fields);
  }
  return rows;
}

const COL_ALIASES: Record<keyof ImportItemRow, string[]> = {
  name:          ["name", "item name", "product name", "item", "product"],
  sku:           ["sku", "code", "item code", "product code", "barcode"],
  category:      ["category", "category name", "dept", "department", "type"],
  retailPrice:   ["retail_price", "retail price", "retail", "price", "selling price", "sale price"],
  wholesalePrice:["wholesale_price", "wholesale price", "wholesale", "trade price"],
  costPrice:     ["cost_price", "cost price", "cost", "purchase price", "buy price"],
  unit:          ["unit", "uom", "unit of measure"],
  reorderPoint:  ["reorder_point", "reorder point", "reorder", "min stock", "low stock"],
  initialStock:  ["initial_stock", "initial stock", "opening stock", "stock", "qty", "quantity"],
  description:   ["description", "desc", "notes", "details"],
};

function mapHeader(h: string): keyof ImportItemRow | null {
  const normalized = h.trim().toLowerCase().replace(/[^a-z0-9 _]/g, "");
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    if (aliases.includes(normalized)) return field as keyof ImportItemRow;
  }
  return null;
}

export type ParsedRow = ImportItemRow & {
  _row: number;
  _errors: string[];
  _raw: Record<string, string>;
};

function toNum(v: string | undefined): number | undefined {
  if (!v?.trim()) return undefined;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

function parseRows(csv: string[][]): ParsedRow[] {
  if (csv.length < 2) return [];
  const headers = csv[0].map(mapHeader);
  const result: ParsedRow[] = [];

  for (let i = 1; i < csv.length; i++) {
    const cols = csv[i];
    if (cols.every((c) => !c.trim())) continue;

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) raw[h] = cols[idx]?.trim() ?? ""; });

    const errors: string[] = [];
    const name = raw.name?.trim() ?? "";
    if (!name) errors.push("Name is required");

    const retailPrice = toNum(raw.retailPrice);
    if (!retailPrice || retailPrice <= 0) errors.push("Retail price must be > 0");

    const wholesalePrice = toNum(raw.wholesalePrice);
    const costPrice = toNum(raw.costPrice);
    const reorderPoint = toNum(raw.reorderPoint);
    const initialStock = toNum(raw.initialStock);

    result.push({
      _row: i,
      _errors: errors,
      _raw: raw,
      name,
      sku: raw.sku?.trim() || undefined,
      category: raw.category?.trim() || undefined,
      retailPrice: retailPrice ?? 0,
      wholesalePrice,
      costPrice,
      unit: raw.unit?.trim() || undefined,
      reorderPoint,
      initialStock,
      description: raw.description?.trim() || undefined,
    });
  }
  return result;
}

// ── Template download ──────────────────────────────────────────────────────

function downloadTemplate() {
  const header = "name,sku,category,retail_price,wholesale_price,cost_price,unit,reorder_point,initial_stock,description";
  const sample = [
    "Premium Cardboard Box,,Packaging,2.50,2.00,1.20,pcs,50,200,Double-wall corrugated",
    "LED Panel 60x60,,Lighting,45.00,38.00,22.00,pcs,10,0,",
    "Industrial Drill Bit Set,,Tools,29.99,24.99,12.50,set,5,0,10-piece HSS set",
  ];
  const csv = [header, ...sample].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "suppliq-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────

type Phase = "upload" | "preview" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportCsvDialog({ open, onClose, onImported }: Props) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase("upload");
    setFileName(null);
    setRows([]);
    setPending(false);
    setSummary(null);
    setServerError(null);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      alert("Please upload a .csv file.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const csv = parseCSV(text);
      const parsed = parseRows(csv);
      if (!parsed.length) {
        alert("No data rows found in the CSV. Check the file has a header row and at least one data row.");
        return;
      }
      setRows(parsed);
      setPhase("preview");
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const validRows = rows.filter((r) => r._errors.length === 0);
  const invalidRows = rows.filter((r) => r._errors.length > 0);

  async function handleImport() {
    if (!validRows.length) return;
    setPending(true);
    setServerError(null);

    // Strip internal fields before sending
    const payload: ImportItemRow[] = validRows.map(({ _row, _errors, _raw, ...rest }) => rest);
    const result = await importItems(payload);
    setPending(false);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    setSummary(result.summary);
    setPhase("done");
    onImported();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <SheetTitle className="text-base font-semibold">Import inventory from CSV</SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            {phase === "upload" && "Upload a CSV file to bulk-create inventory items."}
            {phase === "preview" && `${rows.length} rows found — ${validRows.length} valid, ${invalidRows.length} with errors.`}
            {phase === "done" && "Import complete."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Upload phase ─────────────────────────────── */}
          {phase === "upload" && (
            <div className="space-y-5">
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-14 px-6 text-center cursor-pointer transition-colors",
                  isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className={cn("h-8 w-8 mb-3", isDragging ? "text-blue-500" : "text-slate-400")} />
                <p className="text-sm font-medium text-slate-700">Drop your CSV here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Only .csv files are supported</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">CSV format</p>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={downloadTemplate}>
                    <Download className="h-3 w-3" />
                    Download template
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 pr-4 font-semibold text-slate-600">Column</th>
                        <th className="text-left py-1.5 pr-4 font-semibold text-slate-600">Required</th>
                        <th className="text-left py-1.5 font-semibold text-slate-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-500 divide-y divide-slate-50">
                      {[
                        ["name", true, "Item display name"],
                        ["sku", false, "Auto-generated if blank"],
                        ["category", false, "Created automatically if new"],
                        ["retail_price", true, "Selling price to customers"],
                        ["wholesale_price", false, "Defaults to retail price"],
                        ["cost_price", false, "Your purchase cost"],
                        ["unit", false, "e.g. pcs, kg, box (default: pcs)"],
                        ["reorder_point", false, "Low-stock alert threshold (default: 10)"],
                        ["initial_stock", false, "Opening stock for your branch (default: 0)"],
                        ["description", false, "Optional notes"],
                      ].map(([col, req, note]) => (
                        <tr key={col as string}>
                          <td className="py-1.5 pr-4 font-mono text-slate-700">{col as string}</td>
                          <td className="py-1.5 pr-4">
                            {req ? (
                              <span className="text-red-500 font-semibold">required</span>
                            ) : (
                              <span className="text-slate-400">optional</span>
                            )}
                          </td>
                          <td className="py-1.5">{note as string}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Preview phase ─────────────────────────────── */}
          {phase === "preview" && (
            <div className="space-y-4">
              {invalidRows.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm font-semibold text-amber-800">
                      {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} will be skipped
                    </p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Fix the errors in your CSV and re-upload, or continue to import only the valid rows.
                  </p>
                </div>
              )}

              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-600">
                    {fileName} &mdash; {rows.length} rows
                  </p>
                  <button
                    onClick={reset}
                    className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Change file
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white border-b border-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold w-8">#</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold min-w-[160px]">Name</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold w-24">SKU</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold w-24">Category</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-semibold w-24">Retail</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-semibold w-24">Wholesale</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-semibold w-20">Stock</th>
                        <th className="px-3 py-2 w-6" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((row) => {
                        const hasErr = row._errors.length > 0;
                        return (
                          <tr
                            key={row._row}
                            className={cn(
                              "transition-colors",
                              hasErr ? "bg-red-50/60" : "hover:bg-slate-50/60"
                            )}
                          >
                            <td className="px-3 py-2 text-slate-400">{row._row}</td>
                            <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[160px]">
                              {row.name || <span className="text-red-400 italic">missing</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500 font-mono">
                              {row.sku || <span className="text-slate-300">auto</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500">{row.category || "-"}</td>
                            <td className="px-3 py-2 text-right text-slate-700">
                              {row.retailPrice > 0 ? row.retailPrice.toFixed(2) : (
                                <span className="text-red-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500">
                              {row.wholesalePrice ? row.wholesalePrice.toFixed(2) : "-"}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-500">
                              {row.initialStock ?? 0}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {hasErr ? (
                                <span title={row._errors.join("; ")}>
                                  <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />
                                </span>
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {invalidRows.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600">Errors</p>
                  {invalidRows.map((r) => (
                    <div key={r._row} className="flex gap-2 text-xs text-red-600">
                      <span className="text-slate-400 shrink-0">Row {r._row}:</span>
                      <span>{r._errors.join("; ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Done phase ────────────────────────────────── */}
          {phase === "done" && summary && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">Import complete</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-semibold text-green-600">{summary.imported}</span> item{summary.imported !== 1 ? "s" : ""} imported
                  {summary.skipped > 0 && (
                    <>, <span className="font-semibold text-amber-600">{summary.skipped}</span> skipped</>
                  )}
                </p>
              </div>

              {summary.errors.length > 0 && (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Skipped rows</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {summary.errors.map((e, i) => (
                      <div key={i} className="flex gap-2 text-xs text-amber-700">
                        <span className="text-slate-400 shrink-0">Row {e.row} ({e.name}):</span>
                        <span>{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleClose} className="mt-2">Done</Button>
            </div>
          )}
        </div>

        {/* ── Footer actions ──────────────────────────────────────────────── */}
        {phase === "preview" && (
          <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3 bg-white shrink-0">
            <div className="text-xs text-slate-500">
              <span className="text-green-600 font-semibold">{validRows.length}</span> valid
              {invalidRows.length > 0 && (
                <>, <span className="text-red-500 font-semibold">{invalidRows.length}</span> will be skipped</>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Back
              </Button>
              <Button
                size="sm"
                disabled={pending || validRows.length === 0}
                onClick={handleImport}
                className="gap-1.5"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pending
                  ? "Importing..."
                  : `Import ${validRows.length} item${validRows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
