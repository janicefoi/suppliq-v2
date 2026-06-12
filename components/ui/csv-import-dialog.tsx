"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, Download, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ImportRow = Record<string, string>;

export type ImportResult = {
  imported: number;
  skipped: Array<{ row: number; value: string; reason: string }>;
  passwords?: Array<{ name: string; email: string; password: string }>;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  requiredHeaders: string[];
  optionalHeaders?: string[];
  exampleRow: string[];
  onImport: (rows: ImportRow[]) => Promise<ImportResult>;
  notes?: string;
}

function downloadTemplate(headers: string[], optionalHeaders: string[], example: string[], filename: string) {
  const allHeaders = [...headers, ...optionalHeaders];
  const examplePadded = [...example, ...Array(optionalHeaders.length).fill("")];
  const csv = [allHeaders.join(","), examplePadded.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImportDialog({
  open,
  onClose,
  onSuccess,
  title,
  requiredHeaders,
  optionalHeaders = [],
  exampleRow,
  onImport,
  notes,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const allHeaders = [...requiredHeaders, ...optionalHeaders];

  function reset() {
    setRows([]);
    setParseError(null);
    setResult(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    if (result?.imported) onSuccess();
    reset();
    onClose();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setResult(null);
    setFileName(file.name);

    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: ({ data, errors }) => {
        if (errors.length) {
          setParseError(`Could not parse file: ${errors[0].message}`);
          setRows([]);
          return;
        }
        const missing = requiredHeaders.filter(
          (h) => !Object.keys(data[0] ?? {}).includes(h)
        );
        if (missing.length) {
          setParseError(`Missing required columns: ${missing.join(", ")}`);
          setRows([]);
          return;
        }
        setRows(data);
      },
    });
  }

  async function handleImport() {
    if (!rows.length) return;
    setLoading(true);
    try {
      const res = await onImport(rows);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  const templateFilename = title.toLowerCase().replace(/\s+/g, "_") + "_template.csv";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Step 1: Download template */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Step 1 - Download the template</p>
            <p className="text-xs text-slate-500">
              Required columns: <span className="font-medium text-slate-700">{requiredHeaders.join(", ")}</span>
              {optionalHeaders.length > 0 && (
                <> &nbsp;| Optional: <span className="text-slate-500">{optionalHeaders.join(", ")}</span></>
              )}
            </p>
            {notes && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{notes}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => downloadTemplate(requiredHeaders, optionalHeaders, exampleRow, templateFilename)}
            >
              <Download className="h-3 w-3" />
              Download template CSV
            </Button>
          </div>

          {/* Step 2: Upload */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Step 2 - Upload your filled CSV</p>
            <label
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors",
                rows.length ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
              )}
            >
              <Upload className={cn("h-6 w-6", rows.length ? "text-blue-500" : "text-slate-300")} />
              {fileName ? (
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-700">{fileName}</p>
                  <p className="text-[11px] text-slate-500">{rows.length} row{rows.length !== 1 ? "s" : ""} ready to import</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Click to select a CSV file</p>
              )}
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
            </label>
            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {parseError}
              </div>
            )}
          </div>

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400">Preview (first 3 rows)</p>
              <div className="rounded-md border border-slate-200 overflow-x-auto text-[11px]">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {allHeaders.map((h) => (
                        <th key={h} className="px-2 py-1 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {allHeaders.map((h) => (
                          <td key={h} className="px-2 py-1 text-slate-700 max-w-[120px] truncate">{row[h] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    {result.imported} record{result.imported !== 1 ? "s" : ""} imported
                    {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}
                  </p>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Skipped rows</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.skipped.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                        <X className="h-3 w-3 shrink-0 mt-0.5" />
                        <span><span className="font-medium">Row {s.row}{ s.value ? ` (${s.value})` : ""}:</span> {s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.passwords && result.passwords.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Temporary passwords</p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    Share these with your employees. They should change their password after first login.
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 text-[11px]">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left font-semibold text-slate-500">Name</th>
                          <th className="px-2 py-1 text-left font-semibold text-slate-500">Email</th>
                          <th className="px-2 py-1 text-left font-semibold text-slate-500">Temp password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.passwords.map((p, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-2 py-1 text-slate-700">{p.name}</td>
                            <td className="px-2 py-1 text-slate-500">{p.email}</td>
                            <td className="px-2 py-1 font-mono font-semibold text-slate-800">{p.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            {result ? (
              <Button onClick={handleClose}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
                <Button
                  onClick={handleImport}
                  disabled={!rows.length || loading}
                  className="gap-1.5"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Import {rows.length > 0 ? `${rows.length} row${rows.length !== 1 ? "s" : ""}` : ""}
                </Button>
              </>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
