import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Select, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { UserCreateReq, UserInfo } from "#/ims";
import userService from "@/api/services/userService";
import TenantSelect from "@/components/ims/tenant-select";
import { useRoles } from "@/hooks/use-ims-options";
import { useUserInfo } from "@/store/userStore";

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

	const save = useMutation({
		mutationFn: (v: UserCreateReq) => {
			if (!isEdit) return userService.create(v);
			const { password: _p, ...rest } = v;
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
