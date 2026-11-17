import { Segmented } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import EmptyState from "@/components/cmc/empty-state";
import PageHeader from "@/components/cmc/page-header";
import { pluginLabel } from "../ai-event/components/event-meta";
import { MockNotice } from "../ai-station/components/station-status";
import { type PluginPage, pluginBySlug } from "./plugins";
import { usePluginFilters } from "./use-plugin-filters";

type View = "list" | "stats";

/**
 * Khung chung của trang một plugin: tiêu đề + chuyển Danh sách ↔ Thống kê (giữ bộ lọc trên URL)
 * + thanh lọc. Nội dung do trang con dựng từ `filters`.
 */
export default function PluginShell({
	view,
	children,
}: {
	view: View;
	children: (p: { plugin: PluginPage; filters: ReturnType<typeof usePluginFilters>["filters"] }) => ReactNode;
}) {
	const { t } = useTranslation();
	const plugin = pluginBySlug(useParams().slug);
	if (!plugin) return <EmptyState text={t("aiPlugin.notFound")} />;
	return (
		<Inner plugin={plugin} view={view}>
			{children}
		</Inner>
	);
}

function Inner({
	plugin,
	view,
	children,
}: {
	plugin: PluginPage;
	view: View;
	children: (p: { plugin: PluginPage; filters: ReturnType<typeof usePluginFilters>["filters"] }) => ReactNode;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { filters, toolbar, query } = usePluginFilters(plugin);
	const base = `/ai/p/${plugin.slug}`;

	return (
		<>
			<PageHeader
				icon={plugin.icon}
				title={pluginLabel(t, plugin.name)}
				description={t(`aiPlugin.desc.${plugin.name}`)}
				actions={
					<Segmented<View>
						value={view}
						onChange={(v) => navigate(`${v === "list" ? base : `${base}/stats`}${query ? `?${query}` : ""}`)}
						options={[
							{ value: "list", label: t("aiPlugin.view.list") },
							{ value: "stats", label: t("aiPlugin.view.stats") },
						]}
					/>
				}
				toolbar={toolbar}
			/>
			<MockNotice />
			<div className="flex flex-col gap-4">{children({ plugin, filters })}</div>
		</>
	);
}
