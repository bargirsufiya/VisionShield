import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  Wrench,
  X,
  ChevronDown,
  Loader2,
  MessageSquare,
  MoreVertical,
  Download,
  Eye,
} from "lucide-react";
import { apiUrl, ENDPOINTS } from "../config/api";
import {
  getMaintenanceRecords,
  getMaintenanceRecord,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  completeMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceStats,
} from "../data/maintenanceData";

const STATUS_OPTIONS = ["All", "Scheduled", "Due Soon", "Overdue", "Completed"];
const STATUS_COLORS = {
  Scheduled: "status-normal",
  "Due Soon": "status-warning",
  Overdue: "status-alert",
  Completed: "status-completed",
};

function MaintenanceManagement() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    upcoming: 0,
    overdue: 0,
  });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [completingRecord, setCompletingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    equipment_name: "",
    equipment_id: "",
    description: "",
    last_maintenance_date: "",
    next_due_date: "",
    remarks: "",
  });
  const [completeFormData, setCompleteFormData] = useState({
    completion_date: "",
    next_due_date: "",
    remarks: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [user, setUser] = useState(null);

  // Get user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("visionshield_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const canManage = user && ["Administrator", "Supervisor"].includes(user.role);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMaintenanceRecords(page, limit, search, statusFilter);
      setRecords(data.records);
      setTotalPages(data.pagination.total_pages);
      setTotalRecords(data.pagination.total_records);

      // Fetch summary stats from dedicated endpoint (calculates from ALL records)
      const stats = await getMaintenanceStats();
      setSummaryStats(stats);
    } catch (error) {
      console.error("Failed to fetch maintenance records:", error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);
  // No auto-polling: maintenance records are manually managed, not real-time.
  // Data refreshes after user actions (add/edit/delete/complete) via fetchRecords() calls.

  // Date formatting helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const getStatusBadgeClass = (status) => {
    return STATUS_COLORS[status] || "status-normal";
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Form validation
  const validateForm = (data) => {
    const errors = {};
    if (!data.equipment_name.trim()) errors.equipment_name = "Equipment name is required";
    if (!data.equipment_id.trim()) errors.equipment_id = "Equipment ID is required";
    if (!data.description.trim()) errors.description = "Description is required";
    if (!data.last_maintenance_date) errors.last_maintenance_date = "Last maintenance date is required";
    if (!data.next_due_date) errors.next_due_date = "Next due date is required";
    if (data.last_maintenance_date && data.next_due_date) {
      if (new Date(data.next_due_date) <= new Date(data.last_maintenance_date)) {
        errors.next_due_date = "Next due date must be after last maintenance date";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateCompleteForm = (data) => {
    const errors = {};
    if (!data.completion_date) errors.completion_date = "Completion date is required";
    if (data.next_due_date && data.completion_date) {
      if (new Date(data.next_due_date) <= new Date(data.completion_date)) {
        errors.next_due_date = "Next due date must be after completion date";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      equipment_name: "",
      equipment_id: "",
      description: "",
      last_maintenance_date: "",
      next_due_date: "",
      remarks: "",
    });
    setFormErrors({});
  };

  const resetCompleteForm = () => {
    setCompleteFormData({
      completion_date: new Date().toISOString().split("T")[0],
      next_due_date: "",
      remarks: "",
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleCompleteFormChange = (e) => {
    const { name, value } = e.target;
    setCompleteFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData)) return;

    setSubmitting(true);
    try {
      await createMaintenanceRecord(formData, user.session_token);
      setShowAddModal(false);
      resetForm();
      fetchRecords();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData)) return;

    setSubmitting(true);
    try {
      await updateMaintenanceRecord(editingRecord._id, formData, user.session_token);
      setShowEditModal(false);
      setEditingRecord(null);
      resetForm();
      fetchRecords();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!validateCompleteForm(completeFormData)) return;

    setSubmitting(true);
    try {
      await completeMaintenanceRecord(completingRecord._id, completeFormData, user.session_token);
      setShowCompleteModal(false);
      setCompletingRecord(null);
      resetCompleteForm();
      fetchRecords();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setSubmitting(true);
    try {
      await deleteMaintenanceRecord(deletingRecord._id, user.session_token);
      setShowDeleteModal(false);
      setDeletingRecord(null);
      fetchRecords();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setFormData({
      equipment_name: record.equipment_name || "",
      equipment_id: record.equipment_id || "",
      description: record.description || "",
      last_maintenance_date: record.last_maintenance_date ? record.last_maintenance_date.split("T")[0] : "",
      next_due_date: record.next_due_date ? record.next_due_date.split("T")[0] : "",
      remarks: record.remarks || "",
    });
    setShowEditModal(true);
  };

  const openCompleteModal = (record) => {
    setCompletingRecord(record);
    resetCompleteForm();
    setShowCompleteModal(true);
  };

  const openDeleteModal = (record) => {
    setDeletingRecord(record);
    setShowDeleteModal(true);
  };

  const openViewModal = (record) => {
    setViewingRecord(record);
    setShowViewModal(true);
  };

  const today = new Date().toISOString().split("T")[0];

  // Computed: Records for display with row numbers
  const displayRecords = useMemo(() => {
    return records.map((record, index) => ({
      ...record,
      rowNumber: (page - 1) * limit + index + 1,
    }));
  }, [records, page, limit]);

  return (
    <div className="page-content maintenance-management-page">
      <div className="page-header">
        <div>
          <h1>Equipment Maintenance Management</h1>
          <p>Track and manage equipment maintenance schedules</p>
        </div>
        {canManage && (
          <button className="add-maintenance-btn" onClick={() => { resetForm(); setShowAddModal(true); }}>
            <Plus size={18} /> Add Maintenance Record
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="summary-cards-grid">
        <div className="stat-card">
          <div className="stat-icon wrench">
            <Wrench size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summaryStats.total}</span>
            <span className="stat-label">Total Equipment</span>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon alert">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summaryStats.upcoming}</span>
            <span className="stat-label">Due Soon (≤ 7 days)</span>
          </div>
        </div>
        <div className="stat-card critical">
          <div className="stat-icon overdue">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summaryStats.overdue}</span>
            <span className="stat-label">Overdue</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="panel search-filter-panel">
        <div className="search-filter-row">
          <div className="search-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search equipment name, ID, description..."
              value={search}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <div className="filter-wrapper">
            <Filter size={18} className="filter-icon" />
            <select value={statusFilter} onChange={handleStatusFilterChange} className="filter-select">
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="panel table-panel">
        {loading ? (
          <div className="loading-state">
            <Loader2 size={32} className="spin" />
            <p>Loading maintenance records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <Wrench size={48} />
            <h3>No maintenance records found</h3>
            <p>{search || statusFilter !== "All" ? "Try adjusting your search or filter" : "Add your first maintenance record to get started"}</p>
            {canManage && (
              <button className="add-maintenance-btn" onClick={() => { resetForm(); setShowAddModal(true); }}>
                <Plus size={18} /> Add Maintenance Record
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="maintenance-table">
                <thead>
                  <tr className="table-header">
                    <th>#</th>
                    <th>Equipment Name</th>
                    <th>Equipment ID</th>
                    <th>Last Maintenance</th>
                    <th>Next Due</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRecords.map((record) => (
                    <tr key={record._id} className="table-row">
                      <td className="row-number">{record.rowNumber}</td>
                      <td className="equipment-name">{record.equipment_name}</td>
                      <td className="equipment-id">{record.equipment_id}</td>
                      <td className="date-cell">{formatDate(record.last_maintenance_date)}</td>
                      <td className="date-cell">{formatDate(record.next_due_date)}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="remarks-cell" title={record.remarks}>
                        {record.remarks || "—"}
                      </td>
                      <td className="actions-cell">
                        <div className="action-menu">
                          <button className="action-btn" onClick={() => openViewModal(record)} title="View Details">
                            <Eye size={16} />
                          </button>
                          {canManage && (
                            <>
                              <button className="action-btn" onClick={() => openEditModal(record)} title="Edit">
                                <Edit size={16} />
                              </button>
                              {record.status !== "Completed" && (
                                <button className="action-btn complete-btn" onClick={() => openCompleteModal(record)} title="Mark Complete">
                                  <CheckCircle size={16} />
                                </button>
                              )}
                              {canManage && (
                                <button className="action-btn delete-btn" onClick={() => openDeleteModal(record)} title="Delete">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn-secondary pagination-btn"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages} ({totalRecords} records)
                </span>
                <button
                  className="btn-secondary pagination-btn"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingRecord(null); resetForm(); }}>
          <div className="modal modal-maintenance modal-wide" onClick={(e) => e.stopPropagation()}>
            {/* Fixed Header */}
            <div className="modal-header maintenance-modal-header">
              <div className="modal-header-content">
                <div className="modal-header-icon">
                  <Wrench size={24} />
                </div>
                <div>
                  <h2>{showAddModal ? "Add Maintenance Record" : "Edit Maintenance Record"}</h2>
                  <p className="modal-subtitle">
                    {showAddModal
                      ? "Create a new maintenance schedule for your equipment"
                      : `Update maintenance details for ${editingRecord?.equipment_name}`}
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingRecord(null); resetForm(); }} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={showAddModal ? handleAddSubmit : handleEditSubmit} className="modal-form maintenance-form">
              <div className="form-body">
                {/* Section 1: Equipment Information */}
                <fieldset className="form-section">
                  <legend className="form-section-title">
                    <span className="section-icon"><Wrench size={16} /></span>
                    <span>Equipment Information</span>
                  </legend>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="equipment_name">Equipment Name <span className="required">*</span></label>
                      <input
                        type="text"
                        id="equipment_name"
                        name="equipment_name"
                        value={formData.equipment_name}
                        onChange={handleFormChange}
                        className={formErrors.equipment_name ? "error" : ""}
                        placeholder="e.g., Conveyor Belt #1"
                        required
                        autoComplete="off"
                      />
                      {formErrors.equipment_name && <span className="error-message">{formErrors.equipment_name}</span>}
                      <span className="field-hint">Descriptive name for easy identification</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="equipment_id">Equipment ID <span className="required">*</span></label>
                      <input
                        type="text"
                        id="equipment_id"
                        name="equipment_id"
                        value={formData.equipment_id}
                        onChange={handleFormChange}
                        className={formErrors.equipment_id ? "error" : ""}
                        placeholder="e.g., CB-001"
                        required
                        autoComplete="off"
                      />
                      {formErrors.equipment_id && <span className="error-message">{formErrors.equipment_id}</span>}
                      <span className="field-hint">Unique identifier (e.g., asset tag)</span>
                    </div>
                  </div>
                </fieldset>

                {/* Section 2: Maintenance Details */}
                <fieldset className="form-section">
                  <legend className="form-section-title">
                    <span className="section-icon"><MessageSquare size={16} /></span>
                    <span>Maintenance Details</span>
                  </legend>
                  <div className="form-group form-group-full">
                    <label htmlFor="description">Description <span className="required">*</span></label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      className={formErrors.description ? "error" : ""}
                      placeholder="Describe the maintenance task, procedures, or checks to perform..."
                      rows={5}
                      required
                    />
                    {formErrors.description && <span className="error-message">{formErrors.description}</span>}
                    <span className="field-hint">Include specific steps, parts needed, or safety requirements</span>
                  </div>
                </fieldset>

                {/* Section 3: Maintenance Schedule */}
                <fieldset className="form-section">
                  <legend className="form-section-title">
                    <span className="section-icon"><Calendar size={16} /></span>
                    <span>Maintenance Schedule</span>
                  </legend>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="last_maintenance_date">Last Maintenance Date <span className="required">*</span></label>
                      <div className="date-input-wrapper">
                        <Calendar size={18} className="date-icon" />
                        <input
                          type="date"
                          id="last_maintenance_date"
                          name="last_maintenance_date"
                          value={formData.last_maintenance_date}
                          onChange={handleFormChange}
                          className={formErrors.last_maintenance_date ? "error" : ""}
                          max={today}
                          required
                        />
                      </div>
                      {formErrors.last_maintenance_date && <span className="error-message">{formErrors.last_maintenance_date}</span>}
                      <span className="field-hint">When was this equipment last serviced?</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="next_due_date">Next Due Date <span className="required">*</span></label>
                      <div className="date-input-wrapper">
                        <Calendar size={18} className="date-icon" />
                        <input
                          type="date"
                          id="next_due_date"
                          name="next_due_date"
                          value={formData.next_due_date}
                          onChange={handleFormChange}
                          className={formErrors.next_due_date ? "error" : ""}
                          min={formData.last_maintenance_date || today}
                          required
                        />
                      </div>
                      {formErrors.next_due_date && <span className="error-message">{formErrors.next_due_date}</span>}
                      <span className="field-hint">When is the next maintenance due?</span>
                    </div>
                  </div>
                  {/* Schedule Preview */}
                  {(formData.last_maintenance_date || formData.next_due_date) && (
                    <div className="schedule-preview">
                      <div className="schedule-preview-item">
                        <span className="schedule-preview-label">Last Service</span>
                        <span className="schedule-preview-value">{formData.last_maintenance_date ? formatDate(formData.last_maintenance_date) : "Not set"}</span>
                      </div>
                      <div className="schedule-preview-divider" />
                      <div className="schedule-preview-item">
                        <span className="schedule-preview-label">Next Due</span>
                        <span className="schedule-preview-value">{formData.next_due_date ? formatDate(formData.next_due_date) : "Not set"}</span>
                      </div>
                      {formData.last_maintenance_date && formData.next_due_date && (
                        <>
                          <div className="schedule-preview-divider" />
                          <div className="schedule-preview-item schedule-preview-interval">
                            <span className="schedule-preview-label">Interval</span>
                            <span className="schedule-preview-value">
                              {Math.ceil((new Date(formData.next_due_date) - new Date(formData.last_maintenance_date)) / (1000 * 60 * 60 * 24))} days
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </fieldset>

                {/* Section 4: Additional Information */}
                <fieldset className="form-section">
                  <legend className="form-section-title">
                    <span className="section-icon"><Settings size={16} /></span>
                    <span>Additional Information</span>
                  </legend>
                  <div className="form-group form-group-full">
                    <label htmlFor="remarks">Remarks</label>
                    <textarea
                      id="remarks"
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleFormChange}
                      placeholder="Additional notes, observations, or special instructions (optional)"
                      rows={4}
                    />
                    <span className="field-hint">Optional — any extra context for the maintenance team</span>
                  </div>
                </fieldset>
              </div>

              {/* Fixed Footer */}
              <div className="modal-footer maintenance-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => { setShowAddModal(false); setShowEditModal(false); setEditingRecord(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="add-maintenance-btn save-maintenance-btn" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      {showAddModal ? "Saving..." : "Updating..."}
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Save Maintenance Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="modal-overlay" onClick={() => { setShowCompleteModal(false); setCompletingRecord(null); resetCompleteForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mark Maintenance Complete</h2>
              <button className="modal-close" onClick={() => { setShowCompleteModal(false); setCompletingRecord(null); resetCompleteForm(); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Completing maintenance for: <strong>{completingRecord?.equipment_name}</strong> ({completingRecord?.equipment_id})</p>
              <form onSubmit={handleCompleteSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="completion_date">Completion Date *</label>
                  <input
                    type="date"
                    id="completion_date"
                    name="completion_date"
                    value={completeFormData.completion_date}
                    onChange={handleCompleteFormChange}
                    className={formErrors.completion_date ? "error" : ""}
                    max={today}
                    required
                  />
                  {formErrors.completion_date && <span className="error-message">{formErrors.completion_date}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="next_due_date">Next Due Date (Optional)</label>
                  <input
                    type="date"
                    id="next_due_date"
                    name="next_due_date"
                    value={completeFormData.next_due_date}
                    onChange={handleCompleteFormChange}
                    className={formErrors.next_due_date ? "error" : ""}
                    min={completeFormData.completion_date || today}
                    placeholder="Leave empty if no recurring maintenance"
                  />
                  {formErrors.next_due_date && <span className="error-message">{formErrors.next_due_date}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="remarks">Remarks</label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    value={completeFormData.remarks}
                    onChange={handleCompleteFormChange}
                    placeholder="Completion notes (optional)"
                    rows={2}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setShowCompleteModal(false); setCompletingRecord(null); resetCompleteForm(); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="spin" /> : "Mark Complete"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setDeletingRecord(null); }}>
          <div className="modal modal-danger" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Maintenance Record</h2>
              <button className="modal-close" onClick={() => { setShowDeleteModal(false); setDeletingRecord(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <AlertTriangle size={32} />
                <p>Are you sure you want to delete this maintenance record?</p>
                <div className="record-info">
                  <strong>{deletingRecord?.equipment_name}</strong> ({deletingRecord?.equipment_id})
                </div>
                <p className="delete-note">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowDeleteModal(false); setDeletingRecord(null); }}>
                  Cancel
                </button>
                <button type="button" className="btn-danger" onClick={handleDelete} disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && (
        <div className="modal-overlay" onClick={() => { setShowViewModal(false); setViewingRecord(null); }}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Equipment Details</h2>
              <button className="modal-close" onClick={() => { setShowViewModal(false); setViewingRecord(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body view-details">
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Equipment Name</label>
                    <span>{viewingRecord?.equipment_name}</span>
                  </div>
                  <div className="detail-item">
                    <label>Equipment ID</label>
                    <span>{viewingRecord?.equipment_id}</span>
                  </div>
                  <div className="detail-item">
                    <label>Description</label>
                    <span>{viewingRecord?.description}</span>
                  </div>
                  <div className="detail-item">
                    <label>Remarks</label>
                    <span>{viewingRecord?.remarks || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="detail-section">
                <h3>Maintenance Schedule</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Last Maintenance</label>
                    <span>{formatDateTime(viewingRecord?.last_maintenance_date)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Next Due Date</label>
                    <span>{formatDateTime(viewingRecord?.next_due_date)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    <span>
                      <span className={`status-badge ${getStatusBadgeClass(viewingRecord?.status)}`}>
                        {viewingRecord?.status}
                      </span>
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Completion Date</label>
                    <span>{viewingRecord?.completion_date ? formatDateTime(viewingRecord?.completion_date) : "Not completed"}</span>
                  </div>
                </div>
              </div>
              <div className="detail-section">
                <h3>Audit Trail</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Created By</label>
                    <span>{viewingRecord?.created_by}</span>
                  </div>
                  <div className="detail-item">
                    <label>Created At</label>
                    <span>{formatDateTime(viewingRecord?.created_at)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Updated By</label>
                    <span>{viewingRecord?.updated_by}</span>
                  </div>
                  <div className="detail-item">
                    <label>Updated At</label>
                    <span>{formatDateTime(viewingRecord?.updated_at)}</span>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setShowViewModal(false); setViewingRecord(null); }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaintenanceManagement;