"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Row = { year: number; count: number };

const BAR = "rgba(15, 23, 42, 0.72)";

export function RegistrationYearBarChart({ data }: { data: Row[] }) {
  const chartData = {
    labels: data.map((d) => String(d.year)),
    datasets: [
      {
        label: "Units registered",
        data: data.map((d) => d.count),
        backgroundColor: BAR,
        borderRadius: 4,
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
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  return <Bar data={chartData} options={options} />;
}
