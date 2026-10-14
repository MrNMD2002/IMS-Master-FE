import { Navigate, type RouteObject } from "react-router";
import { GLOBAL_CONFIG } from "@/global-config";
import DashboardLayout from "@/layouts/dashboard";
import LoginAuthGuard from "@/routes/components/login-auth-guard";
import { Component } from "./utils";

const pages: RouteObject[] = [
	{ path: "dashboard", element: Component("/pages/dashboard") },
	{ path: "monitoring", element: Component("/pages/monitoring") },
	{ path: "incidents", element: Component("/pages/incident") },
	{ path: "incidents/:id", element: Component("/pages/incident/detail") },
	{ path: "activity", element: Component("/pages/activity") },
	{ path: "devices", element: Component("/pages/device") },
	{ path: "organization", element: Component("/pages/tenant") },
	{ path: "users", element: Component("/pages/user") },
	{ path: "roles", element: Component("/pages/role") },
	{ path: "audit-log", element: Component("/pages/audit") },
	{ path: "settings", element: Component("/pages/settings") },
	{ path: "profile", element: Component("/pages/profile") },
];

export const dashboardRoutes: RouteObject[] = [
	{
		element: (
			<LoginAuthGuard>
				<DashboardLayout />
			</LoginAuthGuard>
		),
		children: [{ index: true, element: <Navigate to={GLOBAL_CONFIG.defaultRoute} replace /> }, ...pages],
	},
];
