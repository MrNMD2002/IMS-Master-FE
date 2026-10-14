import { useMutation } from "@tanstack/react-query";
import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { UserInfo } from "#/ims";
import userService from "@/api/services/userService";
import { PASSWORD_RULES } from "./user-modal";

export default function PasswordModal({ user, onClose }: { user: UserInfo | null; onClose: () => void }) {
	const { t } = useTranslation();
	const [form] = Form.useForm<{ password: string; confirm: string }>();
	useEffect(() => {
		if (user) form.resetFields();
	}, [user, form]);

	const reset = useMutation({
		mutationFn: (pw: string) => userService.resetPassword(user?.id as number, pw),
		onSuccess: () => {
			toast.success(t("user.passwordReset"));
			onClose();
		},
	});

	return (
		<Modal
			open={!!user}
			onCancel={onClose}
			title={t("user.resetPasswordFor", { name: user?.username })}
			okText={t("common.confirmText")}
			cancelText={t("common.cancelText")}
			okButtonProps={{ loading: reset.isPending }}
			onOk={() => form.validateFields().then((v) => reset.mutate(v.password))}
			destroyOnHidden
		>
			<p className="mb-3 text-sm text-text-secondary">{t("user.resetPasswordDesc")}</p>
			<Form form={form} layout="vertical">
				<Form.Item name="password" label={t("user.field.newPassword")} rules={PASSWORD_RULES(t)}>
					<Input.Password autoComplete="new-password" />
				</Form.Item>
				<Form.Item
					name="confirm"
					label={t("user.field.confirmPassword")}
					dependencies={["password"]}
					rules={[
						{ required: true, message: t("validation.required") },
						({ getFieldValue }) => ({
							validator: (_, v) =>
								!v || v === getFieldValue("password")
									? Promise.resolve()
									: Promise.reject(new Error(t("validation.passwordMismatch"))),
						}),
					]}
				>
					<Input.Password autoComplete="new-password" />
				</Form.Item>
			</Form>
		</Modal>
	);
}
