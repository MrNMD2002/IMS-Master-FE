import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { TenantOption } from "#/ims";
import deviceService from "@/api/services/deviceService";
import systemService from "@/api/services/systemService";
import tenantService from "@/api/services/tenantService";
import { P } from "@/constants/permission";
import { useCan, useUserInfo } from "@/store/userStore";
import { homePath, tenantComparator } from "@/utils/tenant-order";

export interface TenantTreeNode {
	title: string;
	value: number;
	key: number;
	code: string;
	disabled?: boolean;
	children?: TenantTreeNode[];
}

/** Dựng cây từ danh sách phẳng. Node có cha ngoài phạm vi → thành gốc. */
export function buildTenantTree(options: TenantOption[], homeId?: number | null): TenantTreeNode[] {
	const compare = tenantComparator(homePath(options, homeId));
	const ids = new Set(options.map((o) => o.id));
	const byParent = new Map<number | null, TenantOption[]>();
	for (const o of options) {
		const parent = o.parent_tenant_id && ids.has(o.parent_tenant_id) ? o.parent_tenant_id : null;
		byParent.set(parent, [...(byParent.get(parent) ?? []), o]);
	}
	const build = (parent: number | null): TenantTreeNode[] =>
		(byParent.get(parent) ?? []).sort(compare).map((o) => {
			const children = build(o.id);
			return {
				title: o.name,
				value: o.id,
				key: o.id,
				code: o.code,
				children: children.length ? children : undefined,
			};
		});
	return build(null);
}

/** Các node người dùng nhìn được (mọi tài khoản đều gọi được). */
export function useTenantOptions() {
	const query = useQuery({ queryKey: ["tenant-options"], queryFn: tenantService.options, staleTime: 60_000 });
	const options = query.data ?? [];
	const { tenant_id: homeId } = useUserInfo();
	const tree = useMemo(() => buildTenantTree(options, homeId), [options, homeId]);
	const nameOf = useMemo(() => {
		const m = new Map(options.map((o) => [o.id, o.name]));
		return (id?: number | null) => (id ? (m.get(id) ?? `#${id}`) : "—");
	}, [options]);
	return { ...query, options, tree, nameOf };
}

export function useDeviceTypes() {
	const can = useCan();
	const query = useQuery({
		queryKey: ["device-types"],
		queryFn: () => deviceService.typeList(),
		staleTime: 60_000,
		enabled: can(P.DEVICE_READ),
	});
	const types = query.data?.data ?? [];
	return { ...query, types };
}

export function useRoles() {
	const can = useCan();
	const query = useQuery({
		queryKey: ["roles"],
		queryFn: () => systemService.roleList(),
		staleTime: 60_000,
		enabled: can(P.ROLE_READ, P.USER_READ),
	});
	return { ...query, roles: query.data?.data ?? [] };
}
