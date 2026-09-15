"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches render/data errors in any route segment that doesn't define its own
// error boundary. In production Next.js strips the error message, but
// `error.digest` is logged alongside the real stack trace in the hosting
// platform's runtime logs — surfacing it here makes a 500 traceable.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The page couldn&apos;t be loaded. This is usually temporary — try again
          in a moment.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-slate-400">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
