export function formatDepositRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Live check while typing a give-back amount. Empty input is not an error yet. */
export function depositReturnAmountError(
  amountRaw: string,
  held: number,
): string | null {
  const trimmed = amountRaw.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Enter an amount greater than 0.";
  }
  if (held <= 0) {
    return "This customer has no deposit to return.";
  }
  if (amount > held) {
    return `Cannot return more than ${formatDepositRupees(held)}. That is all this customer currently holds.`;
  }
  return null;
}
