export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-slate-200 rounded-md" />
        <div className="h-4 w-72 bg-slate-100 rounded-md" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex gap-3 items-center">
        <div className="h-9 w-56 bg-slate-200 rounded-md" />
        <div className="h-9 w-32 bg-slate-200 rounded-md" />
        <div className="ml-auto h-9 w-24 bg-slate-200 rounded-md" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
          {[120, 200, 100, 100, 80].map((w, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-50 last:border-0">
            {[120, 200, 100, 100, 80].map((w, j) => (
              <div
                key={j}
                className="h-3 bg-slate-100 rounded"
                style={{ width: w, opacity: 1 - i * 0.08 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
