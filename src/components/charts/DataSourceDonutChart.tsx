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

type Row = { dataSource: string; count: number };

function labelForSource(code: string): string {
  if (code === "zoho_assist") return "Zoho Assist";
  if (code === "manual") return "Manual entry";
  return code;
}

const COLORS: Record<string, string> = {
  manual: "rgba(15, 23, 42, 0.78)",
  zoho_assist: "rgba(109, 40, 217, 0.82)",
};

const FALLBACK = [
  "rgba(19, 157, 75, 0.85)",
  "rgba(14, 165, 233, 0.82)",
  "rgba(245, 158, 11, 0.85)",
];

export function DataSourceDonutChart({ data }: { data: Row[] }) {
  const chartData = {
    labels: data.map((d) => labelForSource(d.dataSource)),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: data.map(
          (d, i) => COLORS[d.dataSource] ?? FALLBACK[i % FALLBACK.length]
        ),
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
            const v = ctx.raw as number;
            const sum = data.reduce((a, b) => a + b.count, 0);
            const pct = sum ? Math.round((v / sum) * 100) : 0;
            return `${v} (${pct}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}
