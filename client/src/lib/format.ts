/**
 * Formats a cent value into a currency string (AUD).
 * 
 * @param cents - The amount in cents
 * @param absolute - Whether to use the absolute value
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number, absolute = false): string {
    const value = absolute ? Math.abs(cents) : cents;
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(value / 100);
}
