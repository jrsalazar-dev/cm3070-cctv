export function convertUnixTimestampToDateTime(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000) // Convert to milliseconds
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0') // +1 because months are 0-indexed
  const year = date.getFullYear().toString().slice(2) // Get last two digits of year
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  return `${day}-${month}-${year} ${hours}:${minutes}`
}
