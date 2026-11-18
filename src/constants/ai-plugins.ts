import { PLUGIN_PERMISSION } from "./permission";

/**
 * Plugin AI đang mở trên CMC Web — chính là các plugin có quyền xem riêng (`PLUGIN_PERMISSION`).
 * Plugin khác của trạm bị ẩn khỏi menu, bảng plugin, chọn plugin cho camera và bộ lọc sự kiện.
 */
export const ENABLED_AI_PLUGINS: readonly string[] = Object.keys(PLUGIN_PERMISSION);

export const isAiPluginShown = (name: string) => ENABLED_AI_PLUGINS.includes(name);

/** Plugin trong danh mục trạm gửi: theo cờ `shown` của trạm, trạm cũ không gửi thì theo danh sách trên. */
export const isStationPluginShown = (p: { name: string; shown?: boolean }) => p.shown ?? isAiPluginShown(p.name);
