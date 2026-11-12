import { useEffect, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import { getSensorData } from "../data/sensorData";
import useRuntimeSettings from "../hooks/useRuntimeSettings";

function SensorChart() {
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const runtimeSettings = useRuntimeSettings();
  const TEMP_MIN = runtimeSettings.min_temperature;
  const TEMP_MAX = runtimeSettings.max_temperature;

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getSensorData();

        // Extract records from paginated response
        const sensorRecords = data?.records || [];

        const formattedData = sensorRecords
          .map((item) => ({
            time: new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            temperature: item.temperature,
            weight: item.weight,
            batchId: item.batchId,
          }))
          .reverse();

        setSensorData(formattedData);
        setError("");
      } catch (err) {
        console.error("Error fetching sensor data:", err);
        setError("Unable to load sensor data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const intervalMs = Math.max(1, Number(runtimeSettings.refresh_interval) || 5) * 1000;
    const interval = setInterval(fetchData, intervalMs);

    return () => clearInterval(interval);
  }, [runtimeSettings.refresh_interval]);

  // Use all sensor readings for the temperature trend chart.
  // Abnormal readings are also shown so the temperature trend is complete.
  const chartData = sensorData.filter(
    (item) => typeof item.temperature === "number"
  );

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div>
          <h2>Sensor Monitoring</h2>
          <p>Temperature readings over time</p>
        </div>

        <span className="chart-status">
          LIVE
        </span>
      </div>

      <div className="chart">
        {loading ? (
          <p>Loading sensor data...</p>
        ) : error ? (
          <p>{error}</p>
        ) : chartData.length === 0 ? (
          <p>No normal sensor data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="time" />

              <YAxis
                domain={[Math.min(TEMP_MIN - 100, 1000), Math.max(TEMP_MAX + 100, 1800)]}
                allowDataOverflow={true}
                label={{
                  value: "°C",
                  angle: -90,
                  position: "insideLeft",
                }}
              />

              <Tooltip
                formatter={(value) => [`${value} °C`, "Temperature"]}
                labelFormatter={(label) => `Time: ${label}`}
              />

              {/* Normal operating range */}
              <ReferenceLine
                y={TEMP_MIN}
                stroke="#16a34a"
                strokeDasharray="5 5"
              />

              <ReferenceLine
                y={TEMP_MAX}
                stroke="#16a34a"
                strokeDasharray="5 5"
              />

              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default SensorChart;