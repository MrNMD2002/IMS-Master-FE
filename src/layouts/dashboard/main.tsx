import { Suspense, useMemo } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { AuthGuard } from "@/components/auth/auth-guard";
import { LineLoading } from "@/components/loading";
import Page403 from "@/pages/sys/error/Page403";
import { useSettings } from "@/store/settingStore";
import { cn } from "@/utils";
import { flattenTrees } from "@/utils/tree";
import { frontendNavData } from "./nav/nav-data/nav-data-frontend";

/** Trang bản đồ dùng toàn bộ khung, không có lề. */
const FULL_BLEED = ["/monitoring"];

const Main = () => {
	const { themeStretch } = useSettings();
	const { pathname } = useLocation();

	const currentNavAuth = useMemo(() => {
		const allItems = frontendNavData.flatMap((group) => flattenTrees(group.items));
		const match = allItems
			.filter((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
			.sort((a, b) => b.path.length - a.path.length)[0];
		return match?.auth || [];
	}, [pathname]);

	const fullBleed = FULL_BLEED.includes(pathname);

	return (
		<AuthGuard checkAny={currentNavAuth} fallback={<Page403 />}>
			<main
				data-slot="slash-layout-main"
				className={cn(
					"flex-auto w-full flex flex-col",
					"transition-[max-width] duration-300 ease-in-out",
					fullBleed ? "p-0" : "px-4 sm:px-6 py-4 sm:py-6 md:px-8 mx-auto",
					{
						"max-w-full": themeStretch || fullBleed,
						"xl:max-w-screen-xl": !themeStretch && !fullBleed,
					},
				)}
			>
				<Suspense fallback={<LineLoading />}>
					<Outlet />
					<ScrollRestoration />
				</Suspense>
			</main>
		</AuthGuard>
	);
};

export default Main;
