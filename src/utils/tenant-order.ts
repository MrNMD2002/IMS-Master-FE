/**
 * Thứ tự hiển thị cây tổ chức: node quyền cao nhất lên đầu.
 *   1. Tổ chức mặc định của hệ thống (cấp nền tảng) — nếu dữ liệu có cờ `is_default`.
 *   2. Nhánh chứa đơn vị của người đang đăng nhập (từ node của họ ngược lên gốc).
 *   3. Còn lại theo tên.
 */
interface Node {
	id: number;
	name: string;
	parent_tenant_id?: number | null;
	is_default?: boolean;
}

/** id các node trên đường từ `homeId` ngược lên gốc (gồm chính `homeId`). */
export function homePath(items: Node[], homeId?: number | null): Set<number> {
	const byId = new Map(items.map((i) => [i.id, i]));
	const path = new Set<number>();
	let cur = homeId ? byId.get(homeId) : undefined;
	while (cur && !path.has(cur.id)) {
		path.add(cur.id);
		cur = cur.parent_tenant_id ? byId.get(cur.parent_tenant_id) : undefined;
	}
	return path;
}

export function tenantComparator(path: Set<number>) {
	return (a: Node, b: Node) =>
		Number(!!b.is_default) - Number(!!a.is_default) ||
		Number(path.has(b.id)) - Number(path.has(a.id)) ||
		a.name.localeCompare(b.name);
}
