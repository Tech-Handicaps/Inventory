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

export function RegistrationYearChart({
  data,
  datasetLabel = "Units registered",
}: {
  data: Row[];
  datasetLabel?: string;
}) {
  const chartData = {
    labels: data.map((d) => String(d.year)),
    datasets: [
      {
        label: datasetLabel,
        data: data.map((d) => d.count),
        backgroundColor: "rgba(19, 157, 75, 0.75)",
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
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}
