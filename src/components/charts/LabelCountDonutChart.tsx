"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export type LabelCount = { name: string; count: number };

const PALETTE = [
  "rgba(19, 157, 75, 0.88)",
  "rgba(14, 165, 233, 0.85)",
  "rgba(124, 58, 237, 0.78)",
  "rgba(245, 158, 11, 0.9)",
  "rgba(220, 38, 38, 0.72)",
  "rgba(15, 23, 42, 0.78)",
  "rgba(236, 72, 153, 0.75)",
  "rgba(20, 184, 166, 0.82)",
  "rgba(100, 116, 139, 0.75)",
];

/** Collapse long tails into “Other” for readability. */
export function capSlicesForDonut(
  rows: LabelCount[],
  maxSlices: number
): LabelCount[] {
  if (rows.length <= maxSlices) return rows;
  const top = rows.slice(0, maxSlices - 1);
  const otherCount = rows
    .slice(maxSlices - 1)
    .reduce((s, r) => s + r.count, 0);
  return [...top, { name: "Other", count: otherCount }];
}

export function LabelCountDonutChart({
  data,
  unitLabel = "units",
}: {
  data: LabelCount[];
  unitLabel?: string;
}) {
  const sum = data.reduce((a, b) => a + b.count, 0);
  const chartData = {
    labels: data.map((d) => d.name),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw as number;
            const pct = sum ? Math.round((v / sum) * 1000) / 10 : 0;
            return `${v} ${unitLabel} (${pct}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}
