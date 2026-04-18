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

type Slice = { name: string; count: number; percent: number };

const PALETTE = [
  "rgba(19, 157, 75, 0.88)",
  "rgba(15, 23, 42, 0.78)",
  "rgba(14, 165, 233, 0.82)",
  "rgba(124, 58, 237, 0.78)",
  "rgba(245, 158, 11, 0.88)",
  "rgba(220, 38, 38, 0.72)",
  "rgba(11, 93, 46, 0.85)",
  "rgba(234, 88, 12, 0.82)",
];

/** Top N slices; remainder grouped as “Other” if needed */
export function FleetSliceDonutChart({
  data,
  maxSlices = 8,
}: {
  data: Slice[];
  maxSlices?: number;
}) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);
  const otherCount = rest.reduce((s, x) => s + x.count, 0);
  const rows =
    otherCount > 0
      ? [
          ...top,
          {
            name: "Other",
            count: otherCount,
            percent:
              data.reduce((s, x) => s + x.percent, 0) -
              top.reduce((s, x) => s + x.percent, 0),
          },
        ]
      : top;

  const chartData = {
    labels: rows.map((d) => d.name),
    datasets: [
      {
        data: rows.map((d) => d.count),
        backgroundColor: rows.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const row = rows[ctx.dataIndex];
            if (!row) return "";
            return `${row.count} units (${Math.round(row.percent * 10) / 10}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}
