
/**
 * Validates that a value is
 * - a number
 * - in a provided range (inclusive)
 */
export const validateNumberInRange = (min: number, max: number) => (value?: number) => {
    return typeof value === 'number' && !(isNaN(value) || min > value || value > max);
};
