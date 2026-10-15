import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Empty, Form, Input, Modal, Popconfirm } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Role, RoleReq } from "#/cmc";
import systemService from "@/api/services/systemService";
import PageHeader from "@/components/cmc/page-header";
import PermissionChecklist from "@/components/cmc/permission-checklist";
import { Icon } from "@/components/icon";
import { FLEXIBLE_ROLE, P } from "@/constants/permission";
import { useRoles } from "@/hooks/use-cmc-options";
import { useCan } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { cn } from "@/utils";
import FlexibleRolePanel from "./flexible-role-panel";

/** 4 vai chính, thấp → cao — không xoá / đổi mã. */
const MAIN_ROLES = ["gps_user", "unit_admin", "tenant_admin", "super_admin"];
const SYSTEM_ROLES = [...MAIN_ROLES, FLEXIBLE_ROLE];
type Section = "main" | "flexible" | "org";
const SECTIONS: Section[] = ["main", "flexible", "org"];
const sectionOf = (code: string): Section =>
	MAIN_ROLES.includes(code) ? "main" : code === FLEXIBLE_ROLE ? "flexible" : "org";

export default function RolePage() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const can = useCan();
	const canManage = can(P.ROLE_MANAGE);
	const { roles, isLoading } = useRoles();
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [perms, setPerms] = useState<string[]>([]);
	const [modal, setModal] = useState<Role | null | undefined>(undefined);

	// Gom 3 nhóm để không lẫn: vai chính (theo bậc), vai linh hoạt, vai do tổ chức tự tạo.
	const grouped = useMemo(
		() =>
			SECTIONS.map((section) => ({
				section,
				items: roles
					.filter((r) => sectionOf(r.code) === section)
					.sort((a, b) =>
						section === "main"
							? MAIN_ROLES.indexOf(a.code) - MAIN_ROLES.indexOf(b.code)
							: a.name.localeCompare(b.name, "vi"),
					),
			})).filter((g) => g.items.length > 0),
		[roles],
	);
	const selected = roles.find((r) => r.id === selectedId) ?? grouped[0]?.items[0];
	const isFlexible = selected?.code === FLEXIBLE_ROLE;

	useEffect(() => {
		if (selected) setPerms(selected.permissions);
	}, [selected]);

	const dirty = selected && [...perms].sort().join() !== [...selected.permissions].sort().join();

	const invalidate = () => qc.invalidateQueries({ queryKey: ["roles"] });
	const savePerms = useMutation({
		mutationFn: () => systemService.roleSetPermissions(selected?.id as number, perms),
		onSuccess: () => {
			toast.success(t("role.permissionsSaved"));
			invalidate();
		},
	});
	const remove = useMutation({
		mutationFn: (id: number) => systemService.roleRemove(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			setSelectedId(null);
			invalidate();
		},
	});

	const roleLabel = (r: Role) => t(`role.names.${r.code}`, { defaultValue: r.name });

	return (
		<>
			<PageHeader
				icon="solar:shield-user-bold-duotone"
				title={t("sys.nav.role")}
				description={t("role.description")}
				actions={
					canManage && (
						<Button onClick={() => setModal(null)}>
							<Icon icon="solar:add-circle-bold" size={18} />
							{t("role.create")}
						</Button>
					)
				}
			/>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
				{/* Danh sách vai ghim dưới khối tiêu đề (cao = --page-bar-h) khi cuộn danh sách quyền. */}
				<Card className="gap-2 py-4 h-fit lg:sticky lg:top-[calc(var(--layout-header-height)+var(--page-bar-h,0px)+8px)] lg:max-h-[calc(100vh-var(--layout-header-height)-var(--page-bar-h,0px)-24px)] lg:overflow-y-auto">
					<CardContent className="flex flex-col gap-1 px-2">
						{!isLoading && roles.length === 0 && <Empty />}
						{grouped.map(({ section, items }) => (
							<div key={section} className="flex flex-col gap-1 [&:not(:first-child)]:mt-3">
								<p className="px-3 pb-1 text-xs font-semibold text-text-secondary">{t(`role.section.${section}`)}</p>
								{items.map((r) => (
									<button
										key={r.id}
										type="button"
										onClick={() => setSelectedId(r.id)}
										className={cn(
											"flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
											selected?.id === r.id ? "bg-primary/10 text-primary" : "hover:bg-action-hover",
										)}
									>
										<Icon
											icon={r.code === FLEXIBLE_ROLE ? "solar:tuning-2-bold-duotone" : "solar:shield-user-bold-duotone"}
											size={22}
										/>
										<p className="min-w-0 flex-1 truncate font-medium">{roleLabel(r)}</p>
										{r.code === FLEXIBLE_ROLE ? (
											<Badge variant="secondary" title={t("role.flexible.badgeHint")}>
												{t("role.flexible.badge")}
											</Badge>
										) : (
											<Badge variant="secondary">{r.permissions.length}</Badge>
										)}
									</button>
								))}
							</div>
						))}
					</CardContent>
				</Card>

				{selected && (
					<Card className="gap-4">
						<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
							<div>
								<CardTitle className="flex items-center gap-2">
									{roleLabel(selected)}
									{SYSTEM_ROLES.includes(selected.code) && <Badge variant="info">{t("role.system")}</Badge>}
								</CardTitle>
								<p className="mt-1 text-sm text-text-secondary">
									{selected.description || t(`role.desc.${selected.code}`, { defaultValue: "" })}
								</p>
							</div>
							{canManage && (
								<div className="flex gap-2">
									<Button size="sm" variant="outline" onClick={() => setModal(selected)}>
										<Icon icon="solar:pen-linear" size={16} />
										{t("common.editText")}
									</Button>
									{!SYSTEM_ROLES.includes(selected.code) && (
										<Popconfirm
											title={t("role.deleteConfirm", { name: selected.name })}
											okText={t("common.delText")}
											cancelText={t("common.cancelText")}
											okButtonProps={{ danger: true }}
											onConfirm={() => remove.mutateAsync(selected.id)}
										>
											<Button size="sm" variant="ghost" className="text-error">
												<Icon icon="solar:trash-bin-trash-linear" size={16} />
											</Button>
										</Popconfirm>
									)}
								</div>
							)}
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{isFlexible && <FlexibleRolePanel />}
							{!isFlexible && selected.code !== "gps_user" && !perms.includes(P.DASHBOARD_ACCESS) && (
								<Alert type="warning" showIcon message={t("role.noWebAccessWarn")} />
							)}
							{!isFlexible && <PermissionChecklist value={perms} onChange={setPerms} disabled={!canManage} />}
							{canManage && !isFlexible && (
								<div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card pt-3">
									<Button variant="outline" disabled={!dirty} onClick={() => setPerms(selected.permissions)}>
										{t("common.resetText")}
									</Button>
									<Button disabled={!dirty || savePerms.isPending} onClick={() => savePerms.mutate()}>
										<Icon icon="solar:check-circle-bold" size={18} />
										{t("common.saveText")}
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</div>
			<RoleModal
				role={modal}
				onClose={() => setModal(undefined)}
				onSaved={(r) => {
					invalidate();
					setSelectedId(r.id);
				}}
			/>
		</>
	);
}

function RoleModal({
	role,
	onClose,
	onSaved,
}: {
	role: Role | null | undefined;
	onClose: () => void;
	onSaved: (r: Role) => void;
}) {
	const { t } = useTranslation();
	const [form] = Form.useForm<RoleReq>();
	const open = role !== undefined;
	const isEdit = !!role;

	useEffect(() => {
		if (!open) return;
		form.resetFields();
		if (role) form.setFieldsValue(role);
	}, [open, role, form]);

	const save = useMutation({
		mutationFn: (v: RoleReq) =>
			isEdit
				? systemService.roleUpdate(role.id, { name: v.name, description: v.description })
				: systemService.roleCreate(v),
		onSuccess: (r) => {
			toast.success(isEdit ? t("common.saved") : t("role.created"));
			onSaved(r);
			onClose();
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={isEdit ? t("role.edit") : t("role.create")}
			okText={t("common.saveText")}
			cancelText={t("common.cancelText")}
			okButtonProps={{ loading: save.isPending }}
			onOk={() => form.validateFields().then((v) => save.mutate(v))}
			destroyOnHidden
		>
			<Form form={form} layout="vertical" requiredMark="optional" className="mt-2">
				<Form.Item
					name="name"
					label={t("role.field.name")}
					rules={[{ required: true, whitespace: true, message: t("validation.required") }]}
				>
					<Input />
				</Form.Item>
				<Form.Item
					name="code"
					label={t("role.field.code")}
					rules={[
						{ required: !isEdit, message: t("validation.required") },
						{ pattern: /^[a-z0-9_]+$/, message: t("validation.roleCode") },
					]}
				>
					<Input className="font-mono" disabled={isEdit} />
				</Form.Item>
				<Form.Item name="description" label={t("common.descriptionLabel")}>
					<Input.TextArea autoSize={{ minRows: 2 }} />
				</Form.Item>
			</Form>
		</Modal>
	);
}
