import { useState, useCallback, useRef } from "react";
import {
  Upload,
  Brain,
  CheckCircle,
  AlertTriangle,
  Video,
  Image as ImageIcon,
  FileVideo,
  FileImage,
  Search,
  Filter,
  X,
  ChevronDown,
  Download,
  RotateCcw,
  Eye,
  Trash2,
  Zap,
  Shield,
  Users,
  HardHat,
  Shirt,
  Package,
  Info,
} from "lucide-react";
import { apiUrl, ENDPOINTS } from "../config/api";

function AIUpload() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [resultVideo, setResultVideo] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [confidenceFilter, setConfidenceFilter] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  // =========================================================
  // File Selection
  // =========================================================

  const handleFileChange = useCallback((event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setResultImage(null);
    setResultVideo(null);
    setError("");
    setConfidenceFilter(0);
    setSearchTerm("");

    if (selectedFile.type.startsWith("image/")) {
      setFileType("image");
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith("video/")) {
      setFileType("video");
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFileType("");
      setFilePreview(null);
      setError("Please select a valid image or video file.");
    }
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setFileType("");
    setFilePreview(null);
    setResult(null);
    setResultImage(null);
    setResultVideo(null);
    setError("");
    setConfidenceFilter(0);
    setSearchTerm("");
    setActiveTab("overview");
  }, []);

  // =========================================================
  // Run AI Detection
  // =========================================================

  const handleAnalyze = async () => {
    if (!file || !fileType) {
      setError("Please select an image or video first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setResultImage(null);
    setResultVideo(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const endpoint = fileType === "image"
        ? apiUrl(ENDPOINTS.aiDetect)
        : apiUrl(ENDPOINTS.aiVideoDetect);

      const response = await fetch(endpoint, { method: "POST", body: formData });

      if (!response.ok) {
        throw new Error(`AI ${fileType} detection failed.`);
      }

      const data = await response.json();
      setResult(data);

      if (fileType === "image" && data.result_image) {
        setResultImage(apiUrl(data.result_image));
      } else if (fileType === "video" && data.result_video) {
        setResultVideo(apiUrl(data.result_video));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to connect to the AI detection service.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // Statistics Computation
  // =========================================================

  // Required PPE classes for compliance (excluding 'person')
  const REQUIRED_PPE_CLASSES = ["helmet", "vest", "boots", "gloves", "goggles", "cap"];

  // Compute missing PPE for compliance check (handles both image array and video object formats)
  const computeMissingPPE = () => {
    if (!result || !result.detections) return { hasPersons: false, missing: [], detected: [] };

    // Get detected class names - different structure for image vs video
    let detectedClasses;
    if (fileType === "image" && Array.isArray(result.detections)) {
      detectedClasses = new Set(result.detections.map(d => d.class.toLowerCase()));
    } else if (fileType === "video" && typeof result.detections === "object") {
      detectedClasses = new Set(Object.keys(result.detections).map(k => k.toLowerCase()));
    } else {
      return { hasPersons: false, missing: [], detected: [] };
    }

    const hasPersons = detectedClasses.has("person");

    if (!hasPersons) return { hasPersons: false, missing: [], detected: [] };

    const detectedPPE = [...detectedClasses].filter(c => REQUIRED_PPE_CLASSES.includes(c));
    const missingPPE = REQUIRED_PPE_CLASSES.filter(c => !detectedClasses.has(c));

    return { hasPersons: true, missing: missingPPE, detected: detectedPPE };
  };

  const compliance = computeMissingPPE();

  // Group detections by class for image results
  const imageClassStats = result &&
    fileType === "image" &&
    result.detections &&
    result.detections.length > 0
      ? Object.values(
          result.detections.reduce((acc, detection) => {
            const className = detection.class;
            if (!acc[className]) {
              acc[className] = {
                class: className,
                count: 0,
                confidences: [],
                minConf: 1,
                maxConf: 0,
              };
            }
            acc[className].count += 1;
            acc[className].confidences.push(detection.confidence);
            acc[className].minConf = Math.min(acc[className].minConf, detection.confidence);
            acc[className].maxConf = Math.max(acc[className].maxConf, detection.confidence);
            return acc;
          }, {})
        ).sort((a, b) => b.count - a.count) // Sort by count descending
      : [];

  // Filter image class stats based on search and confidence filter
  const filteredImageClassStats = imageClassStats.filter(stat => {
    const matchesSearch = stat.class.toLowerCase().includes(searchTerm.toLowerCase());
    const avgConf = stat.confidences.reduce((a, b) => a + b, 0) / stat.confidences.length;
    const matchesConfidence = avgConf * 100 >= confidenceFilter;
    return matchesSearch && matchesConfidence;
  });

  const averageConfidence =
    result &&
    fileType === "image" &&
    result.detections &&
    result.detections.length > 0
      ? (
          (result.detections.reduce(
            (sum, detection) => sum + detection.confidence,
            0
          ) / result.detections.length) *
          100
        ).toFixed(1)
      : 0;

  const imagePersons =
    result && fileType === "image" && result.detections
      ? result.detections.filter((item) => item.class === "person").length
      : 0;

  const imagePPETypes =
    result && fileType === "image" && result.detections
      ? new Set(result.detections.filter((item) => item.class !== "person").map((item) => item.class)).size
      : 0;

  // Video statistics
  const videoDetections = result && fileType === "video" && result.detections ? result.detections : {};
  const videoClasses = fileType === "video" ? Object.keys(videoDetections).sort((a, b) => videoDetections[b].count - videoDetections[a].count) : [];
  const videoPersonCount = videoDetections.person?.count || 0;

  // Filter video classes
  const filteredVideoClasses = videoClasses.filter(className => {
    const obj = videoDetections[className];
    const matchesSearch = className.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesConfidence = (obj.average_confidence * 100) >= confidenceFilter;
    return matchesSearch && matchesConfidence;
  });

  // =========================================================
  // Helper Components
  // =========================================================

  const getPPEIcon = (className) => {
    switch (className.toLowerCase()) {
      case "helmet":
        return <HardHat size={20} />;
      case "vest":
        return <Shirt size={20} />;
      case "boots":
        return <Package size={20} />;
      case "person":
        return <Users size={20} />;
      default:
        return <Shield size={20} />;
    }
  };

  const getPPEColor = (className) => {
    switch (className.toLowerCase()) {
      case "helmet":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "vest":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "boots":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "person":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const ConfidenceBar = ({ value, color = "primary" }) => {
    const colors = {
      primary: "bg-gradient-to-r from-blue-500 to-blue-600",
      success: "bg-gradient-to-r from-green-500 to-green-600",
      warning: "bg-gradient-to-r from-amber-500 to-amber-600",
      danger: "bg-gradient-to-r from-red-500 to-red-600",
    };
    const confValue = typeof value === "number" ? value : parseFloat(value);
    const colorClass = confValue >= 80 ? colors.success : confValue >= 60 ? colors.warning : colors.danger;
    return (
      <div className="confidence-bar-container">
        <div className="confidence-bar-bg">
          <div className={`confidence-bar ${colorClass}`} style={{ width: `${confValue}%` }} />
        </div>
        <span className="confidence-value">{confValue.toFixed(1)}%</span>
      </div>
    );
  };

  const StatCard = ({ title, value, icon, color = "blue", subtitle, trend }) => (
    <div className={`stat-card stat-card-${color}`}>
      <div className="stat-card-icon">
        {icon}
      </div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-title">{title}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {trend && <div className="stat-card-trend">{trend}</div>}
      </div>
    </div>
  );

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="ai-upload-page">
      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="ai-upload-header">
        <div className="header-left">
          <div className="header-icon">
            <Brain size={28} />
          </div>
          <div>
            <h1>AI PPE Detection</h1>
            <p>Upload images or videos to analyze Personal Protective Equipment compliance using VisionShield's trained YOLOv8 model.</p>
          </div>
        </div>
        <div className="header-right">
          <div className="model-status">
            <span className="status-dot active"></span>
            <span>AI Model Active</span>
            <Zap size={14} className="zap-icon" />
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN CONTENT GRID
      ===================================================== */}
      <div className="ai-main-grid">
        {/* LEFT PANEL - UPLOAD & CONFIG */}
        <div className="ai-left-panel">
          {/* Upload Card */}
          <div className="panel upload-panel">
            <div className="panel-header">
              <h2>
                <Upload size={18} />
                Upload Media
              </h2>
            </div>

            {!file ? (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} hidden />
                <div className="upload-icon-large">
                  {fileType === "video" ? <FileVideo size={48} /> : <FileImage size={48} />}
                </div>
                <h3>Drag & Drop or Click to Upload</h3>
                <p>Supports: JPG, PNG, MP4, AVI, MOV (Max 500MB)</p>
                <div className="upload-formats">
                  <span className="format-badge">Images</span>
                  <span className="format-badge">Videos</span>
                </div>
              </div>
            ) : (
              <div className="file-selected">
                <div className="file-preview">
                  {fileType === "image" && filePreview && (
                    <img src={filePreview} alt="Preview" />
                  )}
                  {fileType === "video" && filePreview && (
                    <video src={filePreview} controls muted />
                  )}
                </div>
                <div className="file-info">
                  <div className="file-icon">
                    {fileType === "image" ? <ImageIcon size={24} /> : <FileVideo size={24} />}
                  </div>
                  <div className="file-details">
                    <h4>{file.name}</h4>
                    <p>
                      Type: {fileType === "image" ? "Image" : "Video"} •
                      Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button className="btn-clear" onClick={clearFile} title="Remove file">
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="panel-error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="panel-actions">
              <button
                className="btn btn-primary btn-analyze"
                onClick={handleAnalyze}
                disabled={!file || !fileType || loading}
              >
                {loading ? (
                  <>
                    <div className="spinner-sm" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Run AI Detection
                  </>
                )}
              </button>
              {file && (
                <button className="btn btn-secondary" onClick={clearFile}>
                  <RotateCcw size={16} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Filters Panel - only show when results exist */}
          {result && (
            <div className="panel filters-panel">
              <div className="panel-header">
                <h2>
                  <Filter size={18} />
                  Filters & Search
                </h2>
              </div>
              <div className="filters-grid">
                <div className="filter-group">
                  <label>
                    <Search size={14} />
                    Search Classes
                  </label>
                  <input
                    type="text"
                    placeholder="Search (helmet, vest...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="filter-input"
                  />
                </div>
                <div className="filter-group">
                  <label>
                    <Filter size={14} />
                    Min Confidence: <strong>{confidenceFilter}%</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceFilter}
                    onChange={(e) => setConfidenceFilter(Number(e.target.value))}
                    className="confidence-slider"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Model Info Panel */}
          <div className="panel info-panel">
            <div className="panel-header">
              <h2>
                <Shield size={18} />
                Model Information
              </h2>
            </div>
            <div className="model-info">
              <div className="model-info-item">
                <div className="model-info-icon"><Brain size={16} /></div>
                <div className="model-info-content">
                  <span className="model-info-label">Architecture</span>
                  <span className="model-info-value">YOLOv8</span>
                </div>
              </div>
              <div className="model-info-item">
                <div className="model-info-icon"><Eye size={16} /></div>
                <div className="model-info-content">
                  <span className="model-info-label">Task</span>
                  <span className="model-info-value">Object Detection</span>
                </div>
              </div>
              <div className="model-info-item">
                <div className="model-info-icon"><Shield size={16} /></div>
                <div className="model-info-content">
                  <span className="model-info-label">Classes</span>
                  <span className="model-info-value">helmet, vest, boots, gloves, goggles, cap, person</span>
                </div>
              </div>
              <div className="model-info-item">
                <div className="model-info-icon"><RotateCcw size={16} /></div>
                <div className="model-info-content">
                  <span className="model-info-label">Input Size</span>
                  <span className="model-info-value">640×640</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - RESULTS */}
        <div className="ai-right-panel">
          {!result ? (
            // Empty State
            <div className="panel results-panel empty-state">
              <div className="empty-content">
                <div className="empty-icon">
                  <Brain size={64} />
                </div>
                <h2>No Analysis Yet</h2>
                <p>Upload an image or video and click <strong>"Run AI Detection"</strong> to start PPE compliance analysis.</p>
                <div className="empty-features">
                  <div className="feature-item">
                    <CheckCircle size={16} />
                    <span>Real-time object detection</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle size={16} />
                    <span>PPE compliance reporting</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle size={16} />
                    <span>Confidence scoring</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle size={16} />
                    <span>Annotated output media</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Results
            <div className="panel results-panel">
              {/* Results Header */}
              <div className="results-header">
                <div className="results-title">
                  <h2>{fileType === "video" ? "Video Detection Results" : "Image Detection Results"}</h2>
                  <span className="result-file">{result.filename}</span>
                </div>
                <div className="results-meta">
                  {fileType === "image" && (
                    <span className="meta-badge">{result.count} total detections</span>
                  )}
                  {fileType === "video" && (
                    <>
                      <span className="meta-badge">{result.frames_processed} frames</span>
                      <span className="meta-badge">{result.duration_seconds}s duration</span>
                    </>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="results-tabs">
                <button className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
                  <ImageIcon size={16} />
                  Overview
                </button>
                <button className={`tab-btn ${activeTab === "detections" ? "active" : ""}`} onClick={() => setActiveTab("detections")}>
                  <Search size={16} />
                  Detections
                </button>
                {fileType === "video" && (
                  <button className={`tab-btn ${activeTab === "timeline" ? "active" : ""}`} onClick={() => setActiveTab("timeline")}>
                    <Video size={16} />
                    Timeline
                  </button>
                )}
              </div>

              {/* Media Preview */}
              <div className="media-preview">
                {fileType === "image" && resultImage && (
                  <div className="image-preview">
                    <img src={resultImage} alt="AI Detection Result" />
                    <div className="image-actions">
                      <a href={resultImage} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Open in new tab">
                        <Eye size={16} />
                      </a>
                      <a href={resultImage} download className="btn-icon" title="Download">
                        <Download size={16} />
                      </a>
                    </div>
                  </div>
                )}
                {fileType === "video" && resultVideo && (
                  <div className="video-preview">
                    <video controls src={resultVideo} />
                    <div className="video-actions">
                      <a href={resultVideo} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Open in new tab">
                        <Eye size={16} />
                      </a>
                      <a href={resultVideo} download className="btn-icon" title="Download">
                        <Download size={16} />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <div className="overview-grid">
                    {fileType === "image" && (
                      <>
                        <StatCard title="Total Detections" value={result.count} icon={<Search size={22} />} color="blue" />
                        <StatCard title="Average Confidence" value={`${averageConfidence}%`} icon={<Zap size={22} />} color="green" subtitle={`Min: ${Math.min(...result.detections.map(d => d.confidence * 100)).toFixed(1)}%`} />
                        <StatCard title="Persons Detected" value={imagePersons} icon={<Users size={22} />} color="purple" />
                        <StatCard title="PPE Types Found" value={imagePPETypes} icon={<Shield size={22} />} color="orange" subtitle={imageClassStats.filter(s => s.class !== 'person').map(s => s.class).join(', ')} />
                      </>
                    )}
                    {fileType === "video" && (
                      <>
                        <StatCard title="Persons Detected" value={videoPersonCount} icon={<Users size={22} />} color="blue" />
                        <StatCard title="Frames Processed" value={result.frames_processed} icon={<Video size={22} />} color="green" />
                        <StatCard title="Video Duration" value={`${result.duration_seconds}s`} icon={<Zap size={22} />} color="purple" />
                        <StatCard title="Processing FPS" value={result.fps} icon={<RotateCcw size={22} />} color="orange" />
                      </>
                    )}

                    {/* Class Summary Cards */}
                    <div className="class-summary-grid">
                      {(fileType === "image" ? filteredImageClassStats : filteredVideoClasses.map(c => videoDetections[c])).map((stat, idx) => {
                        const isVideo = fileType === "video";
                        const obj = isVideo ? stat : stat;
                        const count = isVideo ? obj.count : obj.count;
                        const avgConf = isVideo ? obj.average_confidence * 100 : (obj.confidences.reduce((a, b) => a + b, 0) / obj.confidences.length) * 100;
                        const minConf = isVideo ? null : (obj.minConf * 100).toFixed(1);
                        const maxConf = isVideo ? null : (obj.maxConf * 100).toFixed(1);
                        const className = isVideo ? filteredVideoClasses[idx] : obj.class;

                        return (
                          <div key={className} className={`class-summary-card ${getPPEColor(className).replace('bg-', '').replace(' text-', ' border-').replace(' border-', '')}`}>
                            <div className="class-summary-header">
                              <div className="class-icon">{getPPEIcon(className)}</div>
                              <div>
                                <h4>{className}</h4>
                                <span className="class-count">{count} detected</span>
                              </div>
                            </div>
                            <ConfidenceBar value={avgConf} />
                            {minConf && maxConf && (
                              <div className="class-conf-range">
                                Range: {minConf}% - {maxConf}%
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* PPE Compliance Check */}
                    {result && (
                      <div className="compliance-section">
                        <h3 className="compliance-title">
                          <Shield size={18} /> PPE Compliance Check
                        </h3>
                        {compliance.hasPersons ? (
                          compliance.missing.length > 0 ? (
                            <div className="compliance-warning">
                              <div className="compliance-alert">
                                <AlertTriangle size={24} className="alert-icon" />
                                <div className="alert-content">
                                  <strong>Non-Compliant: </strong>
                                  {compliance.missing.length === 1 ? "Missing PPE item:" : "Missing PPE items:"}
                                </div>
                              </div>
                              <div className="missing-ppe-grid">
                                {compliance.missing.map((item, idx) => (
                                  <div key={idx} className="missing-ppe-item">
                                    <span className="missing-icon">{getPPEIcon(item)}</span>
                                    <span className="missing-label">{item.charAt(0).toUpperCase() + item.slice(1)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="compliance-note">
                                {compliance.detected.length > 0 && (
                                  <>
                                    <strong>Detected PPE: </strong>
                                    {compliance.detected.map((d, i) => (
                                        <span key={i} className="detected-badge">{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="compliance-pass">
                              <CheckCircle size={24} className="pass-icon" />
                              <div className="pass-content">
                                <strong>Fully Compliant!</strong> All required PPE detected for {result.detections.filter(d => d.class === "person").length} person(s).
                              </div>
                              <div className="detected-ppe-list">
                                <strong>Detected PPE: </strong>
                                {compliance.detected.map((d, i) => (
                                    <span key={i} className="detected-badge">{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                                ))}
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="compliance-info">
                            <Info size={20} className="info-icon" />
                            <span>No person detected. Upload an image/video with workers to check PPE compliance.</span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* DETECTIONS TAB */}
                {activeTab === "detections" && (
                  <div className="detections-table-container">
                    <div className="table-toolbar">
                      <span className="table-info">
                        Showing <strong>{fileType === "image" ? filteredImageClassStats.length : filteredVideoClasses.length}</strong> of <strong>{fileType === "image" ? imageClassStats.length : videoClasses.length}</strong> classes
                      </span>
                    </div>
                    <div className="table-wrapper">
                      <table className="detections-table">
                        <thead>
                          <tr>
                            <th>Class</th>
                            <th>Count</th>
                            <th>Avg Confidence</th>
                            {fileType === "image" && <th>Confidence Range</th>}
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fileType === "image" ? filteredImageClassStats : filteredVideoClasses).map((item, idx) => {
                            const isVideo = fileType === "video";
                            const className = isVideo ? item : item.class;
                            const obj = isVideo ? videoDetections[item] : item;
                            const count = obj.count;
                            const avgConf = isVideo ? obj.average_confidence * 100 : (obj.confidences.reduce((a, b) => a + b, 0) / obj.confidences.length) * 100;
                            const minConf = isVideo ? null : (obj.minConf * 100).toFixed(1);
                            const maxConf = isVideo ? null : (obj.maxConf * 100).toFixed(1);

                            return (
                              <tr key={className}>
                                <td>
                                  <div className="cell-class">
                                    <span className={`class-badge ${getPPEColor(className)}`}>
                                      {getPPEIcon(className)}
                                      {className}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="cell-count">{count}</span>
                                </td>
                                <td>
                                  <ConfidenceBar value={avgConf} />
                                </td>
                                {fileType === "image" && (
                                  <td className="cell-range">
                                    {minConf}% - {maxConf}%
                                  </td>
                                )}
                                <td>
                                  <span className="cell-status">
                                    <CheckCircle size={14} />
                                    Detected
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(fileType === "image" ? filteredImageClassStats.length : filteredVideoClasses.length) === 0 && (
                      <div className="table-empty">
                        <Search size={24} />
                        <p>No classes match your filters</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TIMELINE TAB - Video only */}
                {activeTab === "timeline" && fileType === "video" && (
                  <div className="timeline-view">
                    <p className="timeline-note">Frame-by-frame detection timeline available in detailed video analysis.</p>
                    <div className="timeline-placeholder">
                      <Video size={48} />
                      <p>Video timeline visualization coming soon</p>
                    </div>
                  </div>
                )}

                {/* TIMELINE TAB - Image fallback */}
                {activeTab === "timeline" && fileType === "image" && (
                  <div className="timeline-view">
                    <p className="timeline-note">Timeline view is available for video analysis only.</p>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="ai-note">
                <AlertTriangle size={18} />
                <span>
                  Detection confidence indicates the model's confidence for an individual detection.
                  It is not the same as overall model accuracy. Results should be verified by safety personnel.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIUpload;