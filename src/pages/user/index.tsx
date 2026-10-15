import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Dropdown, Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import type { UserInfo } from "#/cmc";
import userService from "@/api/services/userService";
import DirectPermissionsTag from "@/components/cmc/direct-permissions-tag";
import OrgUnitFilter from "@/components/cmc/org-unit-filter";
import PageHeader from "@/components/cmc/page-header";
import { ActiveBadge } from "@/components/cmc/status";
import { Icon } from "@/components/icon";
import UserAvatar from "@/components/user-avatar";
import { P } from "@/constants/permission";
import { usePermissionCatalog, useRoles } from "@/hooks/use-cmc-options";
import { useCan, useUserInfo } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { fmtFromNow } from "@/utils/format";
import PasswordModal from "./password-modal";
import PermissionDrawer from "./permission-drawer";
import UserModal from "./user-modal";

export default function UserPage() {
	const { t } = useTranslation();
	const { modal } = App.useApp();
	const qc = useQueryClient();
	const can = useCan();
	const me = useUserInfo();
	const canManage = can(P.USER_MANAGE);
	const canGrant = can(P.USER_PERMISSION_GRANT);
	const { roles } = useRoles();
	const { permissions } = usePermissionCatalog();
	// Trang Vai trò dẫn sang bằng ?role=custom để xem các tài khoản Tuỳ chỉnh.
	const [searchParams] = useSearchParams();

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [tenantId, setTenantId] = useState<number | undefined>();
	const [role, setRole] = useState<string | undefined>(() => searchParams.get("role") ?? undefined);
	const [active, setActive] = useState<boolean | undefined>();
	const [permission, setPermission] = useState<string | undefined>();
	const [hasDirect, setHasDirect] = useState<boolean | undefined>();

	const [editing, setEditing] = useState<UserInfo | null | undefined>(undefined);
	const [resetFor, setResetFor] = useState<UserInfo | null>(null);
	const [permFor, setPermFor] = useState<UserInfo | null>(null);

	const { data, isFetching } = useQuery({
		queryKey: ["user", "list", page, pageSize, keyword, tenantId, role, active, permission, hasDirect],
		queryFn: () =>
			userService.list({
				page,
				page_size: pageSize,
				search: keyword || undefined,
				tenant_id: tenantId,
				role,
				is_active: active,
				permission,
				has_direct: hasDirect,
			}),
		placeholderData: keepPreviousData,
	});

	const invalidate = () => qc.invalidateQueries({ queryKey: ["user"] });

	const toggleActive = useMutation({
		mutationFn: (u: UserInfo) => userService.update(u.id, { is_active: !u.is_active }),
		onSuccess: (u) => {
			toast.success(u.is_active ? t("user.unlocked") : t("user.locked"));
			invalidate();
		},
	});
	const remove = useMutation({
		mutationFn: (id: number) => userService.remove(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			invalidate();
		},
	});

	// "Có quyền": gom theo nhóm, tên nhóm làm tiền tố để phân biệt "Xem" / "Quản lý" trùng tên.
	const permissionOptions = useMemo(() => {
		const groups = new Map<string, { value: string; label: string }[]>();
		for (const p of permissions) {
			const mod = p.module || "other";
			const modName = t(`permission.module.${mod}`, { defaultValue: mod });
			groups.set(modName, [...(groups.get(modName) ?? []), { value: p.code, label: `${modName}: ${p.name}` }]);
		}
		return [...groups.entries()]
			.sort(([a], [b]) => a.localeCompare(b, "vi"))
			.map(([label, options]) => ({ label, options }));
	}, [permissions, t]);

	const roleName = (code: string) =>
		t(`role.names.${code}`, { defaultValue: roles.find((r) => r.code === code)?.name ?? code });
	const resetPage =
		<T,>(fn: (v: T) => void) =>
		(v: T) => {
			fn(v);
			setPage(1);
		};

	const columns: ColumnsType<UserInfo> = [
		{
			title: t("user.field.account"),
			key: "account",
			render: (_, u) => (
				<div className="flex items-center gap-3">
					<UserAvatar name={u.full_name || u.username} size={36} />
					<div>
						<p className="font-medium">
							{u.full_name || u.username}
							{u.id === me.id && <span className="ml-1 text-xs text-primary">({t("user.you")})</span>}
						</p>
						<p className="text-xs text-text-secondary">@{u.username}</p>
					</div>
				</div>
			),
		},
		{
			title: t("user.field.role"),
			dataIndex: "role",
			render: (r: string, u) => (
				<div className="flex flex-wrap items-center gap-1">
					<Badge variant={r === "gps_user" ? "warning" : "info"}>{roleName(r)}</Badge>
					{u.is_system_root && <Icon icon="solar:crown-bold" size={16} className="text-warning" />}
					<DirectPermissionsTag role={r} codes={u.direct_permissions} />
					{r !== "gps_user" && !u.permissions?.includes(P.DASHBOARD_ACCESS) && (
						<Badge variant="secondary" title={t("user.noWebAccessHint")}>
							{t("user.noWebAccess")}
						</Badge>
					)}
				</div>
			),
		},
		{ title: t("user.field.tenant"), dataIndex: "tenant_name", render: (v) => v || "—" },
		{
			title: t("user.field.lastLogin"),
			dataIndex: "last_login",
			render: (v) => <span className="text-sm text-text-secondary">{v ? fmtFromNow(v) : t("user.never")}</span>,
		},
		{ title: t("common.statusLabel"), dataIndex: "is_active", render: (v) => <ActiveBadge active={v} /> },
		{
			key: "actions",
			align: "right",
			width: 60,
			render: (_, u) => {
				const self = u.id === me.id;
				const items = [
					...(canManage
						? [
								{
									key: "edit",
									icon: <Icon icon="solar:pen-linear" size={16} />,
									label: t("common.editText"),
									onClick: () => setEditing(u),
								},
							]
						: []),
					...(canGrant && !self
						? [
								{
									key: "perm",
									icon: <Icon icon="solar:shield-keyhole-linear" size={16} />,
									label: t("user.permissions"),
									onClick: () => setPermFor(u),
								},
							]
						: []),
					...(canManage && !self
						? [
								{
									key: "reset",
									icon: <Icon icon="solar:password-linear" size={16} />,
									label: t("user.resetPassword"),
									onClick: () => setResetFor(u),
								},
								...(!u.is_system_root
									? [
											{
												key: "lock",
												icon: (
													<Icon icon={u.is_active ? "solar:lock-linear" : "solar:lock-unlocked-linear"} size={16} />
												),
												label: u.is_active ? t("user.lock") : t("user.unlock"),
												onClick: () => toggleActive.mutate(u),
											},
											{ type: "divider" as const },
											{
												key: "delete",
												danger: true,
												icon: <Icon icon="solar:trash-bin-trash-linear" size={16} />,
												label: t("common.delText"),
												// Hộp xác nhận riêng: Popconfirm đặt trong menu Dropdown bị đóng theo menu nên không xoá được.
												onClick: () =>
													modal.confirm({
														title: t("user.deleteConfirm", { name: u.username }),
														okText: t("common.delText"),
														cancelText: t("common.cancelText"),
														okButtonProps: { danger: true },
														onOk: () => remove.mutateAsync(u.id),
													}),
											},
										]
									: []),
							]
						: []),
				];
				if (!items.length) return null;
				return (
					<Dropdown trigger={["click"]} menu={{ items }}>
						<Button variant="ghost" size="icon">
							<Icon icon="solar:menu-dots-bold" size={18} />
						</Button>
					</Dropdown>
				);
			},
		},
	];

	return (
		<>
			<PageHeader
				icon="solar:users-group-rounded-bold-duotone"
				title={t("sys.nav.user")}
				description={t("user.description")}
				actions={
					canManage && (
						<Button onClick={() => setEditing(null)}>
							<Icon icon="solar:user-plus-bold" size={18} />
							{t("user.create")}
						</Button>
					)
				}
				toolbar={
					<>
						<Input.Search
							allowClear
							className="max-w-xs"
							placeholder={t("user.searchPlaceholder")}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onSearch={(v) => {
								setKeyword(v.trim());
								setPage(1);
							}}
						/>
						<OrgUnitFilter value={tenantId} onChange={resetPage(setTenantId)} />
						<Select
							allowClear
							style={{ minWidth: 160 }}
							placeholder={t("user.field.role")}
							value={role}
							onChange={resetPage(setRole)}
							options={roles.map((r) => ({ value: r.code, label: roleName(r.code) }))}
						/>
						<Select
							allowClear
							showSearch
							optionFilterProp="label"
							style={{ minWidth: 220 }}
							popupMatchSelectWidth={false}
							placeholder={t("user.filter.permission")}
							value={permission}
							onChange={resetPage(setPermission)}
							options={permissionOptions}
						/>
						<Select
							allowClear
							style={{ minWidth: 170 }}
							placeholder={t("user.filter.source")}
							value={hasDirect}
							onChange={resetPage(setHasDirect)}
							options={[
								{ value: true, label: t("user.filter.hasDirect") },
								{ value: false, label: t("user.filter.roleOnly") },
							]}
						/>
						<Select
							allowClear
							style={{ minWidth: 140 }}
							placeholder={t("common.statusLabel")}
							value={active}
							onChange={resetPage(setActive)}
							options={[
								{ value: true, label: t("common.activeText") },
								{ value: false, label: t("common.lockedText") },
							]}
						/>
					</>
				}
			/>
			<Card className="gap-0 py-5">
				<CardContent className="px-4 sm:px-6">
					<Table
						rowKey="id"
						size="middle"
						scroll={{ x: "max-content" }}
						loading={isFetching}
						columns={columns}
						dataSource={data?.data ?? []}
						pagination={{
							current: page,
							pageSize,
							total: data?.metadata.total_items ?? 0,
							showSizeChanger: true,
							showTotal: (total) => t("common.totalItems", { total }),
							onChange: (p, s) => {
								setPage(p);
								setPageSize(s);
							},
						}}
					/>
				</CardContent>
			</Card>

			<UserModal user={editing} onClose={() => setEditing(undefined)} />
			<PasswordModal user={resetFor} onClose={() => setResetFor(null)} />
			<PermissionDrawer user={permFor} onClose={() => setPermFor(null)} />
		</>
	);
}
