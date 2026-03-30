"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Shared tooltip styles ──────────────────────────────────────────────────

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c", "#34d399"];

// ── Types ──────────────────────────────────────────────────────────────────

export interface DaySeries {
  label: string; // e.g. "Mar 01"
  value: number;
}

export interface NameValue {
  name: string;
  value: number;
}

function coerceNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

// ── Area chart (bookings trend / revenue trend / signups) ─────────────────

export function AdminAreaChart({
  data,
  valueLabel,
  color = "#6366f1",
  format,
}: {
  data: DaySeries[];
  valueLabel: string;
  color?: string;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => String(v));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(data.length / 6)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmt}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [fmt(coerceNumber(value)), valueLabel]}
          labelStyle={{ color: "var(--foreground)", opacity: 0.6, fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color.replace("#", "")})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Bar chart (top cities / booking funnel) ───────────────────────────────

export function AdminBarChart({
  data,
  valueLabel,
  color = "#6366f1",
  format,
  horizontal,
}: {
  data: NameValue[];
  valueLabel: string;
  color?: string;
  format?: (v: number) => string;
  horizontal?: boolean;
}) {
  const fmt = format ?? ((v: number) => String(v));
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmt}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--foreground)", opacity: 0.8 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [fmt(coerceNumber(value)), valueLabel]}
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--foreground)", opacity: 0.5 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmt}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [fmt(coerceNumber(value)), valueLabel]}
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Pie / donut chart (booking status breakdown) ──────────────────────────

export function AdminDonutChart({
  data,
  format,
}: {
  data: NameValue[];
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => String(v));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [fmt(coerceNumber(value))]}
          labelStyle={{ color: "var(--foreground)", opacity: 0.6, fontSize: 11 }}
        />
        <Legend
          iconSize={10}
          iconType="circle"
          wrapperStyle={{ fontSize: 11, color: "var(--foreground)", opacity: 0.8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const AdminCharts = {
  Area: AdminAreaChart,
  Bar: AdminBarChart,
  Donut: AdminDonutChart,
};

export default AdminCharts;
