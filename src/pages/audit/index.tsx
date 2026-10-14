import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DatePicker, Descriptions, Drawer, Input, Select, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AuditLog, AuditQuery } from "#/ims";
import systemService from "@/api/services/systemService";
import { Icon } from "@/components/icon";
import OrgUnitFilter from "@/components/ims/org-unit-filter";
import PageHeader from "@/components/ims/page-header";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { downloadBlob, fmtDateTime } from "@/utils/format";

const METHOD_VARIANT: Record<string, "info" | "success" | "warning" | "error" | "secondary"> = {
	GET: "secondary",
	POST: "info",
	PUT: "warning",
	PATCH: "warning",
	DELETE: "error",
};

export default function AuditPage() {
	const { t } = useTranslation();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<AuditQuery>({});
	const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
	const [viewing, setViewing] = useState<AuditLog | null>(null);

	const query: AuditQuery = {
		...filters,
		from_time: range?.[0].toISOString(),
		to_time: range?.[1].toISOString(),
	};

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["audit", page, pageSize, query],
		queryFn: () =>
			systemService.auditList({ page, page_size: pageSize, sort_by: "created_at", order: "desc", ...query }),
		placeholderData: keepPreviousData,
	});
	const actions = useQuery({ queryKey: ["audit-actions"], queryFn: systemService.auditActions, staleTime: 60_000 });

	const exportXlsx = useMutation({
		mutationFn: () => systemService.auditExport(query),
		onSuccess: ({ blob, filename }) => downloadBlob(blob, filename),
	});

	const setFilter = (patch: AuditQuery) => {
		setFilters((f) => ({ ...f, ...patch }));
		setPage(1);
	};

	const columns: ColumnsType<AuditLog> = [
		{
			title: t("audit.time"),
			dataIndex: "created_at",
			render: (v) => <span className="whitespace-nowrap text-sm">{fmtDateTime(v, "DD/MM/YYYY HH:mm:ss")}</span>,
		},
		{ title: t("audit.actor"), dataIndex: "actor_label", render: (v) => v || "—" },
		{
			title: t("audit.action"),
			dataIndex: "action",
			render: (v: string, r) => (
				<div>
					<p className="text-sm font-medium">{t(`audit.actions.${v}`, { defaultValue: v })}</p>
					<p className="flex items-center gap-1 text-xs text-text-secondary">
						<Badge variant={METHOD_VARIANT[r.method] ?? "secondary"}>{r.method}</Badge>
						<span className="font-mono truncate max-w-[280px]">{r.path}</span>
					</p>
				</div>
			),
		},
		{
			title: t("audit.result"),
			dataIndex: "outcome",
			render: (v, r) =>
				v === "success" ? (
					<Badge variant="success">
						{t("audit.success")} · {r.status_code}
					</Badge>
				) : (
					<Badge variant="error">
						{t("audit.failure")} · {r.status_code}
					</Badge>
				),
		},
		{ title: "IP", dataIndex: "ip", render: (v) => <span className="font-mono text-xs">{v || "—"}</span> },
	];

	return (
		<>
			<PageHeader
				icon="solar:document-text-bold-duotone"
				title={t("sys.nav.audit")}
				description={t("audit.description")}
				actions={
					<>
						<Button variant="outline" onClick={() => refetch()}>
							<Icon icon="solar:refresh-linear" size={18} />
							{t("common.refresh")}
						</Button>
						<Button onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
							<Icon icon={exportXlsx.isPending ? "svg-spinners:180-ring" : "solar:file-download-bold"} size={18} />
							{t("audit.export")}
						</Button>
					</>
				}
				toolbar={
					<>
						<Input.Search
							allowClear
							className="max-w-xs"
							placeholder={t("audit.searchPlaceholder")}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onSearch={(v) => setFilter({ search: v.trim() || undefined })}
						/>
						<OrgUnitFilter value={filters.tenant_id} onChange={(v) => setFilter({ tenant_id: v })} />
						<Select
							allowClear
							showSearch
							style={{ minWidth: 200 }}
							placeholder={t("audit.action")}
							value={filters.action}
							onChange={(v) => setFilter({ action: v })}
							options={(actions.data ?? []).map((a) => ({
								value: a,
								label: t(`audit.actions.${a}`, { defaultValue: a }),
							}))}
						/>
						<Select
							allowClear
							style={{ minWidth: 140 }}
							placeholder={t("audit.result")}
							value={filters.outcome}
							onChange={(v) => setFilter({ outcome: v })}
							options={[
								{ value: "success", label: t("audit.success") },
								{ value: "failure", label: t("audit.failure") },
							]}
						/>
						<DatePicker.RangePicker
							showTime={{ format: "HH:mm" }}
							format="DD/MM/YYYY HH:mm"
							value={range}
							onChange={(v) => {
								setRange(v?.[0] && v[1] ? [v[0], v[1]] : null);
								setPage(1);
							}}
						/>
					</>
				}
			/>
			<Card className="gap-0 py-5">
				<CardContent className="px-4 sm:px-6">
					<Table
						rowKey="id"
						size="middle"
						scroll={{ x: "max-content" }}
						loading={isFetching}
						columns={columns}
						dataSource={data?.data ?? []}
						onRow={(r) => ({ onClick: () => setViewing(r), className: "cursor-pointer" })}
						pagination={{
							current: page,
							pageSize,
							total: data?.metadata.total_items ?? 0,
							showSizeChanger: true,
							showTotal: (total) => t("common.totalItems", { total }),
							onChange: (p, s) => {
								setPage(p);
								setPageSize(s);
							},
						}}
					/>
				</CardContent>
			</Card>
			<Drawer open={!!viewing} onClose={() => setViewing(null)} width={520} title={t("audit.detail")}>
				{viewing && (
					<Descriptions column={1} size="small" bordered>
						<Descriptions.Item label={t("audit.time")}>
							{fmtDateTime(viewing.created_at, "DD/MM/YYYY HH:mm:ss")}
						</Descriptions.Item>
						<Descriptions.Item label={t("audit.actor")}>{viewing.actor_label || "—"}</Descriptions.Item>
						<Descriptions.Item label={t("audit.action")}>{viewing.action}</Descriptions.Item>
						<Descriptions.Item label={t("audit.resource")}>
							{viewing.resource || "—"}
							{viewing.resource_id ? ` #${viewing.resource_id}` : ""}
						</Descriptions.Item>
						<Descriptions.Item label="Request">
							<span className="font-mono text-xs">
								{viewing.method} {viewing.path}
							</span>
						</Descriptions.Item>
						<Descriptions.Item label={t("audit.result")}>
							{viewing.outcome} · HTTP {viewing.status_code}
						</Descriptions.Item>
						<Descriptions.Item label="IP">{viewing.ip || "—"}</Descriptions.Item>
						<Descriptions.Item label="User agent">
							<span className="text-xs">{viewing.user_agent || "—"}</span>
						</Descriptions.Item>
						<Descriptions.Item label="Request ID">
							<Typography.Text copyable className="font-mono text-xs">
								{viewing.request_id || "—"}
							</Typography.Text>
						</Descriptions.Item>
					</Descriptions>
				)}
			</Drawer>
		</>
	);
}
