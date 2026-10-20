/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Default route path for the application */
	readonly VITE_APP_DEFAULT_ROUTE: string;
	/** Public path for static assets */
	readonly VITE_APP_PUBLIC_PATH: string;
	/** Base URL for API endpoints */
	readonly VITE_APP_API_BASE_URL: string;
	/** Routing mode: frontend routing or backend routing */
	readonly VITE_APP_ROUTER_MODE: "frontend" | "backend";
	/** Geocoding service provider: "mapbox", "openstreetmap" or "openmap" */
	readonly VITE_APP_GEOCODING_SERVICE?: "mapbox" | "openstreetmap" | "openmap";
	/** Mapbox access token for geocoding API */
	readonly VITE_APP_MAPBOX_ACCESS_TOKEN?: string;
	/** Routing service provider: "osrm" or "openmap" */
	readonly VITE_APP_ROUTING_SERVICE?: "osrm" | "openmap";
	/** NDA Map API key */
	readonly VITE_NDAMAP_API_KEY?: string;
	/** NDA Map tiles base URL */
	readonly VITE_NDAMAP_TILES_URL?: string;
	/** Nền bản đồ CMC tự host, vd http://localhost:8090/styles/cmc/{z}/{x}/{y}.png (đã vẽ sẵn Hoàng Sa, Trường Sa) */
	readonly VITE_MAP_TILE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
