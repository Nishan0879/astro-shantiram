/** Keeps only the digits of a US phone number, at most 10 (a pasted leading +1 is dropped). */
export function tenDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Props that make a phone box take 10 digits only. */
export const phoneInputProps = {
  type: "tel",
  inputMode: "numeric",
  autoComplete: "tel-national",
  maxLength: 10,
  pattern: "[0-9]{10}",
  placeholder: "8175551234",
} as const;
