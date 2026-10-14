/** Mã quyền — khớp `app/shared/permisson_constant.py` của IMS API. */
export const P = {
	USER_READ: "user.read",
	USER_MANAGE: "user.manage",
	USER_PERMISSION_GRANT: "user.permission.grant",
	ROLE_READ: "role.read",
	ROLE_MANAGE: "role.manage",
	PERMISSION_READ: "permission.read",
	TENANT_READ: "tenant.read",
	TENANT_MANAGE: "tenant.manage",
	TENANT_SELF_CONFIG: "tenant.self_config",
	TENANT_SUBTREE_READ: "tenant.subtree_read",
	TENANT_SUBTREE_MANAGE: "tenant.subtree_manage",
	SETTING_READ: "setting.read",
	SETTING_MANAGE: "setting.manage",
	DEVICE_READ: "device.read",
	DEVICE_MANAGE: "device.manage",
	GPS_READ: "gps.read",
	DEVICE_ACTIVITY_READ: "device_activity.read",
	INCIDENT_READ: "incident.read",
	INCIDENT_MANAGE: "incident.manage",
	INCIDENT_READ_ALL: "incident.read.all",
	AUDIT_READ: "audit.read",
	DASHBOARD_ACCESS: "dashboard.access",
	PLATFORM_BYPASS: "platform.bypass",
	PLATFORM_READ: "platform.read",
} as const;

/** Cửa vào trang cây tổ chức (giống READ_GATE của /tenant/list). */
export const TENANT_READ_GATE = [
	P.PLATFORM_BYPASS,
	P.PLATFORM_READ,
	P.TENANT_READ,
	P.TENANT_SUBTREE_READ,
	P.TENANT_SUBTREE_MANAGE,
];

export const INCIDENT_READ_GATE = [P.INCIDENT_READ, P.INCIDENT_READ_ALL];
