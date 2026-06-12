"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Download, CheckCircle2, XCircle, AlertTriangle,
  Loader2, X,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImportRow = Record<string, string>;

export type ImportResult = {
  imported: number;
  skipped: Array<{ row: number; value: string; reason: string }>;
  passwords?: Array<{ name: string; email: string; password: string }>;
};

export interface FormatCol {
  key: string;
  required: boolean;
  note: string;
}

export interface PreviewCol {
  key: string;
  label: string;
  align?: "right";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  formatCols: FormatCol[];
  previewCols: PreviewCol[];
  exampleRows: string[][];
  onImport: (rows: ImportRow[]) => Promise<ImportResult>;
}

// ── CSV parser ─────────────────────────────────────────────────────────────

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

type ParsedRow = { row: number; errors: string[]; data: ImportRow };

function buildRows(csv: string[][], requiredKeys: string[]): ParsedRow[] {
  if (csv.length < 2) return [];
  const headers = csv[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const result: ParsedRow[] = [];

  for (let i = 1; i < csv.length; i++) {
    const cols = csv[i];
    if (cols.every((c) => !c.trim())) continue;
    const data: ImportRow = {};
    headers.forEach((h, idx) => { data[h] = cols[idx]?.trim() ?? ""; });

    const errors = requiredKeys
      .filter((k) => !data[k])
      .map((k) => `${k} is required`);

    result.push({ row: i, errors, data });
  }
  return result;
}

// ── Template download ──────────────────────────────────────────────────────

function downloadTemplate(formatCols: FormatCol[], exampleRows: string[][], filename: string) {
  const header = formatCols.map((c) => c.key).join(",");
  const examples = exampleRows.map((r) =>
    r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(",")
  );
  const csv = [header, ...examples].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────

type Phase = "upload" | "preview" | "done";

export function CsvImportDialog({
  open, onClose, onSuccess,
  title, formatCols, previewCols, exampleRows, onImport,
}: Props) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const requiredKeys = formatCols.filter((c) => c.required).map((c) => c.key);
  const templateFilename = title.toLowerCase().replace(/\s+/g, "_") + "_template.csv";

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  function reset() {
    setPhase("upload");
    setFileName(null);
    setRows([]);
    setPending(false);
    setResult(null);
    setServerError(null);
    if (fileRef.current) fileRef.current.value = "";
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
      const parsed = buildRows(csv, requiredKeys);
      if (!parsed.length) {
        alert("No data rows found. Check the file has a header row and at least one data row.");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport() {
    if (!validRows.length) return;
    setPending(true);
    setServerError(null);
    const payload = validRows.map((r) => r.data);
    const res = await onImport(payload);
    setPending(false);
    setResult(res);
    setPhase("done");
    onSuccess();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            {phase === "upload" && "Upload a CSV file to bulk-create records."}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => downloadTemplate(formatCols, exampleRows, templateFilename)}
                  >
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
                      {formatCols.map(({ key, required, note }) => (
                        <tr key={key}>
                          <td className="py-1.5 pr-4 font-mono text-slate-700">{key}</td>
                          <td className="py-1.5 pr-4">
                            {required
                              ? <span className="text-red-500 font-semibold">required</span>
                              : <span className="text-slate-400">optional</span>}
                          </td>
                          <td className="py-1.5">{note}</td>
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
                        {previewCols.map((c) => (
                          <th
                            key={c.key}
                            className={cn(
                              "px-3 py-2 text-slate-500 font-semibold",
                              c.align === "right" ? "text-right" : "text-left"
                            )}
                          >
                            {c.label}
                          </th>
                        ))}
                        <th className="px-3 py-2 w-6" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((r) => {
                        const hasErr = r.errors.length > 0;
                        return (
                          <tr
                            key={r.row}
                            className={cn(
                              "transition-colors",
                              hasErr ? "bg-red-50/60" : "hover:bg-slate-50/60"
                            )}
                          >
                            <td className="px-3 py-2 text-slate-400">{r.row}</td>
                            {previewCols.map((c) => {
                              const val = r.data[c.key];
                              const isMissing = requiredKeys.includes(c.key) && !val;
                              return (
                                <td
                                  key={c.key}
                                  className={cn(
                                    "px-3 py-2 max-w-[160px] truncate",
                                    c.align === "right" && "text-right",
                                    isMissing ? "text-red-400 italic" : "text-slate-700"
                                  )}
                                >
                                  {isMissing
                                    ? <span className="text-red-400 italic">missing</span>
                                    : val || <span className="text-slate-300">-</span>}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center">
                              {hasErr ? (
                                <span title={r.errors.join("; ")}>
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
                    <div key={r.row} className="flex gap-2 text-xs text-red-600">
                      <span className="text-slate-400 shrink-0">Row {r.row}:</span>
                      <span>{r.errors.join("; ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Done phase ─────────────────────────────── */}
          {phase === "done" && result && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">Import complete</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-semibold text-green-600">{result.imported}</span>{" "}
                  record{result.imported !== 1 ? "s" : ""} imported
                  {result.skipped.length > 0 && (
                    <>, <span className="font-semibold text-amber-600">{result.skipped.length}</span> skipped</>
                  )}
                </p>
              </div>

              {result.skipped.length > 0 && (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-amber-800 mb-2">Skipped rows</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.skipped.map((s, i) => (
                      <div key={i} className="flex gap-2 text-xs text-amber-700">
                        <span className="text-slate-400 shrink-0">
                          Row {s.row}{s.value ? ` (${s.value})` : ""}:
                        </span>
                        <span>{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.passwords && result.passwords.length > 0 && (
                <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Temporary passwords</p>
                  <p className="text-xs text-blue-600 mb-2">
                    Share these with your employees. They should change their password after first login.
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-blue-100 bg-white text-xs">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Name</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Email</th>
                          <th className="px-2 py-1.5 text-left font-semibold text-slate-500">Temp password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.passwords.map((p, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-2 py-1.5 text-slate-700">{p.name}</td>
                            <td className="px-2 py-1.5 text-slate-500">{p.email}</td>
                            <td className="px-2 py-1.5 font-mono font-semibold text-slate-800">{p.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button onClick={handleClose} className="mt-2">Done</Button>
            </div>
          )}
        </div>

        {/* ── Footer — preview only ───────────────────────────────────────── */}
        {phase === "preview" && (
          <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3 bg-white shrink-0">
            <div className="text-xs text-slate-500">
              <span className="text-green-600 font-semibold">{validRows.length}</span> valid
              {invalidRows.length > 0 && (
                <>, <span className="text-red-500 font-semibold">{invalidRows.length}</span> will be skipped</>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Back</Button>
              <Button
                size="sm"
                disabled={pending || validRows.length === 0}
                onClick={handleImport}
                className="gap-1.5"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pending
                  ? "Importing..."
                  : `Import ${validRows.length} row${validRows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
