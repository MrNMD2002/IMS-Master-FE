import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { UserInfo } from "#/ims";
import userService from "@/api/services/userService";
import { Icon } from "@/components/icon";
import PermissionChecklist from "@/components/ims/permission-checklist";
import UserAvatar from "@/components/user-avatar";
import { Button } from "@/ui/button";

/** Quyền của một tài khoản = bó quyền của vai (khoá) ∪ quyền cấp lẻ (tích được). */
export default function PermissionDrawer({ user, onClose }: { user: UserInfo | null; onClose: () => void }) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const id = user?.id;
	const detail = useQuery({
		queryKey: ["user", "detail", id],
		queryFn: () => userService.detail(id as number),
		enabled: !!id,
	});
	const grantable = useQuery({
		queryKey: ["grantable"],
		queryFn: userService.grantable,
		enabled: !!id,
		staleTime: 60_000,
	});
	const [direct, setDirect] = useState<string[]>([]);

	const rolePerms = detail.data?.role_permissions ?? [];

	useEffect(() => {
		if (detail.data) setDirect(detail.data.direct_permissions ?? []);
	}, [detail.data]);

	const save = useMutation({
		mutationFn: () => userService.replacePermissions(id as number, [...new Set([...rolePerms, ...direct])]),
		onSuccess: () => {
			toast.success(t("user.permissionsSaved"));
			qc.invalidateQueries({ queryKey: ["user"] });
			onClose();
		},
	});

	return (
		<Drawer
			open={!!user}
			onClose={onClose}
			width={640}
			destroyOnHidden
			title={t("user.permissions")}
			footer={
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						{t("common.cancelText")}
					</Button>
					<Button onClick={() => save.mutate()} disabled={save.isPending || detail.isLoading}>
						<Icon icon="solar:check-circle-bold" size={18} />
						{t("common.saveText")}
					</Button>
				</div>
			}
		>
			{user && (
				<div className="mb-4 flex items-center gap-3 rounded-xl bg-secondary px-4 py-3">
					<UserAvatar name={user.full_name || user.username} size={40} />
					<div>
						<p className="font-semibold">{user.full_name || user.username}</p>
						<p className="text-xs text-text-secondary">
							@{user.username} · {t(`role.names.${user.role}`, { defaultValue: user.role })}
						</p>
					</div>
				</div>
			)}
			<p className="mb-3 text-sm text-text-secondary">{t("user.permissionHint")}</p>
			{detail.isLoading ? (
				<Skeleton active />
			) : (
				<PermissionChecklist
					value={direct}
					onChange={setDirect}
					locked={rolePerms}
					allowed={grantable.data?.permissions.map((p) => p.code)}
				/>
			)}
		</Drawer>
	);
}
