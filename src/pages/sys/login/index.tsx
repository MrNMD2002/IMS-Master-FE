import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import BrandIcon from "@/assets/brand/icon.png";
import { Icon } from "@/components/icon";
import LocalePicker from "@/components/locale-picker";
import Logo from "@/components/logo";
import ThemeToggle from "@/components/theme-toggle";
import { GLOBAL_CONFIG } from "@/global-config";
import { useUserToken } from "@/store/userStore";
import LoginForm from "./login-form";

const FEATURES = [
	{ icon: "solar:map-point-wave-bold-duotone", key: "sys.login.feature1" },
	{ icon: "solar:siren-rounded-bold-duotone", key: "sys.login.feature2" },
	{ icon: "solar:route-bold-duotone", key: "sys.login.feature3" },
];

function LoginPage() {
	const { t } = useTranslation();
	const token = useUserToken();

	if (token.access_token) {
		return <Navigate to={GLOBAL_CONFIG.defaultRoute} replace />;
	}

	return (
		<div className="relative grid min-h-svh lg:grid-cols-2 bg-background">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex items-center gap-3">
					<Logo size={40} />
					<div className="leading-tight">
						<p className="text-lg font-bold">{GLOBAL_CONFIG.appName}</p>
						<p className="text-xs text-text-secondary">{t("sys.login.tagline")}</p>
					</div>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-sm">
						<LoginForm />
					</div>
				</div>
				<p className="text-center text-xs text-text-disabled">
					{GLOBAL_CONFIG.appName} v{GLOBAL_CONFIG.appVersion}
				</p>
			</div>

			{/* Màu nền theo bộ nhận diện Command Center (xanh navy → xanh dương → xanh ngọc). */}
			<div
				className="relative hidden overflow-hidden lg:flex flex-col justify-center gap-8 p-16 text-white"
				style={{ background: "linear-gradient(135deg, #0b2a5b 0%, #1559b5 55%, #0f9fb3 100%)" }}
			>
				<svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.12]">
					<defs>
						<pattern id="login-grid" width="44" height="44" patternUnits="userSpaceOnUse">
							<path d="M44 0H0V44" fill="none" stroke="white" strokeWidth="1" />
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#login-grid)" />
				</svg>
				<div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
				<div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-2xl" />

				<div className="relative">
					<div className="flex items-center gap-4">
						<span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-xl">
							<img src={BrandIcon} alt="" width={60} height={60} />
						</span>
						<div>
							<p className="text-3xl font-extrabold tracking-tight">{GLOBAL_CONFIG.appName}</p>
							<p className="text-white/75">{t("sys.login.tagline")}</p>
						</div>
					</div>
					<h2 className="mt-8 text-4xl font-bold leading-tight">{t("sys.login.heroTitle")}</h2>
					<p className="mt-3 max-w-md text-white/80">{t("sys.login.heroDesc")}</p>
				</div>
				<ul className="relative flex flex-col gap-4">
					{FEATURES.map((f) => (
						<li key={f.key} className="flex items-center gap-3">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
								<Icon icon={f.icon} size={22} />
							</span>
							<span className="text-white/90">{t(f.key)}</span>
						</li>
					))}
				</ul>
			</div>

			<div className="absolute right-2 top-2 flex flex-row items-center">
				<LocalePicker />
				<ThemeToggle />
			</div>
		</div>
	);
}
export default LoginPage;
