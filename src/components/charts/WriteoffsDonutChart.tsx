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

const COLORS = [
  "rgba(0, 0, 0, 0.72)",
  "rgba(234, 88, 12, 0.85)",
  "rgba(245, 158, 11, 0.85)",
  "rgba(19, 157, 75, 0.85)",
  "rgba(11, 93, 46, 0.85)",
];

type ByReasonItem = { reason: string; count: number };

export function WriteoffsDonutChart({ data }: { data: ByReasonItem[] }) {
  const chartData = {
    labels: data.map((d) => d.reason),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
    },
  };

  return <Doughnut data={chartData} options={options} />;
}
