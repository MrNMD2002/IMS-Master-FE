import { Icon } from "@/components/icon";
import type { NavProps } from "@/components/nav";
import { INCIDENT_READ_GATE, P, TENANT_READ_GATE } from "@/constants/permission";

/** Menu trái. `auth` = cần ít nhất một trong các quyền. */
export const frontendNavData: NavProps["data"] = [
	{
		name: "sys.nav.group.operation",
		items: [
			{
				title: "sys.nav.dashboard",
				path: "/dashboard",
				icon: <Icon icon="solar:widget-5-bold-duotone" size="24" />,
				auth: [P.DASHBOARD_ACCESS],
			},
			{
				title: "sys.nav.monitoring",
				path: "/monitoring",
				icon: <Icon icon="solar:map-point-wave-bold-duotone" size="24" />,
				auth: [P.GPS_READ],
			},
			{
				title: "sys.nav.incident",
				path: "/incidents",
				icon: <Icon icon="solar:siren-rounded-bold-duotone" size="24" />,
				auth: INCIDENT_READ_GATE,
			},
			{
				title: "sys.nav.activity",
				path: "/activity",
				icon: <Icon icon="solar:route-bold-duotone" size="24" />,
				auth: [P.DEVICE_ACTIVITY_READ],
			},
		],
	},
	{
		name: "sys.nav.group.management",
		items: [
			{
				title: "sys.nav.device",
				path: "/devices",
				icon: <Icon icon="solar:bus-bold-duotone" size="24" />,
				auth: [P.DEVICE_READ],
			},
			{
				title: "sys.nav.tenant",
				path: "/organization",
				icon: <Icon icon="solar:buildings-3-bold-duotone" size="24" />,
				auth: TENANT_READ_GATE,
			},
			{
				title: "sys.nav.user",
				path: "/users",
				icon: <Icon icon="solar:users-group-rounded-bold-duotone" size="24" />,
				auth: [P.USER_READ],
			},
			{
				title: "sys.nav.role",
				path: "/roles",
				icon: <Icon icon="solar:shield-user-bold-duotone" size="24" />,
				auth: [P.ROLE_READ],
			},
			{
				title: "sys.nav.permGuide",
				path: "/permission-guide",
				icon: <Icon icon="solar:book-bookmark-bold-duotone" size="24" />,
				auth: [P.USER_PERMISSION_GRANT],
			},
		],
	},
	{
		name: "sys.nav.group.system",
		items: [
			{
				title: "sys.nav.audit",
				path: "/audit-log",
				icon: <Icon icon="solar:document-text-bold-duotone" size="24" />,
				auth: [P.AUDIT_READ],
			},
			{
				title: "sys.nav.settings",
				path: "/settings",
				icon: <Icon icon="solar:settings-bold-duotone" size="24" />,
				auth: [P.DEVICE_READ, P.SETTING_READ],
			},
		],
	},
];
