import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Form, Input, Modal, Select, Switch } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { UserCreateReq, UserInfo } from "#/ims";
import userService from "@/api/services/userService";
import PermissionChecklist from "@/components/ims/permission-checklist";
import TenantSelect from "@/components/ims/tenant-select";
import { FLEXIBLE_ROLE, P } from "@/constants/permission";
import { useRoles } from "@/hooks/use-ims-options";
import { useCan, useUserInfo } from "@/store/userStore";

export const PASSWORD_RULES = (t: (k: string) => string) => [
	{ required: true, message: t("validation.required") },
	// Mỗi lỗi một câu riêng; Form.Item đặt validateFirst để chỉ hiện lỗi đầu tiên — không trùng
	// với dòng gợi ý chính sách mật khẩu bên dưới ô.
	{ min: 8, message: t("validation.passwordTooShort") },
	{ pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: t("validation.passwordNeedsBoth") },
];

/** `user === null` = tạo mới; `undefined` = đóng. */
export default function UserModal({ user, onClose }: { user: UserInfo | null | undefined; onClose: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const { tenant_id } = useUserInfo();
	const { roles } = useRoles();
	const [form] = Form.useForm<UserCreateReq>();
	const open = user !== undefined;
	const isEdit = !!user;
	const roleCode = Form.useWatch("role", form);
	const canGrant = useCan()(P.USER_PERMISSION_GRANT);
	// Vai Tuỳ chỉnh rỗng: quyền chọn NGAY trong form (tạo mới, hoặc đổi sang Tuỳ chỉnh) — không để
	// tài khoản trắng quyền, và đổi vai không làm mất quyền đang có. Đã là Tuỳ chỉnh thì sửa quyền
	// ở ngăn "Phân quyền".
	const pickPerms = roleCode === FLEXIBLE_ROLE && (!isEdit || user?.role !== FLEXIBLE_ROLE);
	const grantable = useQuery({
		queryKey: ["grantable"],
		queryFn: userService.grantable,
		enabled: open && canGrant,
		staleTime: 60_000,
	});
	const allowed = grantable.data?.permissions.map((p) => p.code);
	const [perms, setPerms] = useState<string[]>([]);
	// Vai không có thẻ vào web → báo trước, tránh tưởng tài khoản hỏng khi không đăng nhập được.
	const roleNoWeb = pickPerms
		? !perms.includes(P.DASHBOARD_ACCESS)
		: roleCode !== "gps_user" && !roles.find((r) => r.code === roleCode)?.permissions.includes(P.DASHBOARD_ACCESS);

	useEffect(() => {
		if (!open) return;
		form.resetFields();
		form.setFieldsValue(
			user
				? {
						username: user.username,
						full_name: user.full_name ?? "",
						role: user.role,
						tenant_id: user.tenant_id,
						is_active: user.is_active,
					}
				: { role: "gps_user", tenant_id, is_active: true },
		);
	}, [open, user, form, tenant_id]);

	// Điền sẵn khi bắt đầu chọn quyền: tạo mới → chỉ thẻ vào web; đổi vai → giữ quyền đang có
	// (bỏ cờ App — tài khoản Tuỳ chỉnh không còn là cán bộ App).
	useEffect(() => {
		if (!pickPerms) return;
		setPerms(isEdit ? (user?.permissions ?? []).filter((c) => c !== P.SCOPE_DEVICE) : [P.DASHBOARD_ACCESS]);
	}, [pickPerms, isEdit, user]);

	const save = useMutation({
		mutationFn: (v: UserCreateReq) => {
			const body = pickPerms && canGrant ? { ...v, permissions: perms } : v;
			if (!isEdit) return userService.create(body);
			const { password: _p, ...rest } = body;
			return userService.update(user.id, rest);
		},
		onSuccess: () => {
			toast.success(isEdit ? t("common.saved") : t("user.created"));
			qc.invalidateQueries({ queryKey: ["user"] });
			onClose();
		},
	});

	return (
		<Modal
			open={open}
			onCancel={onClose}
			title={isEdit ? t("user.edit") : t("user.create")}
			okText={t("common.saveText")}
			cancelText={t("common.cancelText")}
			okButtonProps={{ loading: save.isPending }}
			onOk={() => form.validateFields().then((v) => save.mutate(v))}
			destroyOnHidden
			width={pickPerms ? 760 : 520}
		>
			<Form form={form} layout="vertical" requiredMark="optional" className="mt-2">
				<Form.Item name="full_name" label={t("user.field.fullName")}>
					<Input />
				</Form.Item>
				<Form.Item
					name="username"
					label={t("user.field.username")}
					rules={[
						{ required: true, whitespace: true, message: t("validation.required") },
						{ min: 3, message: t("validation.min3") },
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				{!isEdit && (
					<Form.Item name="password" label={t("user.field.password")} rules={PASSWORD_RULES(t)} validateFirst>
						<Input.Password autoComplete="new-password" />
					</Form.Item>
				)}
				<div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
					<Form.Item
						name="role"
						label={t("user.field.role")}
						rules={[{ required: true, message: t("validation.required") }]}
					>
						<Select
							disabled={user?.is_system_root}
							options={roles.map((r) => ({
								value: r.code,
								label: t(`role.names.${r.code}`, { defaultValue: r.name }),
							}))}
							showSearch
							optionFilterProp="label"
						/>
					</Form.Item>
					<Form.Item name="tenant_id" label={t("user.field.tenant")}>
						<TenantSelect allowClear={false} style={{ width: "100%" }} disabled={user?.is_system_root} />
					</Form.Item>
				</div>
				<p className="mb-3 -mt-2 text-xs text-text-secondary">{t("user.roleHint")}</p>
				{roleCode && roleNoWeb && <p className="mb-3 -mt-2 text-xs text-warning">{t("user.roleNoWebHint")}</p>}
				{pickPerms &&
					(canGrant ? (
						<div className="mb-4 flex flex-col gap-2">
							<p className="text-sm font-medium">{t("user.flexiblePermsTitle")}</p>
							<p className="-mt-1 text-xs text-text-secondary">
								{t(isEdit ? "user.flexiblePermsSwitchHint" : "user.flexiblePermsHint")}
							</p>
							<div className="max-h-[42vh] overflow-y-auto pr-1">
								<PermissionChecklist value={perms} onChange={setPerms} allowed={allowed} />
							</div>
						</div>
					) : (
						<Alert className="mb-4" type="warning" showIcon message={t("user.flexibleNoGrant")} />
					))}
				<Form.Item name="is_active" label={t("common.statusLabel")} valuePropName="checked">
					<Switch
						disabled={user?.is_system_root}
						checkedChildren={t("common.activeText")}
						unCheckedChildren={t("common.lockedText")}
					/>
				</Form.Item>
			</Form>
		</Modal>
	);
}
