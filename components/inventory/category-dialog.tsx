"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory } from "@/lib/actions/inventory";

interface Category {
  id: string;
  name: string;
}

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}

export function CategoryDialog({ open, onClose, categories }: CategoryDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setIsAdding(true);
    setError(null);
    const result = await createCategory(name);
    setIsAdding(false);
    if (!result.success) {
      setError(result.error);
    } else {
      setNewName("");
      startTransition(() => router.refresh());
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const result = await deleteCategory(id);
    setDeletingId(null);
    if (!result.success) {
      setError(result.error);
    } else {
      startTransition(() => router.refresh());
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Manage categories
          </DialogTitle>
          <DialogDescription>
            Add or remove item categories. Categories in use cannot be deleted.
          </DialogDescription>
        </DialogHeader>

        {/* Add new category */}
        <div className="flex gap-2">
          <Input
            placeholder="New category name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            disabled={isAdding}
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            disabled={isAdding || !newName.trim()}
            size="icon"
            title="Add category"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-red-600 -mt-1">{error}</p>
        )}

        {/* Category list */}
        <div className="space-y-1 max-h-60 overflow-y-auto -mx-1 px-1">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No categories yet — add one above.
            </p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-50 group"
              >
                <span className="text-sm text-slate-700">{cat.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-300 hover:text-red-500 group-hover:text-slate-400"
                  onClick={() => handleDelete(cat.id)}
                  disabled={deletingId === cat.id}
                  title="Delete category"
                >
                  {deletingId === cat.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
