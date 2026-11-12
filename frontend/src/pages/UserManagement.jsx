import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  Settings,
  X,
  Save,
  RefreshCw,
  KeyRound,
  Power,
} from "lucide-react";
import { apiUrl, ENDPOINTS } from "../config/api";

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total_users: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false
  });

  // Add User
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("Operator");
  const [formError, setFormError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Manage User
  const [selectedUser, setSelectedUser] = useState(null);
  const [manageRole, setManageRole] = useState("Operator");
  const [manageStatus, setManageStatus] = useState("Active");

  // Reset Password
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");

  const [manageError, setManageError] = useState("");
  const [manageSuccess, setManageSuccess] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);

  // -----------------------------------------
  // Fetch Users
  // -----------------------------------------

  const fetchUsers = async (page = 1, limit = 10) => {
    if (!user?.session_token) {
      setError("Administrator authentication token is missing.");
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response = await fetch(
        apiUrl(`${ENDPOINTS.getUsers}?admin_token=${encodeURIComponent(
          user.session_token
        )}&page=${page}&limit=${limit}`)
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load users.");
      }

      // Update pagination info from response
      if (data.pagination) {
        setPagination(prev => ({
          ...prev,
          ...data.pagination
        }));
        setUsers(data.users || []);
      } else {
        // Fallback if API doesn't return pagination metadata
        const userArray = Array.isArray(data) ? data : [];
        setUsers(userArray);
        setPagination(prev => ({
          ...prev,
          page,
          limit,
          total_users: userArray.length,
          total_pages: Math.ceil(userArray.length / limit),
          has_next: page * limit < userArray.length,
          has_prev: page > 1
        }));
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "Administrator") {
      fetchUsers(pagination.page, pagination.limit);
    }
  }, [user, pagination.page, pagination.limit]);

  // -----------------------------------------
  // Add User
  // -----------------------------------------

  const handleCreateUser = async () => {
    if (!newUsername.trim()) {
      setFormError("Please enter a username.");
      return;
    }

    if (!newPassword.trim()) {
      setFormError("Please enter a password.");
      return;
    }

    if (newPassword.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    if (!user?.session_token) {
      setFormError("Administrator authentication token is missing.");
      return;
    }

    try {
      setFormError("");
      setCreatingUser(true);

      const response = await fetch(
        apiUrl(`${ENDPOINTS.createUser}?admin_token=${encodeURIComponent(
          user.session_token
        )}`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: newUsername.trim(),
            password: newPassword,
            role: newRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create user.");
      }

      await fetchUsers();

      setNewUsername("");
      setNewPassword("");
      setNewRole("Operator");
      setShowAddUser(false);

      setManageSuccess(
        `${data.role} account "${data.username}" created successfully.`
      );

      setTimeout(() => {
        setManageSuccess("");
      }, 4000);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setCreatingUser(false);
    }
  };

  // -----------------------------------------
  // Open Manage Panel
  // -----------------------------------------

  const handleOpenManage = (selected) => {
    if (selected.role === "Administrator") {
      return;
    }

    setSelectedUser(selected);
    setManageRole(selected.role);
    setManageStatus(selected.status);

    setResetPassword("");
    setResetPasswordConfirm("");

    setManageError("");
    setManageSuccess("");
  };

  // -----------------------------------------
  // Close Manage Panel
  // -----------------------------------------

  const handleCloseManage = () => {
    setSelectedUser(null);
    setManageError("");
    setManageSuccess("");
    setResetPassword("");
    setResetPasswordConfirm("");
  };

  // -----------------------------------------
  // Change Role
  // -----------------------------------------

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    try {
      setManageError("");
      setManageSuccess("");
      setSavingChanges(true);

      const response = await fetch(
        apiUrl(`${ENDPOINTS.updateUserRole}?admin_token=${encodeURIComponent(
          user.session_token
        )}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: selectedUser.username,
            role: manageRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update role.");
      }

      await fetchUsers();

      setSelectedUser((prev) => ({
        ...prev,
        role: manageRole,
      }));

      setManageSuccess("User role updated successfully.");

      setTimeout(() => {
        setManageSuccess("");
      }, 3000);
    } catch (error) {
      setManageError(error.message);
    } finally {
      setSavingChanges(false);
    }
  };

  // -----------------------------------------
  // Change Status
  // -----------------------------------------

  const handleChangeStatus = async () => {
    if (!selectedUser) return;

    const newStatus =
      manageStatus === "Active" ? "Inactive" : "Active";

    try {
      setManageError("");
      setManageSuccess("");
      setSavingChanges(true);

      const response = await fetch(
        apiUrl(`${ENDPOINTS.updateUserStatus}?admin_token=${encodeURIComponent(
          user.session_token
        )}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: selectedUser.username,
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update status.");
      }

      await fetchUsers();

      setManageStatus(newStatus);

      setSelectedUser((prev) => ({
        ...prev,
        status: newStatus,
      }));

      setManageSuccess(
        `User ${newStatus.toLowerCase()} successfully.`
      );

      setTimeout(() => {
        setManageSuccess("");
      }, 3000);
    } catch (error) {
      setManageError(error.message);
    } finally {
      setSavingChanges(false);
    }
  };

  // -----------------------------------------
  // Reset Password
  // -----------------------------------------

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    if (!resetPassword.trim()) {
      setManageError("Please enter a new password.");
      return;
    }

    if (resetPassword.length < 6) {
      setManageError("Password must be at least 6 characters.");
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setManageError("Passwords do not match.");
      return;
    }

    try {
      setManageError("");
      setManageSuccess("");
      setSavingChanges(true);

      const response = await fetch(
        apiUrl(`${ENDPOINTS.resetUserPassword}?admin_token=${encodeURIComponent(
          user.session_token
        )}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: selectedUser.username,
            new_password: resetPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to reset password.");
      }

      setResetPassword("");
      setResetPasswordConfirm("");

      setManageSuccess("Password reset successfully.");

      setTimeout(() => {
        setManageSuccess("");
      }, 3000);
    } catch (error) {
      setManageError(error.message);
    } finally {
      setSavingChanges(false);
    }
  };

  // -----------------------------------------
  // Access Restriction
  // -----------------------------------------

  if (user?.role !== "Administrator") {
    return (
      <div className="user-management-page">
        <div className="user-management-header">
          <div>
            <h1>User Management</h1>
            <p>Administrator access required.</p>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------
  // UI
  // -----------------------------------------

  return (
    <div className="user-management-page">

      {/* Header */}
      <div className="user-management-header">
        <div>
          <div className="user-management-title">
            <Users size={28} />
            <div>
              <h1>User Management</h1>
              <p>
                Manage Administrator, Supervisor and Operator accounts.
              </p>
            </div>
          </div>
        </div>

        <div className="user-management-actions">
          <button
  className="user-refresh-btn"
  onClick={() => fetchUsers(pagination.page, pagination.limit)}
  title="Refresh users"
>
  <RefreshCw size={17} />
  Refresh
</button>

          <button
            className="add-user-btn"
            onClick={() => {
              setShowAddUser(true);
              setFormError("");
            }}
          >
            <UserPlus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Success Message */}
      {manageSuccess && (
        <div className="user-success-message">
          <UserCheck size={18} />
          <span>{manageSuccess}</span>
        </div>
      )}

      {/* General Error */}
      {error && (
        <div className="user-error-message">
          {error}
        </div>
      )}

      {/* Add User Form */}
      {showAddUser && (
        <div className="add-user-card">

          <div className="add-user-card-header">
            <div>
              <h2>
                <UserPlus size={20} />
                Add New User
              </h2>
              <p>Create a Supervisor or Operator account.</p>
            </div>
          </div>

          <div className="add-user-card-header-actions">
            <button
              className="close-panel-btn"
              onClick={() => {
                setShowAddUser(false);
                setFormError("");
              }}
            >
              <X size={19} />
            </button>
          </div>

          {formError && (
            <div className="user-form-error">
              {formError}
            </div>
          )}

          <div className="user-form-grid">

            <div className="user-form-field">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>

            <div className="user-form-field">
              <label>Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="Operator">Operator</option>
                <option value="Supervisor">Supervisor</option>
              </select>
            </div>

            <div className="user-form-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

          </div>

          <div className="user-form-actions">
            <button
              className="cancel-user-btn"
              onClick={() => {
                setShowAddUser(false);
                setFormError("");
              }}
            >
              Cancel
            </button>

            <button
              className="create-user-btn"
              onClick={handleCreateUser}
              disabled={creatingUser}
            >
              <UserPlus size={17} />
              {creatingUser ? "Creating..." : "Create User"}
            </button>
          </div>

        </div>
      )}

      {/* Users Card */}
      <div className="system-users-card">

        <div className="system-users-header">
          <div>
            <h2>
              <Shield size={21} />
              System Users
            </h2>
            <p>
              {pagination.total_users} registered user
              {pagination.total_users !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {loading && (
          <div className="users-loading">
            Loading users...
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="users-empty">
            No users found.
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Access</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((item) => (
                  <tr key={item.username}>

                    <td>
                      <div className="user-name-cell">
                        <div className="user-avatar-small">
                          {item.username
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{item.username}</strong>

                          {item.role === "Administrator" && (
                            <span className="protected-label">
                              Protected
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`role-badge ${item.role
                          .toLowerCase()
                          .replace("administrator", "admin")}`}
                      >
                        {item.role}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${item.status.toLowerCase()}`}
                      >
                        <span className="status-dot"></span>
                        {item.status}
                      </span>
                    </td>

                    <td>
                      {item.role === "Administrator" ? (
                        <span className="protected-access">
                          <Shield size={15} />
                          Full Access
                        </span>
                      ) : (
                        <span className="normal-access">
                          <UserCheck size={15} />
                          Standard
                        </span>
                      )}
                    </td>

                    <td>
                      {item.role === "Administrator" ? (
                        <span className="protected-text">
                          Protected
                        </span>
                      ) : (
                        <button
                          className="manage-user-btn"
                          onClick={() => handleOpenManage(item)}
                        >
                          <Settings size={16} />
                          Manage
                        </button>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination Controls */}
            <div className="pagination-container">
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
        )}

      </div>

      {/* -----------------------------------------
          Manage User Modal
      ----------------------------------------- */}

      {selectedUser && (
        <div className="manage-modal-overlay">

          <div className="manage-user-modal">

            <div className="manage-modal-header">
              <div>
                <h2>
                  <Settings size={21} />
                  Manage User
                </h2>

                <p>
                  Manage account settings for{" "}
                  <strong>{selectedUser.username}</strong>
                </p>
              </div>

              <button
                className="close-panel-btn"
                onClick={handleCloseManage}
              >
                <X size={19} />
              </button>
            </div>

            {manageError && (
              <div className="user-form-error">
                {manageError}
              </div>
            )}

            {/* User Information */}
            <div className="manage-user-info">

              <div className="manage-user-avatar">
                {selectedUser.username
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <strong>{selectedUser.username}</strong>

                <span>
                  Current role: {selectedUser.role}
                </span>

                <span>
                  Current status: {selectedUser.status}
                </span>
              </div>

            </div>

            {/* Role */}
            <div className="manage-section">

              <div className="manage-section-title">
                <Shield size={18} />
                <div>
                  <h3>Role</h3>
                  <p>Change the user's system role.</p>
                </div>
              </div>

              <div className="manage-inline-control">

                <select
                  value={manageRole}
                  onChange={(e) => setManageRole(e.target.value)}
                >
                  <option value="Operator">Operator</option>
                  <option value="Supervisor">Supervisor</option>
                </select>

                <button
                  className="manage-save-btn"
                  onClick={handleChangeRole}
                  disabled={
                    savingChanges ||
                    manageRole === selectedUser.role
                  }
                >
                  <Save size={16} />
                  Save Role
                </button>

              </div>

            </div>

            {/* Account Status */}
            <div className="manage-section">

              <div className="manage-section-title">
                <Power size={18} />
                <div>
                  <h3>Account Status</h3>
                  <p>
                    Control whether this account can log in.
                  </p>
                </div>
              </div>

              <div className="manage-status-row">

                <span
                  className={`status-badge ${manageStatus.toLowerCase()}`}
                >
                  <span className="status-dot"></span>
                  {manageStatus}
                </span>

                <button
                  className={
                    manageStatus === "Active"
                      ? "deactivate-user-btn"
                      : "activate-user-btn"
                  }
                  onClick={handleChangeStatus}
                  disabled={savingChanges}
                >
                  <Power size={16} />

                  {manageStatus === "Active"
                    ? "Deactivate User"
                    : "Activate User"}
                </button>

              </div>

            </div>

            {/* Reset Password */}
            <div className="manage-section">

              <div className="manage-section-title">
                <KeyRound size={18} />
                <div>
                  <h3>Reset Password</h3>
                  <p>
                    Set a new password for this account.
                  </p>
                </div>
              </div>

              <div className="reset-password-grid">

                <div className="user-form-field">
                  <label>New Password</label>

                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={resetPassword}
                    onChange={(e) =>
                      setResetPassword(e.target.value)
                    }
                  />
                </div>

                <div className="user-form-field">
                  <label>Confirm Password</label>

                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={resetPasswordConfirm}
                    onChange={(e) =>
                      setResetPasswordConfirm(e.target.value)
                    }
                  />
                </div>

              </div>

              <button
                className="reset-password-btn"
                onClick={handleResetPassword}
                disabled={savingChanges}
              >
                <KeyRound size={16} />
                Reset Password
              </button>

            </div>

            {/* Footer */}
            <div className="manage-modal-footer">

              <button
                className="cancel-user-btn"
                onClick={handleCloseManage}
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );} /* End of UserManagement component */

export default UserManagement;