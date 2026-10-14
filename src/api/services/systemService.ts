import type { AxiosResponse } from "axios";
import type { Paged, PageQuery } from "#/api";
import type { AuditLog, AuditQuery, DashboardStats, Permission, Role, RoleReq } from "#/ims";
import apiClient from "../apiClient";

// ── Vai trò / quyền ─────────────────────────────────────────────────────────

const roleList = (params: PageQuery = {}) =>
	apiClient.get<Paged<Role>>({ url: "/role/list", params: { page_size: 1000, ...params } });
const roleCreate = (data: RoleReq) => apiClient.post<Role>({ url: "/role/create", data });
const roleUpdate = (id: number, data: RoleReq) => apiClient.post<Role>({ url: `/role/update/${id}`, data });
const roleSetPermissions = (id: number, permission_codes: string[]) =>
	apiClient.post<Role>({ url: `/role/${id}/set-permissions`, data: { permission_codes } });
const roleRemove = (id: number) => apiClient.post({ url: `/role/delete/${id}` });

const permissionList = (params: PageQuery & { role?: string } = {}) =>
	apiClient.get<Paged<Permission>>({ url: "/permission/list", params: { page_size: 1000, ...params } });

// ── Nhật ký thao tác ────────────────────────────────────────────────────────

const auditList = (params: PageQuery & AuditQuery) =>
	apiClient.get<Paged<AuditLog>>({ url: "/audit-log/list", params });
const auditActions = () => apiClient.get<string[]>({ url: "/audit-log/actions" });
const auditExport = async (params: AuditQuery) => {
	const res = await apiClient.get<AxiosResponse<Blob>>({
		url: "/audit-log/export",
		params,
		responseType: "blob",
		raw: true,
	});
	const disposition = res.headers["content-disposition"] as string | undefined;
	const name = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1];
	return { blob: res.data, filename: name ? decodeURIComponent(name) : "audit-log.xlsx" };
};

// ── Tổng quan / cài đặt ─────────────────────────────────────────────────────

const dashboardStats = (tenant_id?: number) =>
	apiClient.get<DashboardStats>({ url: "/dashboard/stats", params: { tenant_id } });

export interface GpsRetention {
	enable_gps_cleanup: boolean;
	gps_retention_days: number;
	updated_at?: string | null;
	mongo_ttl_days?: number | null;
	in_sync: boolean;
	mongo_error?: string | null;
}

const gpsRetention = () => apiClient.get<GpsRetention>({ url: "/settings/gps-retention" });
const updateGpsRetention = (data: { enable_gps_cleanup?: boolean; gps_retention_days?: number }) =>
	apiClient.post<GpsRetention>({ url: "/settings/gps-retention/update", data });
const triggerGpsCleanup = () => apiClient.post<{ deleted: number }>({ url: "/settings/gps-retention/trigger" });

export interface AuditRetention {
	enable_audit_cleanup: boolean;
	audit_retention_days: number;
	min_days: number;
	max_days: number;
	updated_at?: string | null;
	cutoff: string;
	total_rows: number;
	expired_rows: number;
	oldest_at?: string | null;
}

const auditRetention = () => apiClient.get<AuditRetention>({ url: "/settings/audit-retention" });
const updateAuditRetention = (data: { enable_audit_cleanup?: boolean; audit_retention_days?: number }) =>
	apiClient.post<AuditRetention>({ url: "/settings/audit-retention/update", data });
const triggerAuditCleanup = () =>
	apiClient.post<{ deleted: number; days: number }>({ url: "/settings/audit-retention/trigger" });
/** Excel các dòng quá hạn (sẽ bị dọn) — lưu trữ trước khi dọn. */
const exportExpiredAudit = async () => {
	const res = await apiClient.get<AxiosResponse<Blob>>({
		url: "/settings/audit-retention/export",
		responseType: "blob",
		raw: true,
	});
	const disposition = res.headers["content-disposition"] as string | undefined;
	const name = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1];
	return { blob: res.data, filename: name ? decodeURIComponent(name) : "nhat-ky-qua-han.xlsx" };
};

export default {
	roleList,
	roleCreate,
	roleUpdate,
	roleSetPermissions,
	roleRemove,
	permissionList,
	auditList,
	auditActions,
	auditExport,
	dashboardStats,
	gpsRetention,
	updateGpsRetention,
	triggerGpsCleanup,
	auditRetention,
	updateAuditRetention,
	triggerAuditCleanup,
	exportExpiredAudit,
};
