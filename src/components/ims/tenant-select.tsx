import { TreeSelect, type TreeSelectProps } from "antd";
import { useTranslation } from "react-i18next";
import { useTenantOptions } from "@/hooks/use-ims-options";

type Props = Omit<TreeSelectProps<number>, "treeData">;

/** Chọn tổ chức / đơn vị theo cây (chỉ những node người dùng nhìn thấy). */
export default function TenantSelect(props: Props) {
	const { t } = useTranslation();
	const { tree, isLoading } = useTenantOptions();
	return (
		<TreeSelect<number>
			showSearch
			allowClear
			treeDefaultExpandAll
			loading={isLoading}
			placeholder={t("tenant.select")}
			treeNodeFilterProp="title"
			popupMatchSelectWidth={false}
			style={{ minWidth: 200 }}
			{...props}
			treeData={tree}
		/>
	);
}
