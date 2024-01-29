export function formatTime(unixTimestamp: number): string {
	const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");

	return `${hours}:${minutes}`;
}
