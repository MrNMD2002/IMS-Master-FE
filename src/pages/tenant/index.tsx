import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input, Popconfirm, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Tenant } from "#/ims";
import tenantService from "@/api/services/tenantService";
import { Icon } from "@/components/icon";
import PageHeader from "@/components/ims/page-header";
import { ActiveBadge } from "@/components/ims/status";
import { P } from "@/constants/permission";
import { useCan, useUserInfo } from "@/store/userStore";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { homePath, tenantComparator } from "@/utils/tenant-order";
import TenantModal, { type TenantModalState } from "./tenant-modal";

type Row = Tenant & { children?: Row[] };

function toTree(items: Tenant[], homeId?: number | null): Row[] {
	const compare = tenantComparator(homePath(items, homeId));
	const ids = new Set(items.map((i) => i.id));
	const map = new Map<number, Row>(items.map((i) => [i.id, { ...i }]));
	const roots: Row[] = [];
	for (const row of map.values()) {
		const parent = row.parent_tenant_id && ids.has(row.parent_tenant_id) ? map.get(row.parent_tenant_id) : undefined;
		if (parent) parent.children = [...(parent.children ?? []), row];
		else roots.push(row);
	}
	const sort = (rows: Row[]) => {
		rows.sort(compare);
		for (const r of rows) if (r.children) sort(r.children);
	};
	sort(roots);
	return roots;
}

export default function TenantPage() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const can = useCan();
	const me = useUserInfo();
	const [search, setSearch] = useState("");
	const [modal, setModal] = useState<TenantModalState>(null);

	const canManageAll = can(P.TENANT_MANAGE, P.PLATFORM_BYPASS);
	const canManageBranch = can(P.TENANT_SUBTREE_MANAGE) || canManageAll;
	const canSelf = can(P.TENANT_SELF_CONFIG);

	const { data, isFetching } = useQuery({
		queryKey: ["tenant", "list"],
		queryFn: () => tenantService.list({ page_size: 1000, sort_by: "name", order: "asc" }),
	});

	const all = data?.data ?? [];
	const tree = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return toTree(all, me.tenant_id);
		return all
			.filter((x) => `${x.name} ${x.code}`.toLowerCase().includes(q))
			.map((x) => ({ ...x }))
			.sort(tenantComparator(homePath(all, me.tenant_id)));
	}, [all, search, me.tenant_id]);

	const remove = useMutation({
		mutationFn: (id: number) => tenantService.remove(id),
		onSuccess: () => {
			toast.success(t("common.deleted"));
			qc.invalidateQueries({ queryKey: ["tenant"] });
			qc.invalidateQueries({ queryKey: ["tenant-options"] });
		},
	});

	const canEdit = (r: Tenant) => canManageBranch || (canSelf && r.id === me.tenant_id);

	const columns: ColumnsType<Row> = [
		{
			title: t("tenant.field.name"),
			dataIndex: "name",
			render: (_, r) => (
				<span className="inline-flex items-center gap-2">
					<Icon
						icon={r.parent_tenant_id ? "solar:buildings-2-bold-duotone" : "solar:buildings-3-bold-duotone"}
						size={20}
						className={r.parent_tenant_id ? "text-info" : "text-primary"}
					/>
					<span className="font-medium">{r.name}</span>
					{r.is_default && <Badge variant="info">{t("tenant.default")}</Badge>}
					{r.id === me.tenant_id && <Badge>{t("tenant.mine")}</Badge>}
				</span>
			),
		},
		{ title: t("tenant.field.code"), dataIndex: "code", render: (v) => <span className="font-mono text-xs">{v}</span> },
		{ title: t("tenant.field.city"), dataIndex: "city", render: (v) => v || "—" },
		{ title: t("common.statusLabel"), dataIndex: "is_active", render: (v) => <ActiveBadge active={v} /> },
		{
			key: "actions",
			align: "right",
			render: (_, r) => (
				<div className="flex justify-end gap-1">
					{canManageBranch && (
						<Tooltip title={t("tenant.addChild")}>
							<Button size="icon" variant="ghost" onClick={() => setModal({ parent: r })}>
								<Icon icon="solar:add-square-linear" size={18} />
							</Button>
						</Tooltip>
					)}
					{canEdit(r) && (
						<Tooltip title={t("common.editText")}>
							<Button size="icon" variant="ghost" onClick={() => setModal({ tenant: r })}>
								<Icon icon="solar:pen-linear" size={18} />
							</Button>
						</Tooltip>
					)}
					{canManageBranch && !r.is_default && r.id !== me.tenant_id && (
						<Popconfirm
							title={t("tenant.deleteConfirm", { name: r.name })}
							description={t("tenant.deleteDesc")}
							okText={t("common.delText")}
							cancelText={t("common.cancelText")}
							okButtonProps={{ danger: true }}
							onConfirm={() => remove.mutateAsync(r.id)}
						>
							<Button size="icon" variant="ghost" className="text-error">
								<Icon icon="solar:trash-bin-trash-linear" size={18} />
							</Button>
						</Popconfirm>
					)}
				</div>
			),
		},
	];

	return (
		<>
			<PageHeader
				icon="solar:buildings-3-bold-duotone"
				title={t("sys.nav.tenant")}
				description={t("tenant.description")}
				actions={
					canManageAll && (
						<Button onClick={() => setModal({})}>
							<Icon icon="solar:add-circle-bold" size={18} />
							{t("tenant.createRoot")}
						</Button>
					)
				}
			/>
			<Card className="gap-0 py-5">
				<CardContent className="px-4 sm:px-6">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
						<Input
							allowClear
							className="max-w-xs"
							prefix={<Icon icon="solar:magnifer-linear" size={16} />}
							placeholder={t("tenant.searchPlaceholder")}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						<span className="text-sm text-text-secondary">{t("tenant.count", { count: all.length })}</span>
					</div>
					<Table
						rowKey="id"
						size="middle"
						loading={isFetching}
						columns={columns}
						dataSource={tree}
						pagination={false}
						expandable={{ defaultExpandAllRows: true }}
						key={all.length}
						scroll={{ x: "max-content" }}
					/>
				</CardContent>
			</Card>
			<TenantModal state={modal} onClose={() => setModal(null)} />
		</>
	);
}
