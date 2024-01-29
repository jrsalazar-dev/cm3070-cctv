export function formatDate(unixTimestamp: number): string {
	const date = new Date(unixTimestamp * 1000); // Convert to milliseconds
	const day = date.getDate().toString().padStart(2, "0");
	const month = (date.getMonth() + 1).toString().padStart(2, "0"); // +1 because months are 0-indexed
	const year = date.getFullYear().toString();

	return `${day}-${month}-${year}`;
}
