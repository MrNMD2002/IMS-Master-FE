import { Checkbox, Collapse, Input, Tooltip } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Permission } from "#/cmc";
import { Icon } from "@/components/icon";
import { usePermissionCatalog } from "@/hooks/use-cmc-options";

interface Props {
	value: string[];
	onChange: (codes: string[]) => void;
	/** Quyền khoá (luôn tích, không bỏ được) — vd bó quyền của vai. */
	locked?: string[];
	/** Chỉ cho tích những mã này (quyền người thao tác cấp được). undefined = tất cả. */
	allowed?: string[];
	disabled?: boolean;
}

/** Danh sách quyền gom theo module, có ô tìm kiếm. */
export default function PermissionChecklist({ value, onChange, locked = [], allowed, disabled }: Props) {
	const { t } = useTranslation();
	const [q, setQ] = useState("");
	const { permissions, isLoading } = usePermissionCatalog();

	const groups = useMemo(() => {
		const query = q.trim().toLowerCase();
		const m = new Map<string, Permission[]>();
		for (const p of permissions) {
			if (query && !`${p.code} ${p.name}`.toLowerCase().includes(query)) continue;
			const mod = p.module || "other";
			m.set(mod, [...(m.get(mod) ?? []), p]);
		}
		return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [permissions, q]);

	const set = new Set(value);
	const lockedSet = new Set(locked);
	const allowedSet = allowed ? new Set(allowed) : null;

	const toggle = (code: string, on: boolean) => onChange(on ? [...value, code] : value.filter((c) => c !== code));

	if (isLoading) return <p className="text-sm text-text-secondary">{t("common.loadingText")}</p>;

	return (
		<div className="flex flex-col gap-3">
			<Input
				allowClear
				size="small"
				prefix={<Icon icon="solar:magnifer-linear" size={14} />}
				placeholder={t("role.searchPermission")}
				value={q}
				onChange={(e) => setQ(e.target.value)}
			/>
			<Collapse
				size="small"
				defaultActiveKey={groups.map(([m]) => m)}
				key={q}
				items={groups.map(([mod, perms]) => {
					const on = perms.filter((p) => set.has(p.code) || lockedSet.has(p.code)).length;
					return {
						key: mod,
						label: (
							<span className="flex w-full items-center justify-between">
								<span className="font-medium">{t(`permission.module.${mod}`, { defaultValue: mod })}</span>
								<span className="text-xs text-text-secondary">
									{on}/{perms.length}
								</span>
							</span>
						),
						children: (
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								{perms.map((p) => {
									const isLocked = lockedSet.has(p.code);
									const notAllowed = !!allowedSet && !allowedSet.has(p.code);
									const box = (
										<Checkbox
											checked={isLocked || set.has(p.code)}
											disabled={disabled || isLocked || (notAllowed && !set.has(p.code))}
											onChange={(e) => toggle(p.code, e.target.checked)}
										>
											<span className="flex flex-col leading-tight">
												<span className="text-sm">{p.name}</span>
												<span className="font-mono text-[11px] text-text-disabled">{p.code}</span>
											</span>
										</Checkbox>
									);
									return (
										<div key={p.code}>
											{isLocked ? (
												<Tooltip title={t("permission.fromRole")}>{box}</Tooltip>
											) : notAllowed ? (
												<Tooltip title={t("permission.notGrantable")}>{box}</Tooltip>
											) : (
												box
											)}
										</div>
									);
								})}
							</div>
						),
					};
				})}
			/>
		</div>
	);
}
