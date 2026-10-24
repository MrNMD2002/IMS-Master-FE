import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { SignInReq } from "@/api/services/authService";
import { Icon } from "@/components/icon";
import { GLOBAL_CONFIG } from "@/global-config";
import { signIn } from "@/store/userStore";
import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";

function LoginForm() {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();

	const form = useForm<SignInReq>({ defaultValues: { username: "", password: "" } });

	const handleFinish = async (values: SignInReq) => {
		setLoading(true);
		setError("");
		try {
			const user = await signIn(values);
			navigate(GLOBAL_CONFIG.defaultRoute, { replace: true });
			toast.success(t("sys.login.welcome", { name: user.full_name || user.username }));
		} catch (err) {
			setError(err instanceof Error ? err.message : t("sys.api.errorMessage"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleFinish)} className="flex flex-col gap-5">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-bold">{t("sys.login.signInFormTitle")}</h1>
					<p className="text-sm text-text-secondary">{t("sys.login.signInFormDescription")}</p>
				</div>

				{error && (
					<div className="flex items-start gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
						<Icon icon="solar:danger-circle-bold" size={18} className="mt-0.5 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				<FormField
					control={form.control}
					name="username"
					rules={{ required: t("sys.login.accountPlaceholder") }}
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("sys.login.userName")}</FormLabel>
							<FormControl>
								<Input autoFocus autoComplete="username" placeholder={t("sys.login.accountPlaceholder")} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="password"
					rules={{ required: t("sys.login.passwordPlaceholder") }}
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("sys.login.password")}</FormLabel>
							<FormControl>
								<div className="relative">
									<Input
										type={showPassword ? "text" : "password"}
										autoComplete="current-password"
										placeholder={t("sys.login.passwordPlaceholder")}
										className="pr-10"
										{...field}
									/>
									<button
										type="button"
										tabIndex={-1}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
										onClick={() => setShowPassword((v) => !v)}
										title={showPassword ? t("sys.login.hidePassword") : t("sys.login.showPassword")}
									>
										<Icon icon={showPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} size={18} />
									</button>
								</div>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button type="submit" size="lg" className="w-full" disabled={loading}>
					{loading && <Loader2 className="animate-spin mr-2" />}
					{t("sys.login.loginButton")}
				</Button>
			</form>
		</Form>
	);
}

export default LoginForm;
