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

type Row = { category: string; count: number };

const BAR = "rgba(19, 157, 75, 0.82)";

export function CategoryBarChart({ data }: { data: Row[] }) {
  const chartData = {
    labels: data.map((d) => d.category),
    datasets: [
      {
        label: "Assets",
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
          label: (ctx: TooltipItem<"bar">) => {
            const n = ctx.parsed.x;
            return `${n ?? 0} units`;
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
