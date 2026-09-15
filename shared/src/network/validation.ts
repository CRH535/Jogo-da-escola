export const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const finite = (value: unknown, limit: number): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
export const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
export const validId = (value: unknown): value is string => typeof value === 'string' && value.length === 36;
export function validName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && [...value].length <= 20 && !/[\p{C}]/u.test(value);
}
