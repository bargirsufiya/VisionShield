import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Video,
  Loader,
  FlaskConical,
  Flame,
  Scale,
  Clock,
  ArrowRight,
  Download,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { apiUrl, ENDPOINTS } from "../config/api";

// =========================================================
// SOP Step definitions (matches backend - 3 steps: Scrap Weighing, Furnace Charging, Magnesium Process)
// =========================================================

const SOP_STEPS = [
  { step: 1, key: "scrap_weighing", label: "Scrap Weighing", icon: Scale, mandatory: false },
  { step: 2, key: "furnace_charging", label: "Furnace Charging", icon: Flame, mandatory: false },
  { step: 3, key: "magnesium_process", label: "Magnesium Process", icon: FlaskConical, mandatory: true },
];

// =========================================================
// Alert badge styles
// =========================================================

function alertStyle(severity) {
  const map = {
    critical: { bg: "#fef2f2", border: "#fee2e2", text: "#991b1b", icon: XCircle },
    error:    { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", icon: AlertTriangle },
    warning:  { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: AlertTriangle },
    success:  { bg: "#f0fdf4", border: "#dcfce7", text: "#166534", icon: CheckCircle },
  };
  return map[severity] || map.warning;
}

// =========================================================
// LocalStorage keys for persistent job tracking
// =========================================================
const JOB_STORAGE_KEY = "visionshield_process_jobs";
const ACTIVE_JOB_KEY = "visionshield_active_process_job";

function getStoredJobs() {
  try {
    const stored = localStorage.getItem(JOB_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs) {
  localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs));
}

function addJob(job) {
  const jobs = getStoredJobs();
  jobs.unshift(job);
  if (jobs.length > 20) jobs.splice(20);
  saveJobs(jobs);
}

function updateJob(jobId, updates) {
  const jobs = getStoredJobs();
  const idx = jobs.findIndex(j => j.job_id === jobId);
  if (idx !== -1) {
    jobs[idx] = { ...jobs[idx], ...updates };
    saveJobs(jobs);
  }
}

function getActiveJobId() {
  return localStorage.getItem(ACTIVE_JOB_KEY);
}

function setActiveJobId(jobId) {
  if (jobId) {
    localStorage.setItem(ACTIVE_JOB_KEY, jobId);
  } else {
    localStorage.removeItem(ACTIVE_JOB_KEY);
  }
}

// =========================================================
// Component
// =========================================================

function ProcessDetection() {
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [result, setResult]     = useState(null);
  const [resultVideo, setResultVideo] = useState(null);
  const [resultJobId, setResultJobId] = useState(null);
  const [error, setError]       = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const pollIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // -------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------
  // Poll job status
  // -------------------------------------------------------
  const pollJobStatus = useCallback(async (jobId) => {
    try {
      const res = await fetch(apiUrl(ENDPOINTS.processStatus(jobId)));
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();

      if (!isMountedRef.current) return;

      setJobStatus(data);
      updateJob(jobId, { status: data.status, progress: data.progress });

      if (data.status === "done") {
        const resultRes = await fetch(apiUrl(ENDPOINTS.processResult(jobId)));
        const resultData = await resultRes.json();
        setResult(resultData);
        if (resultData.result_video) {
          setResultVideo(apiUrl(resultData.result_video));
        }
        setActiveJob(null);
        setActiveJobId(null);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (data.status === "error") {
        setError(data.error || "Processing failed");
        setActiveJob(null);
        setActiveJobId(null);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, []);

  // -------------------------------------------------------
  // Start polling for a job
  // -------------------------------------------------------
  const startPolling = useCallback((jobId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    pollJobStatus(jobId);
    pollIntervalRef.current = setInterval(() => pollJobStatus(jobId), 3000);
  }, [pollJobStatus]);

  // -------------------------------------------------------
  // On mount: check for active job in localStorage
  // -------------------------------------------------------
  useEffect(() => {
    const activeJobId = getActiveJobId();
    if (activeJobId) {
      const jobs = getStoredJobs();
      const job = jobs.find(j => j.job_id === activeJobId);
      if (job && (job.status === "queued" || job.status === "processing")) {
        setActiveJob(job);
        startPolling(activeJobId);
      } else if (job && job.status === "done") {
        fetch(apiUrl(ENDPOINTS.processResult(activeJobId)))
          .then(r => r.json())
          .then(data => {
            setResult(data);
            if (data.result_video) {
              setResultVideo(apiUrl(data.result_video));
            }
          });
        setActiveJobId(null);
      }
    }
  }, [startPolling]);

  // -------------------------------------------------------
  // File picker
  // -------------------------------------------------------
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("Please select a video file (MP4, AVI, MOV, MKV, WEBM).");
      return;
    }
    setFile(f);
    setError("");
    setUploadProgress(0);
  };

  // -------------------------------------------------------
  // Upload + start async detection
  // -------------------------------------------------------
  const handleAnalyze = async () => {
    if (!file) { setError("Please select a video first."); return; }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const form = new FormData();
      form.append("file", file);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl(ENDPOINTS.processVideoDetect));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(JSON.parse(xhr.responseText)?.detail || "Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(form);
      }).then(data => {
        const jobId = data.job_id;
        const job = {
          job_id: jobId,
          filename: file.name,
          status: "queued",
          progress: 0,
          created_at: new Date().toISOString(),
        };
        addJob(job);
        setActiveJob(job);
        setActiveJobId(jobId);
        startPolling(jobId);
        setFile(null);
      });
    } catch (err) {
      setError(err.message || "Cannot connect to backend.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  const sop = result?.sop_summary;

  const stepStatus = (stepKey) => {
    if (!sop) return "pending";
    const stepObj = sop.steps?.find((s) => s.key === stepKey);
    return stepObj?.done ? "done" : "pending";
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  // -------------------------------------------------------
  // Load completed result directly
  // -------------------------------------------------------
  const loadResult = async (jobId) => {
    setError("");
    try {
      const res = await fetch(apiUrl(ENDPOINTS.processResult(jobId)));
      if (!res.ok) throw new Error("Failed to load result");
      const data = await res.json();
      setResult(data);
      setResultJobId(jobId);
      if (data.result_video) {
        setResultVideo(apiUrl(data.result_video));
      }
      updateJob(jobId, { status: "done", loaded: true });
    } catch (err) {
      setError(err.message || "Failed to load result");
    }
  };

  // -------------------------------------------------------
  // Download detection report as JSON
  // -------------------------------------------------------
  const downloadReport = (jobId, filename) => {
    if (!result || resultJobId !== jobId) {
      loadResult(jobId).then(() => {
        setTimeout(() => downloadReport(jobId, filename), 500);
      });
      return;
    }

    const sopData = result.sop_summary;
    const report = {
      job_id: jobId,
      video_filename: filename,
      generated_at: new Date().toISOString(),
      video_statistics: {
        frames_processed: result.frames_processed,
        total_frames: result.total_frames,
        fps: result.fps,
        duration_seconds: result.duration_seconds,
      },
      detection_counts: result.detection_counts,
      sop_summary: sopData,
      alerts: sopData?.alerts || [],
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `process_detection_${filename.replace(/\.[^/.]+$/, "")}_${jobId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // =========================================================
  // Render
  // =========================================================
  return (
    <div className="process-detection-page">

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <div className="header-icon-wrapper">
              <FlaskConical size={24} />
            </div>
            <div>
              <h1>Process Detection</h1>
              <p>Upload a casting process video. The system runs all 3 SOP models, enforces step order, and alerts if any step is skipped or the mandatory Magnesium process is missing. Processing runs in background — you can navigate away and return later.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Job Banner ───────────────────────────── */}
      {activeJob && (
        <div className="active-job-banner">
          <div className="active-job-info">
            <Loader size={24} className="spin" />
            <div>
              <div className="active-job-filename">{activeJob.filename}</div>
              <div className="active-job-meta">Job ID: {activeJob.job_id.slice(0, 8)}...</div>
            </div>
          </div>

          {jobStatus && (
            <div className="active-job-progress">
              <div className="progress-bar-container">
                <div className="progress-bar-labels">
                  <span>Progress</span>
                  <span className="progress-percent">{jobStatus.progress}%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${jobStatus.progress}%`, background: jobStatus.status === "error" ? "var(--accent-danger)" : "var(--accent-primary)" }}
                  />
                </div>
              </div>
              <span className={`status-badge ${jobStatus.status === "error" ? "status-error" : jobStatus.status === "done" ? "status-success" : "status-processing"}`}>
                {jobStatus.status}
              </span>
            </div>
          )}

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveJob(null)}
          >
            Continue in Background
          </button>
        </div>
      )}

      {/* ── Upload Section ──────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Video size={20} />
          </div>
          <div>
            <h2>Upload Process Video</h2>
            <p>Supported formats: MP4, AVI, MOV, MKV, WEBM (up to 100MB)</p>
          </div>
        </div>

        <div className="upload-card">
          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar-labels">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <label className="file-upload-label">
            <Upload size={18} />
            {file ? file.name : "Choose Video File"}
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>

          <button
            className="btn btn-primary btn-analyze"
            onClick={handleAnalyze}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader size={18} className="spin" />
                Uploading...
              </>
            ) : (
              <>
                <Video size={18} />
                Run Process Detection
              </>
            )}
          </button>

          {error && (
            <div className="error-message">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Jobs History ─────────────────────────── */}
      {getStoredJobs().length > 0 && (
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <Clock size={20} />
            </div>
            <div>
              <h2>Recent Process Jobs</h2>
              <p>Click "Load Result" to view completed analyses, or "Track" to resume monitoring active jobs</p>
            </div>
          </div>

          <div className="jobs-table-container">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {getStoredJobs().slice(0, 10).map((job) => (
                  <tr key={job.job_id}>
                    <td>{job.filename}</td>
                    <td>{formatTime(job.created_at)}</td>
                    <td className="text-center">
                      <span className={`status-badge ${job.status === "error" ? "status-error" : job.status === "done" ? "status-success" : job.status === "processing" ? "status-processing" : "status-queued"}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="text-center">
                      {job.status === "processing" && job.progress !== undefined && (
                        <div className="inline-progress">
                          <div className="progress-bar-track" style={{ width: 80 }}>
                            <div className="progress-bar-fill" style={{ width: `${job.progress}%` }} />
                          </div>
                          <span className="progress-percent">{job.progress}%</span>
                        </div>
                      )}
                      {job.status === "done" && <span className="text-success">Complete</span>}
                      {job.status === "error" && <span className="text-error">Failed</span>}
                      {job.status === "queued" && <span className="text-warning">Waiting...</span>}
                    </td>
                    <td className="text-center">
                      {job.status === "done" && result && job.job_id === resultJobId ? (
                        <div className="action-buttons">
                          <span className="text-success text-sm">Loaded</span>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => downloadReport(job.job_id, job.filename)}
                            title="Download detection report"
                          >
                            <Download size={12} /> Download
                          </button>
                        </div>
                      ) : job.status === "done" ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => loadResult(job.job_id)}
                        >
                          Load Result
                        </button>
                      ) : job.status === "processing" || job.status === "queued" ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveJob(job);
                            setActiveJobId(job.job_id);
                            startPolling(job.job_id);
                          }}
                        >
                          <ArrowRight size={12} style={{ marginRight: 4 }} /> Track
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Results Section ─────────────────────────────── */}
      {result && sop && (
        <>
          {/* SOP Step Tracker */}
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">
                <FlaskConical size={20} />
              </div>
              <div>
                <h2>SOP Process Sequence</h2>
                <p>Each step must be completed in order. Magnesium Process (Step 3) is mandatory.</p>
              </div>
            </div>

            <div className="sop-steps-grid">
              {SOP_STEPS.map((proc) => {
                const done = stepStatus(proc.key) === "done";
                const Icon = proc.icon;
                return (
                  <div
                    key={proc.key}
                    className={`sop-step-card ${done ? "completed" : "pending"} ${proc.mandatory ? "mandatory" : ""}`}
                  >
                    <div className="sop-step-icon">
                      <Icon size={28} />
                    </div>
                    <div className="sop-step-header">
                      <span className="sop-step-number">Step {proc.step}</span>
                      {proc.mandatory && <span className="mandatory-badge">MANDATORY</span>}
                    </div>
                    <div className="sop-step-label">{proc.label}</div>
                    <div className={`sop-step-status ${done ? "done" : "not-done"}`}>
                      {done ? <><CheckCircle size={14} /> Completed</> : <><XCircle size={14} /> Not detected</>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Magnesium status banner */}
            <div className={`magnesium-status-banner ${sop.magnesium_done ? "success" : "critical"}`}>
              {sop.magnesium_done ? (
                <>
                  <CheckCircle size={20} />
                  <span><strong>Magnesium Process: COMPLETED</strong> — All mandatory steps done.</span>
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  <span><strong>Magnesium Process: NOT DETECTED</strong> — Batch is INVALID!</span>
                </>
              )}
            </div>
          </div>

          {/* ── Alert Panel ──────────────────────────────── */}
          {sop.alerts && sop.alerts.length > 0 && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2>SOP Alerts ({sop.alerts.length})</h2>
                  <p>Violations detected during process analysis</p>
                </div>
              </div>

              <div className="alerts-list">
                {sop.alerts.map((alert, i) => {
                  const style = alertStyle(alert.severity);
                  const Icon = style.icon;
                  return (
                    <div
                      key={i}
                      className="alert-item"
                      style={{ background: style.bg, borderColor: style.border, color: style.text }}
                    >
                      <Icon size={18} />
                      <div>
                        <span className="alert-severity">{alert.severity.toUpperCase()}</span>
                        <div className="alert-message">{alert.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Video Statistics ─────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">
                <Video size={20} />
              </div>
              <div>
                <h2>Video Statistics</h2>
                <p>Processing details and frame-level detection counts</p>
              </div>
            </div>

            <div className="stats-grid">
              {[
                { label: "Frames Processed", value: result.frames_processed },
                { label: "Total Frames",     value: result.total_frames },
                { label: "FPS",              value: result.fps },
                { label: "Duration",         value: `${result.duration_seconds}s` },
              ].map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Per-process frame counts */}
            {result.detection_counts && Object.keys(result.detection_counts).length > 0 && (
              <div className="detection-table-section">
                <h3>Frames Detected Per Process</h3>
                <div className="table-container">
                  <table className="detection-table">
                    <thead>
                      <tr>
                        <th>Process</th>
                        <th>Frames Detected</th>
                        <th>Coverage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.detection_counts).map(([key, count]) => {
                        const proc = SOP_STEPS.find((p) => p.key === key);
                        const pct = result.frames_processed
                          ? ((count / result.frames_processed) * 100).toFixed(1)
                          : 0;
                        return (
                          <tr key={key}>
                            <td>
                              {proc ? `Step ${proc.step}: ${proc.label}` : key}
                              {proc?.mandatory && <span className="mandatory-badge">MANDATORY</span>}
                            </td>
                            <td>{count}</td>
                            <td>{pct}%</td>
                            <td>
                              <span className="detection-status">
                                <CheckCircle size={14} /> Detected
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Annotated Video Player ───────────────────── */}
          {resultVideo && (
            <div className="settings-section">
              <div className="settings-section-header">
                <div className="settings-section-icon">
                  <Video size={20} />
                </div>
                <div>
                  <h2>Annotated Process Video</h2>
                  <p>Each frame shows the detected process step with bounding boxes. The bottom bar shows SOP progress (green = completed steps).</p>
                </div>
              </div>

              <div className="video-player-container">
                <video controls className="video-player" src={resultVideo}>
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Note ────────────────────────────────────────── */}
      <div className="info-note">
        <AlertTriangle size={18} />
        <span>
          Detection confidence depends on video quality and lighting conditions.
          Magnesium process (Step 3) is mandatory — its absence triggers a Critical alert saved to MongoDB.
          Processing runs in background; you can navigate to other pages and return to check progress.
        </span>
      </div>

    </div>
  );
}

export default ProcessDetection;