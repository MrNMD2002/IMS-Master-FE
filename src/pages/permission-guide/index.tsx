import { useQuery } from "@tanstack/react-query";
import { Input, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Role } from "#/ims";
import userService from "@/api/services/userService";
import { Icon } from "@/components/icon";
import PageHeader from "@/components/ims/page-header";
import { useRoles } from "@/hooks/use-ims-options";
import { Card, CardContent } from "@/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { cn } from "@/utils";

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
const RULES = ["effective", "flexible", "onlyOwn", "scope", "web", "app", "platform"] as const;
/** Bậc vai dựng sẵn, thấp → cao. Vai do tổ chức tự tạo xếp sau, theo số quyền. */
const LADDER = ["gps_user", "unit_admin", "tenant_admin", "super_admin"];
const ROLE_COL_W = 112;

type Perm = { code: string; name: string; module?: string | null };
type Row = { kind: "group"; key: string; module: string; perms: Perm[] } | { kind: "perm"; key: string; perm: Perm };

/** Khoảng cách từ mép trên cửa sổ tới đáy khối tiêu đề trang đang ghim — hàng tiêu đề bảng dính ngay dưới đó. */
function readPinOffset() {
	const s = getComputedStyle(document.documentElement);
	return (
		(Number.parseFloat(s.getPropertyValue("--layout-header-height")) || 0) +
		(Number.parseFloat(s.getPropertyValue("--page-bar-h")) || 0)
	);
}

function usePinOffset() {
	const [offset, setOffset] = useState(readPinOffset);
	useEffect(() => {
		const mo = new MutationObserver(() => setOffset(readPinOffset()));
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
		setOffset(readPinOffset());
		return () => mo.disconnect();
	}, []);
	return offset;
}

/**
 * Hướng dẫn / ma trận phân quyền — CHỈ những quyền người xem cấp được cho tài khoản cấp dưới
 * (theo /user/grantable-permissions, tức quyền mình đang giữ, trừ quyền nền tảng nếu không phải
 * quản trị nền tảng), đối chiếu với bó quyền của các vai người xem gán được.
 */
