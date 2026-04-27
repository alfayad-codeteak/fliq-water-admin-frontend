"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { label: string; a: number; b: number };

function safeSvgId(id: string) {
  return id.replace(/:/g, "");
}

export function AnalyticsStackedVisual({ data }: { data: Row[] }) {
  const fillAId = `${safeSvgId(React.useId())}-a`;
  const fillBId = `${safeSvgId(React.useId())}-b`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="h-[320px] w-full"
      role="img"
      aria-label="Stacked area comparison"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id={fillAId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={fillBId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <YAxis width={40} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="a"
            stackId="1"
            stroke="var(--chart-1)"
            fill={`url(#${fillAId})`}
          />
          <Area
            type="monotone"
            dataKey="b"
            stackId="1"
            stroke="var(--chart-2)"
            fill={`url(#${fillBId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
