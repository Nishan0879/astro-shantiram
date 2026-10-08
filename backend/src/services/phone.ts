import { z } from "zod";

/**
 * A 10-digit US phone number. Spaces, dashes, brackets and a leading +1 are
 * allowed when typed; it is stored as 817-555-1234.
 */
export const usPhone = z
  .string()
  .trim()
  .transform((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  })
  .refine((d) => /^\d{10}$/.test(d), "Enter a 10-digit phone number")
  .transform((d) => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`);
