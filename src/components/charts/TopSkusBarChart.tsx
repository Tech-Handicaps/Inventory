"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type TooltipItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Row = { label: string; count: number; percent: number };

const BAR = "rgba(19, 157, 75, 0.82)";

/** Horizontal bars — truncate long model labels in axis */
export function TopSkusBarChart({ data }: { data: Row[] }) {
  const labels = data.map((d) =>
    d.label.length > 42 ? `${d.label.slice(0, 40)}…` : d.label
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: "Units",
        data: data.map((d) => d.count),
        backgroundColor: BAR,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: TooltipItem<"bar">[]) => {
            const i = items[0]?.dataIndex ?? 0;
            return data[i]?.label ?? "";
          },
          label: (ctx: TooltipItem<"bar">) => {
            const i = ctx.dataIndex;
            const row = data[i];
            if (!row) return "";
            return `${row.count} units (${row.percent}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}
