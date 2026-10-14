/**
 * Format timestamp to relative time (e.g., "5 phút trước", "2 giờ trước")
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted relative time string in Vietnamese
 */
export const formatTimeAgo = (timestamp: number): string => {
	const now = Date.now();
	const time = timestamp * 1000; // Convert to milliseconds
	const diffInSeconds = Math.floor((now - time) / 1000);

	if (diffInSeconds < 60) {
		return `${diffInSeconds} giây trước`;
	}

	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) {
		return `${diffInMinutes} phút trước`;
	}

	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) {
		return `${diffInHours} giờ trước`;
	}

	const diffInDays = Math.floor(diffInHours / 24);
	return `${diffInDays} ngày trước`;
};
