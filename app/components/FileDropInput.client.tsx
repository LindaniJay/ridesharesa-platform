"use client";

import { useMemo, useState } from "react";

type Props = {
  name: string;
  label: string;
  helper?: string;
  accept?: string;
  required?: boolean;
  onFileSelected?: (file: File | null) => void;
};

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function FileDropInput({ name, label, helper, accept, required = false, onFileSelected }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const hint = useMemo(() => {
    if (!file) return "Drop file here or click to browse";
    return `${file.name} (${prettyBytes(file.size)})`;
  }, [file]);

  return (
    <label className="block">
      <div className="mb-1 text-sm">{label}</div>
      <div
        className={[
          "rounded-xl border border-dashed bg-background/40 p-3 transition-colors",
          dragOver ? "border-accent bg-accent-soft" : "border-border",
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const next = e.dataTransfer.files?.[0] ?? null;
          setFile(next);
          onFileSelected?.(next);
        }}
      >
        <input
          name={name}
          type="file"
          required={required}
          accept={accept}
          className="w-full text-sm"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setFile(next);
            onFileSelected?.(next);
          }}
        />
        <div className="mt-2 rounded-md border border-border bg-card/70 px-2.5 py-1.5 text-xs text-foreground/70">
          {hint}
        </div>
        {helper ? <div className="mt-1 text-xs text-foreground/55">{helper}</div> : null}
      </div>
    </label>
  );
}
