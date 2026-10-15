import packageJson from "../package.json";

export type GlobalConfig = {
	appName: string;
	appVersion: string;
	/** Trang mở đầu sau khi đăng nhập */
	defaultRoute: string;
	publicPath: string;
	/** Base URL của CMC API, vd `/cmc/api` */
	apiBaseUrl: string;
};

/** Đọc cấu hình ở đây, không gọi `import.meta.env` rải rác trong code. */
export const GLOBAL_CONFIG: GlobalConfig = {
	appName: "Command Center",
	appVersion: packageJson.version,
	defaultRoute: import.meta.env.VITE_APP_DEFAULT_ROUTE || "/dashboard",
	publicPath: import.meta.env.VITE_APP_PUBLIC_PATH || "/",
	apiBaseUrl: import.meta.env.VITE_APP_API_BASE_URL || "/cmc/api",
};
