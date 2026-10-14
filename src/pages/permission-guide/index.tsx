import { useQuery } from "@tanstack/react-query";
import { Input, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Role } from "#/ims";
import userService from "@/api/services/userService";
import { Icon } from "@/components/icon";
import PageHeader from "@/components/ims/page-header";
import { useRoles } from "@/hooks/use-ims-options";
import { Card, CardContent } from "@/ui/card";

// Khớp app/shared/permisson_constant.py ở backend.
const PLATFORM_TIER = new Set([
	"platform.bypass",
	"platform.read",
	"tenant.read",
	"tenant.manage",
	"permission.manage",
	"menu.manage",
]);
const DEFAULT_TENANT_ONLY = new Set([
	"platform.bypass",
	"platform.read",
	"privilege.elevate",
	"tenant.read",
	"tenant.manage",
	"menu.read",
	"menu.manage",
	"setting.read",
	"setting.manage",
]);
const SYSTEM_FLAG = new Set(["scope.device"]);
const RULES = ["effective", "onlyOwn", "scope", "web", "app", "platform"] as const;

type Perm = { code: string; name: string; module?: string | null };
type Row = { kind: "group"; key: string; module: string; count: number } | { kind: "perm"; key: string; perm: Perm };

/**
 * Hướng dẫn / ma trận phân quyền — CHỈ những quyền người xem cấp được cho tài khoản cấp dưới
 * (theo /user/grantable-permissions, tức quyền mình đang giữ, trừ quyền nền tảng nếu không phải
 * quản trị nền tảng), đối chiếu với bó quyền của các vai người xem thấy được.
 */
export default function PermissionGuidePage() {
	const { t } = useTranslation();
	const [q, setQ] = useState("");
	const { roles: allRoles } = useRoles();
	const grantable = useQuery({ queryKey: ["grantable"], queryFn: userService.grantable, staleTime: 60_000 });
	const allowed = useMemo(() => new Set(grantable.data?.permissions.map((p) => p.code) ?? []), [grantable.data]);
	// Chỉ những vai người xem gán được (mọi quyền trong bó đều nằm trong phần mình cấp được).
	const roles = allRoles.filter((r) => grantable.data && r.permissions.every((c) => allowed.has(c)));

	const rows = useMemo<Row[]>(() => {
		const query = q.trim().toLowerCase();
		const byModule = new Map<string, Perm[]>();
		for (const p of grantable.data?.permissions ?? []) {
			const text = `${p.code} ${p.name} ${t(`permission.guide.${p.code}`, { defaultValue: "" })}`.toLowerCase();
			if (query && !text.includes(query)) continue;
			const mod = p.module || "other";
			byModule.set(mod, [...(byModule.get(mod) ?? []), p]);
		}
		return [...byModule.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.flatMap(([module, perms]) => [
				{ kind: "group" as const, key: `g:${module}`, module, count: perms.length },
				...perms.map((perm) => ({ kind: "perm" as const, key: perm.code, perm })),
			]);
	}, [grantable.data, q, t]);

	const total = rows.filter((r) => r.kind === "perm").length;
	const roleLabel = (r: Role) => t(`role.names.${r.code}`, { defaultValue: r.name });
	const groupSpan = 2 + roles.length;

	const columns: ColumnsType<Row> = [
		{
			title: t("permGuide.permission"),
			key: "perm",
			width: 260,
			fixed: "left",
			onCell: (r) => ({ colSpan: r.kind === "group" ? groupSpan : 1 }),
			render: (_, r) =>
				r.kind === "group" ? (
					<span className="font-semibold">
						{t(`permission.module.${r.module}`, { defaultValue: r.module })}
						<span className="ml-2 text-xs font-normal text-text-secondary">({r.count})</span>
					</span>
				) : (
					<div className="flex flex-col gap-1">
						<span className="font-medium">{r.perm.name}</span>
						<code className="text-xs text-text-secondary">{r.perm.code}</code>
						<div className="flex flex-wrap gap-1">
							{PLATFORM_TIER.has(r.perm.code) && <Tag color="red">{t("permGuide.tag.platform")}</Tag>}
							{DEFAULT_TENANT_ONLY.has(r.perm.code) && <Tag color="orange">{t("permGuide.tag.rootOnly")}</Tag>}
							{SYSTEM_FLAG.has(r.perm.code) && <Tag color="blue">{t("permGuide.tag.flag")}</Tag>}
						</div>
					</div>
				),
		},
		{
			title: t("permGuide.meaning"),
			key: "meaning",
			width: 420,
			onCell: (r) => ({ colSpan: r.kind === "group" ? 0 : 1 }),
			render: (_, r) =>
				r.kind === "perm" && (
					<span className="text-sm">{t(`permission.guide.${r.perm.code}`, { defaultValue: "" })}</span>
				),
		},
		...roles.map((role) => ({
			title: <span className="whitespace-nowrap text-xs">{roleLabel(role)}</span>,
			key: `role:${role.code}`,
			width: 96,
			align: "center" as const,
			onCell: (r: Row) => ({ colSpan: r.kind === "group" ? 0 : 1 }),
			render: (_: unknown, r: Row) =>
				r.kind === "perm" && role.permissions.includes(r.perm.code) ? (
					<Icon icon="solar:check-circle-bold" size={20} color="#16A34A" />
				) : null,
		})),
	];

	return (
		<>
			<PageHeader
				icon="solar:book-bookmark-bold-duotone"
				title={t("permGuide.title")}
				description={t("permGuide.description")}
				toolbar={
					<Input
						allowClear
						style={{ width: 320 }}
						prefix={<Icon icon="solar:magnifer-linear" size={16} className="text-text-secondary" />}
						placeholder={t("permGuide.search")}
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
				}
			/>
			<Card className="mb-4">
				<CardContent>
					<p className="mb-2 font-semibold">{t("permGuide.rulesTitle")}</p>
					<ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
						{RULES.map((k) => (
							<li key={k}>{t(`permGuide.rules.${k}`)}</li>
						))}
					</ul>
				</CardContent>
			</Card>
			<Card className="gap-2 py-4">
				<CardContent>
					<p className="mb-3 text-sm text-text-secondary">{t("permGuide.matrixHint", { count: total })}</p>
					<Table<Row>
						size="small"
						rowKey="key"
						columns={columns}
						dataSource={rows}
						loading={grantable.isLoading}
						pagination={false}
						scroll={{ x: 680 + roles.length * 96 }}
						rowClassName={(r) => (r.kind === "group" ? "bg-secondary" : "")}
						locale={{ emptyText: t("permGuide.empty") }}
					/>
				</CardContent>
			</Card>
		</>
	);
}
