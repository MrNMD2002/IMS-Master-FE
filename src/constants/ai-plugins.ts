/**
 * Plugin AI đang mở trên CMC Web. Tạm thời chỉ 3 chức năng: đỗ xe vi phạm, cảnh báo cháy khói,
 * xâm nhập vùng cấm — plugin khác của trạm bị ẩn khỏi menu, bảng plugin, chọn plugin cho camera
 * và bộ lọc sự kiện. Muốn mở lại plugin nào thì thêm tên kỹ thuật của nó vào đây.
 */
export const ENABLED_AI_PLUGINS: readonly string[] = [
	"parking_violation_detection",
	"smoke_fire_detection",
	"zone_intrusion",
];

export const isAiPluginShown = (name: string) => ENABLED_AI_PLUGINS.includes(name);
