/** Profile name, else recipient name from a delivery address. */
export function pickCustomerDisplayName(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const row = input as Record<string, unknown>;
  if (typeof row.name === "string" && row.name.trim()) {
    return row.name.trim();
  }
  const addresses = row.addresses;
  if (!Array.isArray(addresses)) return "";
  for (const addr of addresses) {
    if (!addr || typeof addr !== "object") continue;
    const name = (addr as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return "";
}