export default function PermissionGuidePage() {
	const { t } = useTranslation();
	const [q, setQ] = useState("");
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [hoverRole, setHoverRole] = useState<string | null>(null);
	const [focusRole, setFocusRole] = useState<string | null>(null);
	const pinOffset = usePinOffset();
	const { roles: allRoles } = useRoles();
	const grantable = useQuery({ queryKey: ["grantable"], queryFn: userService.grantable, staleTime: 60_000 });
	const allowed = useMemo(() => new Set(grantable.data?.permissions.map((p) => p.code) ?? []), [grantable.data]);

	// Chỉ những vai người xem gán được (mọi quyền trong bó đều nằm trong phần mình cấp được); bỏ vai rỗng.
	const roles = useMemo(() => {
		if (!grantable.data) return [];
		const rank = (r: Role) => {
			const i = LADDER.indexOf(r.code);
			return i === -1 ? LADDER.length : i;
		};
		return allRoles
			.filter((r) => r.permissions.length > 0 && r.permissions.every((c) => allowed.has(c)))
			.sort((a, b) => rank(a) - rank(b) || a.permissions.length - b.permissions.length);
	}, [allRoles, allowed, grantable.data]);

	const roleLabel = (r: Role) => t(`role.names.${r.code}`, { defaultValue: r.name });
	const focused = roles.find((r) => r.code === focusRole) ?? null;
	const activeCol = focusRole ?? hoverRole;
	/** Vai bậc dưới gần nhất mà vai này BAO TRỌN (có mọi quyền của nó) — để chỉ ra vai này có thêm gì. */
	const lowerOf = (role: Role) => {
		const i = LADDER.indexOf(role.code);
		for (let j = i - 1; j >= 0; j--) {
			const r = roles.find((x) => x.code === LADDER[j]);
			if (r?.permissions.every((c) => role.permissions.includes(c))) return r;
		}
		return null;
	};
	const added = (role: Role, lower: Role) => role.permissions.filter((c) => !lower.permissions.includes(c));

	const groups = useMemo(() => {
		const query = q.trim().toLowerCase();
		const byModule = new Map<string, Perm[]>();
		for (const p of grantable.data?.permissions ?? []) {
			const text = `${p.code} ${p.name} ${t(`permission.guide.${p.code}`, { defaultValue: "" })}`.toLowerCase();
			if (query && !text.includes(query)) continue;
			const mod = p.module || "other";
			byModule.set(mod, [...(byModule.get(mod) ?? []), p]);
		}
		return [...byModule.entries()].sort(([a], [b]) =>
			t(`permission.module.${a}`, { defaultValue: a }).localeCompare(
				t(`permission.module.${b}`, { defaultValue: b }),
				"vi",
			),
		);
	}, [grantable.data, q, t]);

	const rows = useMemo<Row[]>(
		() =>
			groups.flatMap(([module, perms]) => [
				{ kind: "group" as const, key: `g:${module}`, module, perms },
				// Đang tìm kiếm thì luôn mở nhóm để thấy kết quả.
				...(collapsed.has(module) && !q ? [] : perms.map((perm) => ({ kind: "perm" as const, key: perm.code, perm }))),
			]),
		[groups, collapsed, q],
	);

	const total = grantable.data?.permissions.length ?? 0;
	const shown = groups.reduce((n, [, perms]) => n + perms.length, 0);
	const permName = (code: string) => {
		const p = grantable.data?.permissions.find((x) => x.code === code);
		if (!p) return code;
		const mod = p.module || "other";
		return `${t(`permission.module.${mod}`, { defaultValue: mod })}: ${p.name}`;
	};
	const toggleGroup = (module: string) =>
		setCollapsed((s) => {
			const next = new Set(s);
			next.has(module) ? next.delete(module) : next.add(module);
			return next;
		});
	const allCollapsed = groups.length > 0 && groups.every(([m]) => collapsed.has(m));

	const columns: ColumnsType<Row> = [
		{
			title: (
				<div className="flex items-center justify-between gap-2">
					<span>{t("permGuide.permission")}</span>
					<button
						type="button"
						className="text-xs font-normal text-primary hover:underline"
						onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(([m]) => m)))}
					>
						{allCollapsed ? t("permGuide.expandAll") : t("permGuide.collapseAll")}
					</button>
				</div>
			),
			key: "perm",
			width: 440,
			fixed: "left",
			onCell: (r) =>
				r.kind === "group" ? { onClick: () => toggleGroup(r.module), className: "cursor-pointer select-none" } : {},
			render: (_, r) =>
				r.kind === "group" ? (
					<span className="flex items-center gap-2 font-semibold">
						<Icon
							icon="solar:alt-arrow-down-linear"
							size={16}
							className={cn("transition-transform", collapsed.has(r.module) && !q && "-rotate-90")}
						/>
						{t(`permission.module.${r.module}`, { defaultValue: r.module })}
						<span className="text-xs font-normal text-text-secondary">{r.perms.length}</span>
					</span>
				) : (
					<div className="flex flex-col gap-1 py-0.5 pl-6">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span className="font-medium">{r.perm.name}</span>
							{PLATFORM_TIER.has(r.perm.code) && (
								<Tag color="red" className="m-0">
									{t("permGuide.tag.platform")}
								</Tag>
							)}
							{DEFAULT_TENANT_ONLY.has(r.perm.code) && (
								<Tag color="orange" className="m-0">
									{t("permGuide.tag.rootOnly")}
								</Tag>
							)}
							{SYSTEM_FLAG.has(r.perm.code) && (
								<Tag color="blue" className="m-0">
									{t("permGuide.tag.flag")}
								</Tag>
							)}
						</div>
						<span className="text-sm leading-snug text-text-secondary">
							{t(`permission.guide.${r.perm.code}`, { defaultValue: "" })}
						</span>
						<code className="text-xs text-text-disabled">{r.perm.code}</code>
					</div>
				),
		},
		...roles.map((role) => {
			const lower = lowerOf(role);
			const plus = lower ? added(role, lower).length : 0;
			const isActive = activeCol === role.code;
			const cellBg = isActive ? "bg-primary/[0.06]" : "";
			return {
				key: `role:${role.code}`,
				width: ROLE_COL_W,
				align: "center" as const,
				onHeaderCell: () => ({
					onMouseEnter: () => setHoverRole(role.code),
					onMouseLeave: () => setHoverRole(null),
					onClick: () => setFocusRole((c) => (c === role.code ? null : role.code)),
					className: cn("cursor-pointer select-none !align-top", cellBg, focusRole === role.code && "!bg-primary/10"),
				}),
				onCell: () => ({
					onMouseEnter: () => setHoverRole(role.code),
					onMouseLeave: () => setHoverRole(null),
					className: cellBg,
				}),
				title: (
					<Tooltip
						title={
							lower && plus > 0
								? t("permGuide.moreThan", { count: plus, role: roleLabel(lower) })
								: t("permGuide.focusHint")
						}
					>
						<div className="flex flex-col items-center gap-1.5">
							<span
								className={cn("whitespace-nowrap text-xs font-semibold", focusRole === role.code && "text-primary")}
							>
								{roleLabel(role)}
							</span>
							<div className="h-1 w-16 overflow-hidden rounded-full bg-primary/10">
								<div
									className="h-full rounded-full bg-primary"
									style={{ width: `${(role.permissions.length / Math.max(total, 1)) * 100}%` }}
								/>
							</div>
							<span className="text-[11px] font-normal text-text-secondary">
								{t("permGuide.roleCount", { count: role.permissions.length })}
								{plus > 0 && <span className="ml-1 font-medium text-primary">+{plus}</span>}
							</span>
						</div>
					</Tooltip>
				),
				render: (_: unknown, r: Row) => {
					if (r.kind === "group") {
						const has = r.perms.filter((p) => role.permissions.includes(p.code)).length;
						return (
							<span
								className={cn(
									"text-xs tabular-nums",
									has === r.perms.length
										? "font-semibold text-primary"
										: has === 0
											? "text-text-disabled"
											: "text-text-secondary",
								)}
							>
								{has}/{r.perms.length}
							</span>
						);
					}
					return role.permissions.includes(r.perm.code) ? (
						<span className="inline-flex text-primary">
							<Icon icon="solar:check-circle-bold" size={20} />
						</span>
					) : (
						<span className="inline-block h-1 w-1 rounded-full bg-current align-middle text-text-disabled" />
					);
				},
			};
		}),
	];

	const focusLower = focused ? lowerOf(focused) : null;
	const focusAdded = focused && focusLower ? added(focused, focusLower) : [];

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
			<Collapsible defaultOpen className="mb-4 rounded-xl border bg-card">
				<CollapsibleTrigger className="group flex w-full items-center justify-between px-5 py-3 text-left font-semibold">
					{t("permGuide.rulesTitle")}
					<Icon
						icon="solar:alt-arrow-down-linear"
						size={18}
						className="transition-transform group-data-[state=closed]:-rotate-90"
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<ul className="grid list-disc gap-x-10 gap-y-1.5 px-5 pb-4 pl-10 text-sm lg:grid-cols-2">
						{RULES.map((k) => (
							<li key={k}>{t(`permGuide.rules.${k}`)}</li>
						))}
					</ul>
				</CollapsibleContent>
			</Collapsible>
			<Card className="gap-2 py-4">
				<CardContent>
					<p className="mb-3 text-sm text-text-secondary">
						{q
							? t("permGuide.matrixHintFiltered", { count: shown, total })
							: t("permGuide.matrixHint", { count: total })}
					</p>
					{focused && (
						<div className="mb-3 flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span>{t("permGuide.focus", { role: roleLabel(focused), count: focused.permissions.length })}</span>
								<button type="button" className="text-primary hover:underline" onClick={() => setFocusRole(null)}>
									{t("permGuide.focusClear")}
								</button>
							</div>
							{focusLower && focusAdded.length > 0 && (
								<div className="flex flex-wrap items-center gap-1.5">
									<span className="text-text-secondary">
										{t("permGuide.focusAdded", { role: roleLabel(focusLower) })}
									</span>
									{focusAdded.map((c) => (
										<Tag key={c} color="blue" className="m-0">
											{permName(c)}
										</Tag>
									))}
								</div>
							)}
						</div>
					)}
					<Table<Row>
						size="small"
						rowKey="key"
						columns={columns}
						dataSource={rows}
						loading={grantable.isLoading}
						pagination={false}
						sticky={{ offsetHeader: pinOffset }}
						scroll={{ x: 440 + roles.length * ROLE_COL_W }}
						rowClassName={(r) =>
							cn(
								r.kind === "group" && "bg-secondary/60 [&>td]:!bg-secondary/60",
								r.kind === "perm" && focused && !focused.permissions.includes(r.perm.code) && "opacity-40",
							)
						}
						locale={{ emptyText: t("permGuide.empty") }}
					/>
				</CardContent>
			</Card>
		</>
	);
}
