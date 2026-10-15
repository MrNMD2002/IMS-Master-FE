import { Popover, Tag } from "antd";
import { useTranslation } from "react-i18next";
import { FLEXIBLE_ROLE } from "@/constants/permission";
import { usePermissionCatalog } from "@/hooks/use-ims-options";

/**
 * Quyền cấp lẻ của một tài khoản — để phân biệt các tài khoản cùng vai (nhất là vai Tuỳ chỉnh,
 * nơi MỌI quyền đều là cấp lẻ). Rê chuột xem danh sách theo nhóm.
 */
export default function DirectPermissionsTag({ role, codes }: { role: string; codes?: string[] | null }) {
	const { t } = useTranslation();
	const { byCode } = usePermissionCatalog();
	const list = codes ?? [];
	const flexible = role === FLEXIBLE_ROLE;

	if (!list.length) {
		return flexible ? (
			<Tag color="warning" className="m-0">
				{t("user.noPermissions")}
			</Tag>
		) : null;
	}

	const grouped = new Map<string, string[]>();
	for (const code of list) {
		const p = byCode.get(code);
		const mod = p?.module || "other";
		grouped.set(mod, [...(grouped.get(mod) ?? []), p?.name ?? code]);
	}
	const content = (
		<div className="flex max-w-xs flex-col gap-1.5 text-sm">
			{[...grouped.entries()].map(([mod, names]) => (
				<div key={mod}>
					<span className="font-medium">{t(`permission.module.${mod}`, { defaultValue: mod })}: </span>
					<span className="text-text-secondary">{names.join(", ")}</span>
				</div>
			))}
		</div>
	);

	return (
		<Popover content={content} title={t(flexible ? "user.ownPermissions" : "user.directPermissions")}>
			<Tag color={flexible ? "blue" : "purple"} className="m-0 cursor-help">
				{t(flexible ? "user.permCount" : "user.directCount", { count: list.length })}
			</Tag>
		</Popover>
	);
}
