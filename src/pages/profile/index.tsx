import { useMutation } from "@tanstack/react-query";
import { Descriptions, Form, Input } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import authService from "@/api/services/authService";
import PageHeader from "@/components/cmc/page-header";
import { MobilizedBadge } from "@/components/cmc/status";
import { Icon } from "@/components/icon";
import UserAvatar from "@/components/user-avatar";
import { useUserActions, useUserInfo } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { fmtDateTime } from "@/utils/format";
import { PASSWORD_RULES } from "../user/user-modal";

export default function ProfilePage() {
	const { t } = useTranslation();
	const me = useUserInfo();
	const { setUserInfo } = useUserActions();
	const [infoForm] = Form.useForm<{ full_name: string }>();
	const [pwForm] = Form.useForm<{ old_password: string; new_password: string; confirm: string }>();

	useEffect(() => {
		infoForm.setFieldsValue({ full_name: me.full_name ?? "" });
	}, [me.full_name, infoForm]);

	const updateInfo = useMutation({
		mutationFn: (v: { full_name: string }) => authService.updateMe(v),
		onSuccess: (u) => {
			setUserInfo(u);
			toast.success(t("common.saved"));
		},
	});
	const changePw = useMutation({
		mutationFn: (v: { old_password: string; new_password: string }) => authService.changePassword(v),
		onSuccess: (u) => {
			setUserInfo(u);
			pwForm.resetFields();
			toast.success(t("profile.passwordChanged"));
		},
	});

	const scopeText = (kind?: string) => (kind ? t(`profile.scope.${kind}`) : "—");

	return (
		<>
			<PageHeader
				icon="solar:user-circle-bold-duotone"
				title={t("sys.nav.profile")}
				description={t("profile.description")}
			/>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
				<Card className="items-center gap-3 py-8 h-fit">
					<UserAvatar name={me.full_name || me.username} size={88} />
					<div className="text-center">
						<p className="text-lg font-bold">{me.full_name || me.username}</p>
						<p className="text-sm text-text-secondary">@{me.username}</p>
					</div>
					<div className="flex flex-wrap justify-center gap-1">
						{me.role && <Badge variant="info">{t(`role.names.${me.role}`, { defaultValue: me.role })}</Badge>}
						{me.tenant_name && <Badge variant="secondary">{me.tenant_name}</Badge>}
					</div>
					<CardContent className="w-full px-6">
						<Descriptions column={1} size="small">
							<Descriptions.Item label={t("user.field.lastLogin")}>{fmtDateTime(me.last_login)}</Descriptions.Item>
							<Descriptions.Item label={t("profile.readScope")}>{scopeText(me.scope?.read.kind)}</Descriptions.Item>
							<Descriptions.Item label={t("profile.writeScope")}>{scopeText(me.scope?.write.kind)}</Descriptions.Item>
							<Descriptions.Item label={t("profile.permissionCount")}>{me.permissions?.length ?? 0}</Descriptions.Item>
							{me.device && (
								<Descriptions.Item label={t("profile.vehicle")}>
									<span className="flex items-center gap-1">
										{me.device.name} <MobilizedBadge mobilized={me.device.is_mobilized} />
									</span>
								</Descriptions.Item>
							)}
						</Descriptions>
					</CardContent>
				</Card>

				<div className="flex flex-col gap-4">
					<Card className="gap-4">
						<CardHeader>
							<CardTitle>{t("profile.info")}</CardTitle>
						</CardHeader>
						<CardContent>
							<Form form={infoForm} layout="vertical" onFinish={(v) => updateInfo.mutate(v)} className="max-w-md">
								<Form.Item label={t("user.field.username")}>
									<Input value={me.username} disabled />
								</Form.Item>
								<Form.Item name="full_name" label={t("user.field.fullName")}>
									<Input />
								</Form.Item>
								<Button type="submit" disabled={updateInfo.isPending}>
									<Icon icon="solar:check-circle-bold" size={18} />
									{t("common.saveText")}
								</Button>
							</Form>
						</CardContent>
					</Card>

					<Card className="gap-4">
						<CardHeader>
							<CardTitle>{t("profile.changePassword")}</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="mb-4 text-sm text-text-secondary">{t("profile.changePasswordHint")}</p>
							<Form
								form={pwForm}
								layout="vertical"
								className="max-w-md"
								onFinish={(v) => changePw.mutate({ old_password: v.old_password, new_password: v.new_password })}
							>
								<Form.Item
									name="old_password"
									label={t("profile.oldPassword")}
									rules={[{ required: true, message: t("validation.required") }]}
								>
									<Input.Password autoComplete="current-password" />
								</Form.Item>
								<Form.Item
									name="new_password"
									label={t("user.field.newPassword")}
									rules={PASSWORD_RULES(t)}
									validateFirst
								>
									<Input.Password autoComplete="new-password" />
								</Form.Item>
								<Form.Item
									name="confirm"
									label={t("user.field.confirmPassword")}
									dependencies={["new_password"]}
									rules={[
										{ required: true, message: t("validation.required") },
										({ getFieldValue }) => ({
											validator: (_, v) =>
												!v || v === getFieldValue("new_password")
													? Promise.resolve()
													: Promise.reject(new Error(t("validation.passwordMismatch"))),
										}),
									]}
								>
									<Input.Password autoComplete="new-password" />
								</Form.Item>
								<Button type="submit" disabled={changePw.isPending}>
									<Icon icon="solar:lock-password-bold" size={18} />
									{t("profile.changePassword")}
								</Button>
							</Form>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
