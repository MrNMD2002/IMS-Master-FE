import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Input, Segmented, Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { dutyCount, INCIDENT_STATUSES, type Incident } from "#/ims";
import incidentService from "@/api/services/incidentService";
import { Icon } from "@/components/icon";
import IncidentFormDrawer from "@/components/ims/incident-form-drawer";
import OrgUnitFilter from "@/components/ims/org-unit-filter";
import PageHeader from "@/components/ims/page-header";
import { IncidentStatusBadge } from "@/components/ims/status";
import { P } from "@/constants/permission";
import { useCan } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { fmtDateTime, fmtFromNow } from "@/utils/format";
import IncidentStatsView from "./stats";

export default function IncidentListPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const can = useCan();
	const [params, setParams] = useSearchParams();
	const status = params.get("status") ?? "";
	// ?view=stats — giữ trên đường dẫn để tải lại / gửi link vẫn mở đúng màn thống kê.
	const view = params.get("view") === "stats" ? "stats" : "list";
	const setView = (v: string) => {
		const next = new URLSearchParams(params);
		if (v === "stats") next.set("view", "stats");
		else next.delete("view");
		setParams(next, { replace: true });
	};
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [search, setSearch] = useState("");
	const [keyword, setKeyword] = useState("");
	const [tenantId, setTenantId] = useState<number | undefined>();
	const [formOpen, setFormOpen] = useState(false);

	const { data, isFetching, refetch } = useQuery({
		queryKey: ["incident", "list", page, pageSize, status, keyword, tenantId],
		queryFn: () =>
			incidentService.list({
				page,
				page_size: pageSize,
				sort_by: "created_at",
				order: "desc",
				status: status || undefined,
				search: keyword || undefined,
				tenant_id: tenantId,
			}),
		placeholderData: keepPreviousData,
	});

	const setStatus = (s: string) => {
		if (s) params.set("status", s);
		else params.delete("status");
		setParams(params, { replace: true });
		setPage(1);
	};

	const columns: ColumnsType<Incident> = [
		{
			title: t("incident.field.name"),
			dataIndex: "name",
			render: (_, r) => (
				<div className="flex items-center gap-3 min-w-[220px]">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
						<Icon icon="solar:siren-rounded-bold-duotone" size={20} />
					</span>
					<div className="min-w-0">
						<p className="font-medium truncate">{r.name}</p>
						<p className="text-xs text-text-secondary truncate max-w-[320px]">
							{r.location_address || r.location || t("incident.noAddress")}
						</p>
					</div>
				</div>
			),
		},
		{ title: t("incident.field.tenant"), dataIndex: "tenant_name", render: (v) => v || "—" },
		{
			title: t("incident.vehicles"),
			key: "devices",
			align: "center",
			render: (_, r) => (
				<span className="inline-flex items-center gap-1 text-sm">
					<Icon icon="solar:bus-linear" size={16} />
					{dutyCount(r.dispatched_devices, r.status === "COMPLETED")}
				</span>
			),
		},
		{
			title: t("incident.field.reporter"),
			key: "reporter",
			render: (_, r) =>
				r.name_reporter || r.phone_number_reporter ? (
					<div className="text-sm">
						<p>{r.name_reporter || "—"}</p>
						<p className="text-xs text-text-secondary">{r.phone_number_reporter}</p>
					</div>
				) : (
					"—"
				),
		},
		{
			title: t("common.createdAt"),
			dataIndex: "created_at",
			render: (v) => (
				<div className="text-sm whitespace-nowrap">
					<p>{fmtDateTime(v)}</p>
					<p className="text-xs text-text-secondary">{fmtFromNow(v)}</p>
				</div>
			),
		},
		{ title: t("common.statusLabel"), dataIndex: "status", render: (s) => <IncidentStatusBadge status={s} /> },
		{
			key: "go",
			width: 48,
			render: () => <Icon icon="solar:alt-arrow-right-linear" size={18} className="text-text-disabled" />,
		},
	];

	return (
		<>
			<PageHeader
				icon="solar:siren-rounded-bold-duotone"
				title={t("sys.nav.incident")}
				description={t("incident.description")}
				actions={
					<>
						<Segmented
							value={view}
							onChange={(v) => setView(v as string)}
							options={[
								{ value: "list", label: t("incident.view.list"), icon: <Icon icon="solar:list-bold" size={16} /> },
								{ value: "stats", label: t("incident.view.stats"), icon: <Icon icon="solar:chart-2-bold" size={16} /> },
							]}
						/>
						{view === "list" && (
							<Button variant="outline" onClick={() => refetch()}>
								<Icon icon="solar:refresh-linear" size={18} />
								{t("common.refresh")}
							</Button>
						)}
						{view === "list" && can(P.INCIDENT_MANAGE) && (
							<Button onClick={() => setFormOpen(true)}>
								<Icon icon="solar:add-circle-bold" size={18} />
								{t("incident.create")}
							</Button>
						)}
					</>
				}
				toolbar={
					view === "list" && (
						<>
							<div className="w-full -mb-3">
								<Tabs
									activeKey={status}
									onChange={setStatus}
									items={[
										{ key: "", label: t("common.all") },
										...INCIDENT_STATUSES.map((s) => ({ key: s, label: t(`incident.status.${s}`) })),
									]}
								/>
							</div>
							<Input.Search
								allowClear
								className="max-w-xs"
								placeholder={t("incident.searchPlaceholder")}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								onSearch={(v) => {
									setKeyword(v.trim());
									setPage(1);
								}}
							/>
							<OrgUnitFilter
								value={tenantId}
								onChange={(v) => {
									setTenantId(v);
									setPage(1);
								}}
							/>
						</>
					)
				}
			/>
			{view === "stats" ? (
				<IncidentStatsView />
			) : (
				<Card className="gap-0 py-5">
					<CardContent className="px-4 sm:px-6">
						<Table
							rowKey="id"
							size="middle"
							scroll={{ x: "max-content" }}
							loading={isFetching}
							columns={columns}
							dataSource={data?.data ?? []}
							onRow={(r) => ({ onClick: () => navigate(`/incidents/${r.id}`), className: "cursor-pointer" })}
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
			)}
			<IncidentFormDrawer
				open={formOpen}
				onClose={() => setFormOpen(false)}
				onSaved={(i) => navigate(`/incidents/${i.id}`)}
			/>
		</>
	);
}
