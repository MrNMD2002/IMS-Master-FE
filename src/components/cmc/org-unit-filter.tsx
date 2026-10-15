import { Select, TreeSelect } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type TenantTreeNode, useTenantOptions } from "@/hooks/use-cmc-options";
import { cn } from "@/utils";

interface Props {
	/** id node đang lọc (tổ chức hoặc đơn vị). undefined = không lọc. */
	value?: number;
	onChange: (tenantId?: number) => void;
	size?: "small" | "middle";
	className?: string;
}

function findRoot(tree: TenantTreeNode[], id: number): TenantTreeNode | undefined {
	const has = (n: TenantTreeNode): boolean => n.value === id || !!n.children?.some(has);
	return tree.find(has);
}

/**
 * Bộ lọc theo cây tổ chức, chọn theo thứ tự: **Tổ chức → Đơn vị con**.
 *
 * - Thấy nhiều tổ chức (cấp nền tảng): ô "Tổ chức" trước, ô "Đơn vị" chỉ liệt kê đơn vị
 *   thuộc tổ chức đã chọn. Giá trị lọc = đơn vị nếu có, không thì tổ chức (API lọc cả nhánh).
 * - Chỉ thuộc một tổ chức: một ô chọn đơn vị trong cây của mình.
 */
export default function OrgUnitFilter({ value, onChange, size = "middle", className }: Props) {
	const { t } = useTranslation();
	const { tree, isLoading } = useTenantOptions();
	const multiOrg = tree.length > 1;

	const org = useMemo(() => (value ? findRoot(tree, value) : undefined), [tree, value]);
	const unit = org && value !== org.value ? value : undefined;
	const units = multiOrg ? (org?.children ?? []) : tree;

	const unitSelect = (
		<TreeSelect<number>
			size={size}
			showSearch
			allowClear
			treeDefaultExpandAll
			loading={isLoading}
			disabled={multiOrg && (!org || !org.children?.length)}
			placeholder={multiOrg ? t("tenant.allUnits") : t("tenant.select")}
			treeNodeFilterProp="title"
			popupMatchSelectWidth={false}
			style={{ minWidth: size === "small" ? 0 : multiOrg ? 170 : 200 }}
			className={multiOrg ? undefined : className}
			value={multiOrg ? unit : value}
			onChange={(v) => onChange(v ?? (multiOrg ? org?.value : undefined))}
			treeData={units}
		/>
	);

	if (!multiOrg) return unitSelect;

	return (
		<div className={cn("flex gap-2", className)}>
			<Select<number>
				size={size}
				showSearch
				allowClear
				loading={isLoading}
				placeholder={t("tenant.allOrgs")}
				optionFilterProp="label"
				popupMatchSelectWidth={false}
				style={{ minWidth: size === "small" ? 0 : 170 }}
				value={org?.value}
				onChange={(v) => onChange(v)}
				options={tree.map((n) => ({ value: n.value, label: n.title }))}
			/>
			{unitSelect}
		</div>
	);
}
