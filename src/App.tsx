import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { MotionLazy } from "./components/animate/motion-lazy";
import { RouteLoadingProgress } from "./components/loading";
import Toast from "./components/toast";
import { GLOBAL_CONFIG } from "./global-config";
import { AntdAdapter } from "./theme/adapter/antd.adapter";
import { ThemeProvider } from "./theme/theme-provider";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
	},
});

function App({ children }: { children: React.ReactNode }) {
	return (
		<HelmetProvider>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider adapters={[AntdAdapter]}>
					<Helmet>
						<title>{GLOBAL_CONFIG.appName}</title>
					</Helmet>
					<Toast />
					<RouteLoadingProgress />
					<MotionLazy>{children}</MotionLazy>
				</ThemeProvider>
			</QueryClientProvider>
		</HelmetProvider>
	);
}

export default App;
