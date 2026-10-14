import "@ant-design/v5-patch-for-react-19";
import "./global.css";
import "./theme/theme.css";
import "leaflet/dist/leaflet.css";
import "./locales/i18n";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import App from "./App";
import { registerLocalIcons } from "./components/icon";
import { GLOBAL_CONFIG } from "./global-config";
import ErrorBoundary from "./routes/components/error-boundary";
import { routesSection } from "./routes/sections";

await registerLocalIcons();

const router = createBrowserRouter(
	[
		{
			Component: () => (
				<App>
					<Outlet />
				</App>
			),
			errorElement: <ErrorBoundary />,
			children: routesSection,
		},
	],
	{ basename: GLOBAL_CONFIG.publicPath },
);

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(<RouterProvider router={router} />);
