import { useEffect, useState } from "react";

import { getSensorData } from "../data/sensorData";
import useRuntimeSettings from "../hooks/useRuntimeSettings";

function SensorData() {
  const [sensorData, setSensorData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total_records: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // =========================================
  // Normal operating ranges
  // =========================================

  const runtimeSettings = useRuntimeSettings();
  const TEMP_MIN = runtimeSettings.min_temperature;
  const TEMP_MAX = runtimeSettings.max_temperature;

  const WEIGHT_MIN = runtimeSettings.min_weight;
  const WEIGHT_MAX = runtimeSettings.max_weight;

  // =========================================
  // Fetch sensor data
  // =========================================

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getSensorData(pagination.page, pagination.limit, searchTerm);

        setSensorData(data.records);
        setPagination(prev => ({
          ...prev,
          ...data.pagination
        }));

        setError("");
      } catch (err) {
        console.error(
          "Error fetching sensor data:",
          err
        );

        setError("Unable to load sensor data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const intervalMs = Math.max(1, Number(runtimeSettings.refresh_interval) || 5) * 1000;
    const interval = setInterval(
      fetchData,
      intervalMs
    );

    return () => clearInterval(interval);
  }, [pagination.page, pagination.limit, searchTerm, runtimeSettings.refresh_interval]);

  // =========================================
  // Check abnormal readings
  // =========================================

  const isAbnormal = (item) => {
    return (
      item.temperature < TEMP_MIN ||
      item.temperature > TEMP_MAX ||
      item.weight < WEIGHT_MIN ||
      item.weight > WEIGHT_MAX
    );
  };

  // =========================================
  // Normal and abnormal readings
  // =========================================

  const abnormalReadings =
    sensorData.filter(isAbnormal);

  const normalReadings =
    sensorData.filter(
      (item) => !isAbnormal(item)
    );

  // =========================================
  // Filtered data for search
  // =========================================
  // With server-side search, sensorData is already filtered by the search term
  const filteredData = sensorData;

  // =========================================
  // Render
  // =========================================

  return (
    <div className="page-content">

      <div className="page-header">

        <div>
          {/* <h1>Sensor Data</h1> */}

          <p>
            All sensor readings received from the system
          </p>
        </div>

        <span className="chart-status">
          LIVE
        </span>

      </div>

      {/* Sensor Summary */}

      <div className="sensor-summary">

        <div className="summary-card">

          <span className="summary-title">
            Total Readings
          </span>

          <strong className="summary-value">
            {pagination.total_records}
          </strong>

          <span className="summary-description">
            Records in database
          </span>

        </div>

        <div className="summary-card">

          <span className="summary-title">
            Normal Readings
          </span>

          <strong className="summary-value">
            {normalReadings.length}
          </strong>

          <span className="summary-description">
            Within expected range
          </span>

        </div>

        <div className="summary-card">

          <span className="summary-title">
            Abnormal Readings
          </span>

          <strong className="summary-value">
            {abnormalReadings.length}
          </strong>

          <span className="summary-description">
            Require attention
          </span>

        </div>

      </div>

      {/* Sensor Range Information */}

      <div className="sensor-range-info">

        <div>
          <strong>Temperature Range</strong>
          <span>
            {TEMP_MIN}°C – {TEMP_MAX}°C
          </span>
        </div>

        <div>
          <strong>Weight Range</strong>
          <span>
            {WEIGHT_MIN} – {WEIGHT_MAX} kg
          </span>
        </div>

      </div>

      {/* Sensor Table */}

      <div className="sensor-table-container">
          {/* Search Bar */}
          <div className="search-bar-container">
              <input
                  type="text"
                  placeholder="Search sensor ID, temperature, weight, time..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
              />
              {searchTerm.length > 0 && (
                  <button
                      onClick={() => setSearchTerm("")}
                      className="search-clear-button"
                      title="Clear search"
                  >
                      ×
                  </button>
              )}
              {searchTerm.length > 0 && (
                  <span className="search-info">
                      Showing {sensorData.length} of {pagination.total_records} records matching
                  </span>
              )}
          </div>

        {loading ? (

          <p>
            Loading sensor data...
          </p>

        ) : error ? (

          <p>
            {error}
          </p>

        ) : sensorData.length === 0 ? (

          <p>
            No sensor data available
          </p>

        ) : (

          <table className="sensor-table">

            <thead>

              <tr>

                <th>Reading</th>

                <th>Temperature</th>

                <th>Weight</th>

                <th>Status</th>

                <th>Time</th>

              </tr>

            </thead>

            <tbody>

              {filteredData.map((item) => {

                const abnormal =
                  isAbnormal(item);

                return (

                  <tr
                    key={item._id}
                  >

                    <td>
                      Sensor
                    </td>

                    <td>
                      {item.temperature} °C
                    </td>

                    <td>
                      {item.weight} kg
                    </td>

                    <td>

                      <span
                        className={
                          abnormal
                            ? "status-abnormal"
                            : "status-normal"
                        }
                      >

                        {abnormal
                          ? "Abnormal"
                          : "Normal"}

                      </span>

                    </td>

                    <td>
                      {new Date(
                        item.timestamp
                      ).toLocaleString()}
                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        )}

          {/* Pagination Controls */}
          <div className="pagination-controls">
            <button
              onClick={() => {
                setPagination(prev => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1)
                }));
              }}
              disabled={!pagination.has_prev}
              className={`pagination-btn ${!pagination.has_prev ? 'disabled' : ''}`}
            >
              Previous
            </button>

            <span className="pagination-info">
              Page {pagination.page} of {pagination.total_pages}
            </span>

            <button
              onClick={() => {
                setPagination(prev => ({
                  ...prev,
                  page: Math.min(pagination.total_pages, prev.page + 1)
                }));
              }}
              disabled={!pagination.has_next}
              className={`pagination-btn ${!pagination.has_next ? 'disabled' : ''}`}
            >
              Next
            </button>
          </div>

      </div>

    </div>
  );
}

export default SensorData;