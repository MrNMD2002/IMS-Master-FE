import { useQuery } from "@tanstack/react-query";
import { Alert, Table } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { UserInfo } from "#/cmc";
import userService from "@/api/services/userService";
import DirectPermissionsTag from "@/components/cmc/direct-permissions-tag";
import { Icon } from "@/components/icon";
import { FLEXIBLE_ROLE, P } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";

const SAMPLE = 100;

/**
 * Vai Tuỳ chỉnh không có bó quyền để tích (backend khoá rỗng) — thay vào đó cho thấy từng tài
 * khoản Tuỳ chỉnh đang có những quyền gì, và chỉ ra nhóm tài khoản TRÙNG bộ quyền: nên gom về
 * một vai riêng để sửa một chỗ thay vì sửa từng người.
 */
export default function FlexibleRolePanel() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const canReadUsers = useCan()(P.USER_READ);
	const { data, isLoading } = useQuery({
		queryKey: ["user", "list", "flexible"],
		queryFn: () => userService.list({ role: FLEXIBLE_ROLE, page: 1, page_size: SAMPLE }),
		enabled: canReadUsers,
	});
	const users = data?.data ?? [];
	const total = data?.metadata.total_items ?? 0;

	// Các nhóm ≥ 2 tài khoản có y hệt bộ quyền (khác rỗng).
	const duplicates = useMemo(() => {
		const byKey = new Map<string, UserInfo[]>();
		for (const u of users) {
			const codes = [...(u.direct_permissions ?? [])].sort();
			if (!codes.length) continue;
			const key = codes.join(",");
			byKey.set(key, [...(byKey.get(key) ?? []), u]);
		}
		return [...byKey.values()].filter((g) => g.length > 1);
	}, [users]);

	return (
		<div className="flex flex-col gap-4">
			<ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
				<li>{t("role.flexible.empty")}</li>
				<li>{t("role.flexible.perAccount")}</li>
				<li>{t("role.flexible.sameSet")}</li>
			</ul>

			{duplicates.map((group) => (
				<Alert
					key={group.map((u) => u.id).join()}
					type="info"
					showIcon
					message={t("role.flexible.duplicate", { count: group.length })}
					description={
						<div className="flex flex-wrap items-center gap-1.5">
							{group.map((u) => (
								<span key={u.id} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
									@{u.username}
								</span>
							))}
							<DirectPermissionsTag role={FLEXIBLE_ROLE} codes={group[0].direct_permissions} />
						</div>
					}
				/>
			))}

			{canReadUsers && (
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="font-medium">{t("role.flexible.accounts", { count: total })}</p>
						<Button size="sm" variant="outline" onClick={() => navigate(`/users?role=${FLEXIBLE_ROLE}`)}>
							<Icon icon="solar:users-group-rounded-linear" size={16} />
							{t("role.flexible.openUsers")}
						</Button>
					</div>
					<Table<UserInfo>
						size="small"
						rowKey="id"
						loading={isLoading}
						dataSource={users}
						pagination={users.length > 10 ? { pageSize: 10, size: "small" } : false}
						locale={{ emptyText: t("role.flexible.none") }}
						columns={[
							{
								title: t("user.field.account"),
								key: "account",
								render: (_, u) => (
									<div>
										<p className="font-medium">{u.full_name || u.username}</p>
										<p className="text-xs text-text-secondary">@{u.username}</p>
									</div>
								),
							},
							{ title: t("user.field.tenant"), dataIndex: "tenant_name", render: (v) => v || "—" },
							{
								title: t("role.flexible.permissions"),
								key: "perms",
								render: (_, u) => <DirectPermissionsTag role={FLEXIBLE_ROLE} codes={u.direct_permissions} />,
							},
						]}
					/>
					{total > SAMPLE && (
						<p className="text-xs text-text-secondary">{t("role.flexible.sampleNote", { count: SAMPLE })}</p>
					)}
				</div>
			)}
		</div>
	);
}
