"use client";

import { useState, useTransition } from "react";
import Button from "@/app/components/ui/Button";

interface Item {
  id: string;
  label: string;
  sub?: string;
}

interface BulkAction {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  confirm?: string;
  action: (ids: string[]) => Promise<void>;
}

export default function AdminBulkSelector({
  items,
  actions,
  noun = "item",
}: {
  items: Item[];
  actions: BulkAction[];
  noun?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = selected.size === items.length && items.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runAction(action: BulkAction) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action.confirm && !window.confirm(action.confirm.replace("{n}", String(ids.length)))) return;
    startTransition(async () => {
      await action.action(ids);
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} {noun}{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {actions.map((a) => (
              <Button
                key={a.label}
                variant={a.variant ?? "secondary"}
                disabled={pending}
                onClick={() => runAction(a)}
                className="h-8 px-3 text-xs"
              >
                {pending ? "Working..." : a.label}
              </Button>
            ))}
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-foreground/60 hover:text-foreground underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-border"
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2">{noun.charAt(0).toUpperCase() + noun.slice(1)}</th>
              <th className="px-3 py-2 text-foreground/60">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-border cursor-pointer transition-colors ${
                  selected.has(item.id) ? "bg-accent/5" : "hover:bg-muted/50"
                }`}
                onClick={() => toggle(item.id)}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="rounded border-border"
                    aria-label={`Select ${item.label}`}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{item.label}</td>
                <td className="px-3 py-2 text-foreground/60">{item.sub ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-foreground/50">
                  No items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="text-xs text-foreground/40">
          {selected.size} of {items.length} selected
        </div>
      )}
    </div>
  );
}
