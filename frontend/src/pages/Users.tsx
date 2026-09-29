import axios from "axios";
import React, { useEffect, useState } from "react";

type User = {
  name: string;
  id_type: string;
  id_number: string;
  vendor_name: string;
  role?: "DRIVER" | "HELPER";
  license_expiry?: string;
  face_image: string;
  status: "PENDING" | "REGISTERED" | "FAILED";
};

const STATUS_COLOR: Record<User["status"], string> = {
  PENDING: "#fbbf24",
  REGISTERED: "#22c55e",
  FAILED: "#ef4444",
};

const STATUS_BG: Record<User["status"], string> = {
  PENDING: "#fef3c7",
  REGISTERED: "#d1fae5",
  FAILED: "#fee2e2",
};

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
    userName?: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    userId: string;
    userName: string;
  } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/users");
      setUsers(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch users", error);
      setLoading(false);
    }
  };

  const showDeleteConfirm = (userId: string, userName: string) => {
    setDeleteConfirm({ userId, userName });
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { userId, userName } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      await axios.delete(`http://localhost:8000/api/users/${userId}`);
      setNotification({
        type: "success",
        message: "User deleted successfully",
        userName,
      });
      fetchUsers();
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({
        type: "error",
        message: "Failed to delete user. Please try again.",
        userName,
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 3000); // polling
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 60,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "4px solid #e5e7eb",
            borderTopColor: "#667eea",
            borderRadius: "50%",
            margin: "0 auto 16px",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "#666", fontSize: 16 }}>Loading users...</p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: "0 0 4px 0",
              color: "#1F2937",
            }}
          >
            Registered Users
          </h2>
          <p style={{ margin: 0, color: "#1F2937", fontSize: 14 }}>
            {users.length} {users.length === 1 ? "user" : "users"} registered
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            background: "white",
            borderRadius: 16,
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>👥</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 20, color: "#333" }}>
            No Users Yet
          </h3>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            Start by registering your first user
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {users.map((user) => (
            <div
              key={user.id_number}
              style={{
                background: "white",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
            >
              {/* User Header with Avatar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <img
                  src={user.face_image}
                  width={72}
                  height={72}
                  style={{
                    borderRadius: 12,
                    objectFit: "cover",
                    border: "3px solid #e5e7eb",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#1f2937",
                    }}
                  >
                    {user.name}
                  </h3>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: STATUS_BG[user.status],
                      color: STATUS_COLOR[user.status],
                    }}
                  >
                    {user.status}
                  </span>
                </div>
              </div>

              {/* User Details */}
              <div
                style={{
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🆔</span>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 2,
                      }}
                    >
                      Aadhar ID
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {user.id_number}
                    </div>
                  </div>
                </div>

                {user.role && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 16 }}>
                      {user.role === "DRIVER" ? "🚗" : "👷"}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 2,
                        }}
                      >
                        Role
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        {user.role === "DRIVER" ? "Driver" : "Helper"}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🏢</span>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 2,
                      }}
                    >
                      Vendor
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {user.vendor_name}
                    </div>
                  </div>
                </div>

                {user.license_expiry && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 16 }}>📅</span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 2,
                        }}
                      >
                        Expiry Date
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#374151",
                        }}
                      >
                        {new Date(user.license_expiry).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <button
                onClick={() => showDeleteConfirm(user.id_number, user.name)}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "10px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#ef4444";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fee2e2";
                  e.currentTarget.style.color = "#dc2626";
                }}
              >
                🗑️ Delete User
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 1000,
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              background:
                notification.type === "success"
                  ? "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)"
                  : "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
              border: `2px solid ${notification.type === "success" ? "#22c55e" : "#ef4444"}`,
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              minWidth: 300,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                background:
                  notification.type === "success"
                    ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                    : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {notification.type === "success" ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              )}
            </div>
            <div>
              <h4
                style={{
                  margin: "0 0 4px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color:
                    notification.type === "success" ? "#15803d" : "#991b1b",
                }}
              >
                {notification.type === "success"
                  ? "User Deleted"
                  : "Delete Failed"}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color:
                    notification.type === "success" ? "#166534" : "#dc2626",
                }}
              >
                {notification.userName && (
                  <strong>{notification.userName}</strong>
                )}{" "}
                {notification.type === "success"
                  ? "has been removed"
                  : "- " + notification.message}
              </p>
            </div>
            <button
              onClick={() => setNotification(null)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
                opacity: 0.6,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={notification.type === "success" ? "#15803d" : "#991b1b"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={cancelDelete}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              animation: "slideIn 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>

            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: 20,
                fontWeight: 700,
                color: "#1f2937",
                textAlign: "center",
              }}
            >
              Delete User?
            </h3>

            <p
              style={{
                margin: "0 0 24px 0",
                fontSize: 14,
                color: "#6b7280",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to delete{" "}
              <strong style={{ color: "#1f2937" }}>
                {deleteConfirm.userName}
              </strong>
              ? This action cannot be undone.
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={cancelDelete}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Users;
