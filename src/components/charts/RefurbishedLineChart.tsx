"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatDate } from "@/lib/dates/format";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

type Asset = { assetName: string; dateUpdated: string };

export function RefurbishedLineChart({ data }: { data: Asset[] }) {
  const sorted = [...data].sort(
    (a, b) =>
      new Date(a.dateUpdated).getTime() - new Date(b.dateUpdated).getTime()
  );
  const labels = sorted.map((a) =>
    formatDate(a.dateUpdated)
  );
  const values = sorted.map((_, i) => i + 1);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Refurbished (cumulative)",
        data: values,
        borderColor: "rgb(70, 155, 86)",
        backgroundColor: "rgba(70, 155, 86, 0.18)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  return <Line data={chartData} options={options} />;
}
