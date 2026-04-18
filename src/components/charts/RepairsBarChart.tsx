"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type PipelineItem = { status: string; count: number };

export function RepairsBarChart({ data }: { data: PipelineItem[] }) {
  const chartData = {
    labels: data.map((d) => d.status),
    datasets: [
      {
        label: "Repairs",
        data: data.map((d) => d.count),
        backgroundColor: "rgba(19, 157, 75, 0.78)",
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

  return <Bar data={chartData} options={options} />;
}
