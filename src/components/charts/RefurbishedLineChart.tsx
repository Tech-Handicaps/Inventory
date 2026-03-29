"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
    new Date(a.dateUpdated).toLocaleDateString()
  );
  const values = sorted.map((_, i) => i + 1);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Refurbished (cumulative)",
        data: values,
        borderColor: "rgb(19, 157, 75)",
        backgroundColor: "rgba(19, 157, 75, 0.18)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  return <Line data={chartData} options={options} />;
}
