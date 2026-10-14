import axios, {
	type AxiosError,
	type AxiosRequestConfig,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";
import type { Result } from "#/api";
import { ResultCode } from "#/enum";
import { GLOBAL_CONFIG } from "@/global-config";
import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";

/** Lỗi nghiệp vụ từ API — giữ `code` + `data` (vd `data.errors` của 422) để form tự xử lý. */
export class ApiError extends Error {
	code: string;
	data?: unknown;
	constructor(code: string, message: string, data?: unknown) {
		super(message);
		this.code = code;
		this.data = data;
	}
}

declare module "axios" {
	interface AxiosRequestConfig {
		/** Không tự hiện toast khi lỗi (trang tự xử lý). */
		silent?: boolean;
		/** Trả nguyên response (tải file). */
		raw?: boolean;
		_retried?: boolean;
	}
}

const axiosInstance = axios.create({
	baseURL: GLOBAL_CONFIG.apiBaseUrl,
	timeout: 50000,
	headers: { "Content-Type": "application/json;charset=utf-8" },
});

axiosInstance.interceptors.request.use((config) => {
	const token = userStore.getState().userToken?.access_token;
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

// ── Làm mới access token (single-flight: nhiều request 401 cùng lúc chỉ refresh một lần) ──

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
	const refresh_token = userStore.getState().userToken?.refresh_token;
	if (!refresh_token) return null;
	try {
		const res = await axios.post<Result<{ access_token: string; refresh_token: string }>>(
			`${GLOBAL_CONFIG.apiBaseUrl}/login/refresh`,
			{ refresh_token },
		);
		if (res.data?.code !== ResultCode.SUCCESS) return null;
		userStore.getState().actions.setUserToken(res.data.data);
		return res.data.data.access_token;
	} catch {
		return null;
	}
}

function forceLogout(message?: string) {
	const hadSession = !!userStore.getState().userToken?.access_token;
	userStore.getState().actions.clearUserInfoAndToken();
	if (hadSession) {
		toast.error(message || t("sys.api.sessionExpired"), { position: "top-center" });
	}
	if (!window.location.pathname.startsWith("/auth")) {
		window.location.href = `${GLOBAL_CONFIG.publicPath.replace(/\/$/, "")}/auth/login`;
	}
}

async function handleFailure(
	code: string,
	message: string,
	data: unknown,
	config: InternalAxiosRequestConfig | undefined,
) {
	const isAuthCall = config?.url?.startsWith("/login");

	if (code === ResultCode.UNAUTHORIZED && config && !config._retried && !isAuthCall) {
		refreshing ??= refreshAccessToken().finally(() => {
			refreshing = null;
		});
		const token = await refreshing;
		if (token) {
			config._retried = true;
			config.headers.Authorization = `Bearer ${token}`;
			return axiosInstance.request(config);
		}
		forceLogout();
		throw new ApiError(code, message, data);
	}

	if (code === ResultCode.SESSION_EXPIRED) {
		forceLogout(message);
		throw new ApiError(code, message, data);
	}

	if (!config?.silent) {
		if (code === ResultCode.TOO_MANY) toast.warning(message, { position: "top-center" });
		else toast.error(message, { position: "top-center" });
	}
	throw new ApiError(code, message, data);
}

axiosInstance.interceptors.response.use(
	// Interceptor trả về `data` đã bóc vỏ (không phải AxiosResponse) — APIClient định kiểu lại.
	(res: AxiosResponse<Result>): any => {
		if (res.config.raw) return res;
		if (!res.data) throw new ApiError("-1", t("sys.api.apiRequestFailed"));
		const { data, message, code, metadata } = res.data;
		if (code === ResultCode.SUCCESS) {
			return metadata ? { data, metadata } : data;
		}
		return handleFailure(code, message || t("sys.api.apiRequestFailed"), data, res.config);
	},
	async (error: AxiosError<Result | Blob>) => {
		const { response, config } = error;
		let body = response?.data as Result | undefined;
		// Endpoint trả file (blob) mà lỗi → body là blob JSON.
		if (body instanceof Blob) {
			try {
				body = JSON.parse(await body.text());
			} catch {
				body = undefined;
			}
		}
		if (body?.code) {
			return handleFailure(body.code, body.message, body.data, config);
		}
		const message = response ? t("sys.api.errorMessage") : t("sys.api.networkException");
		if (!config?.silent) toast.error(message, { position: "top-center" });
		throw new ApiError(String(response?.status ?? "-1"), message);
	},
);

class APIClient {
	get<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "GET" });
	}
	post<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return this.request<T>({ ...config, method: "POST" });
	}
	request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
		return axiosInstance.request<any, any>({
			// FastAPI đọc mảng dạng ?a=1&a=2 (không có []).
			paramsSerializer: { indexes: null },
			...config,
		});
	}
}

export default new APIClient();
