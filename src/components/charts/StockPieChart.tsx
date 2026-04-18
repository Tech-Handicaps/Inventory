"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Pie } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

/** Lifecycle-aware colours (aligns with inventory column accents). */
const STATUS_COLORS: Record<string, string> = {
  new_stock: "rgba(15, 15, 15, 0.78)",
  in_stock: "rgba(19, 157, 75, 0.88)",
  deployed: "rgba(14, 165, 233, 0.88)",
  repair: "rgba(245, 158, 11, 0.9)",
  refurbished: "rgba(124, 58, 237, 0.78)",
  written_off: "rgba(220, 38, 38, 0.72)",
  unknown: "rgba(100, 116, 139, 0.75)",
};

const FALLBACK = [
  "rgba(19, 157, 75, 0.88)",
  "rgba(0, 0, 0, 0.72)",
  "rgba(245, 158, 11, 0.85)",
  "rgba(234, 88, 12, 0.85)",
  "rgba(11, 93, 46, 0.85)",
  "rgba(14, 165, 233, 0.85)",
];

type StockItem = { status: string; count: number; code?: string };

export function StockPieChart({ data }: { data: StockItem[] }) {
  const bg = data.map((d, i) => {
    const c = d.code && STATUS_COLORS[d.code] ? STATUS_COLORS[d.code] : null;
    return c ?? FALLBACK[i % FALLBACK.length];
  });

  const chartData = {
    labels: data.map((d) => d.status),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: bg,
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
    },
  };

  return <Pie data={chartData} options={options} />;
}
