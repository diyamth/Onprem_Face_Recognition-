import axios from "axios";
import React, { useEffect, useState } from "react";

interface VerificationItem {
  request_id: string;
  name: string;
  status: string;
  time: string;
  license_expiry_days: number | null;
  license_status: string | null;
  role: string | null;
  vendor_name: string | null;
  aadhar_id: string | null;
  confidence: number | null;
  match: boolean;
}

interface HistoryResponse {
  data: VerificationItem[];
  total: number;
  limit: number;
  skip: number;
}

const VerificationHistory: React.FC = () => {
  const [history, setHistory] = useState<VerificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 10;

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<HistoryResponse>(
        `http://localhost:8000/api/verifications/history?limit=${limit}&skip=${page * limit}`,
      );
      setHistory(response.data.data);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Error fetching data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "-";
    const date = new Date(timeStr);
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string, match: boolean) => {
    const statusLower = status?.toLowerCase();
    const isSuccess =
      match ||
      statusLower === "identified" ||
      statusLower === "bypass_verified";

    return {
      background: isSuccess ? "#dcfce7" : "#fee2e2",
      color: isSuccess ? "#166534" : "#991b1b",
      text: status || "Unknown",
    };
  };

  const getLicenseBadge = (
    licenseStatus: string | null,
    daysRemaining: number | null,
  ) => {
    if (!licenseStatus) return null;

    let bg = "#e5e7eb";
    let color = "#374151";

    if (licenseStatus === "ACTIVE") {
      bg = "#dcfce7";
      color = "#166534";
    } else if (licenseStatus === "EXPIRING_SOON") {
      bg = "#fef3c7";
      color = "#92400e";
    } else if (
      licenseStatus === "EXPIRED" ||
      licenseStatus === "NOT_AUTHORIZED"
    ) {
      bg = "#fee2e2";
      color = "#991b1b";
    }

    return { bg, color, days: daysRemaining };
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div
      style={{
        background: "#F3F4F6",
        borderRadius: 16,
        padding: 30,
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        minWidth: 1200,
        minHeight: 600,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, color: "#333" }}>
          Verification History
        </h3>
        <button
          onClick={fetchHistory}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            background: "#0d9488",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 40, color: "#dc2626" }}>
          {error}
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          No verification records found
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "0 4px",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#e5e7eb",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Vendor</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>License</th>
                  <th style={thStyle}>Aadhar ID</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const statusBadge = getStatusBadge(item.status, item.match);
                  const licenseBadge = getLicenseBadge(
                    item.license_status,
                    item.license_expiry_days,
                  );

                  return (
                    <tr
                      key={item.request_id}
                      style={{
                        background: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    >
                      <td style={tdStyle}>{item.name || "-"}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            background: statusBadge.background,
                            color: statusBadge.color,
                          }}
                        >
                          {statusBadge.text}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {item.role
                          ? item.role === "DRIVER"
                            ? "🚗 Driver"
                            : item.role === "HELPER"
                              ? "👷 Helper"
                              : item.role
                          : "-"}
                      </td>
                      <td style={tdStyle}>{item.vendor_name || "-"}</td>
                      <td style={tdStyle}>{formatTime(item.time)}</td>
                      <td style={tdStyle}>
                        {licenseBadge ? (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              background: licenseBadge.bg,
                              color: licenseBadge.color,
                            }}
                          >
                            {item.license_status}
                            {licenseBadge.days !== null &&
                              ` (${licenseBadge.days}d)`}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={tdStyle}>
                        {item.aadhar_id ? (
                          <code style={{ fontSize: 12 }}>{item.aadhar_id}</code>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              fontSize: 13,
              color: "#666",
            }}
          >
            <span>
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)}{" "}
              of {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={paginationBtnStyle(page === 0)}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                style={paginationBtnStyle(page >= totalPages - 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: "20px 18px",
  textAlign: "left",
  fontWeight: 600,
  color: "#374151",
  fontSize: 15,
};

const tdStyle: React.CSSProperties = {
  padding: "20px 18px",
  color: "#4b5563",
  fontSize: 14,
};

const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 500,
  background: disabled ? "#e5e7eb" : "#0d9488",
  color: disabled ? "#9ca3af" : "white",
  border: "none",
  borderRadius: 6,
  cursor: disabled ? "not-allowed" : "pointer",
});

export default VerificationHistory;
