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

/** HNA palette: brand green, black, amber, orange, deep green */
const COLORS = [
  "rgba(19, 157, 75, 0.88)",
  "rgba(0, 0, 0, 0.72)",
  "rgba(245, 158, 11, 0.85)",
  "rgba(234, 88, 12, 0.85)",
  "rgba(11, 93, 46, 0.85)",
];

type StockItem = { status: string; count: number };

export function StockPieChart({ data }: { data: StockItem[] }) {
  const chartData = {
    labels: data.map((d) => d.status),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<"pie"> = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" },
    },
  };

  return <Pie data={chartData} options={options} />;
}
