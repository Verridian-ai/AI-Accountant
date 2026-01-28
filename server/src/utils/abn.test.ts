import { describe, it, expect } from 'vitest';
import {
    validateABN,
    formatABN,
    normalizeABN,
    validateEntityType,
    validateBasFrequency,
    validateAnzsicCode,
    validateTaxAgentNumber
} from './abn.js';

describe('ABN Validation', () => {
    describe('validateABN', () => {
        // Valid ABNs for testing (these are publicly known valid ABNs)
        const validABNs = [
            '51 824 753 556', // Australian Taxation Office
            '33 102 417 032', // Example company
            '53 004 085 616', // Example company
            '51824753556', // Without spaces
            '  51 824 753 556  ', // With extra whitespace
        ];

        const invalidABNs = [
            '12 345 678 901', // Invalid checksum
            '00 000 000 000', // All zeros
            '51 824 753 555', // Off by one digit
            '1234567890', // Only 10 digits
            '123456789012', // 12 digits
            'AB 824 753 556', // Contains letters
            '', // Empty string
        ];

        it('should validate correct ABNs', () => {
            for (const abn of validABNs) {
                const result = validateABN(abn);
                expect(result.isValid, `Expected "${abn}" to be valid`).toBe(true);
                expect(result.error).toBeUndefined();
                expect(result.formattedABN).toBeDefined();
            }
        });

        it('should reject invalid ABNs', () => {
            for (const abn of invalidABNs) {
                const result = validateABN(abn);
                expect(result.isValid, `Expected "${abn}" to be invalid`).toBe(false);
                expect(result.error).toBeDefined();
            }
        });

        it('should return formatted ABN for valid inputs', () => {
            const result = validateABN('51824753556');
            expect(result.formattedABN).toBe('51 824 753 556');
        });

        it('should provide helpful error messages', () => {
            expect(validateABN('1234567890').error).toContain('11 digits');
            expect(validateABN('12 345 678 901').error).toContain('checksum');
        });
    });

    describe('formatABN', () => {
        it('should format ABN with standard spacing', () => {
            expect(formatABN('51824753556')).toBe('51 824 753 556');
        });

        it('should handle already spaced ABN', () => {
            expect(formatABN('51 824 753 556')).toBe('51 824 753 556');
        });

        it('should return original if not 11 digits', () => {
            expect(formatABN('12345')).toBe('12345');
        });
    });

    describe('normalizeABN', () => {
        it('should remove spaces and return 11 digits', () => {
            expect(normalizeABN('51 824 753 556')).toBe('51824753556');
        });

        it('should return null for invalid length', () => {
            expect(normalizeABN('12345')).toBeNull();
        });
    });
});

describe('Entity Type Validation', () => {
    it('should validate correct entity types', () => {
        const validTypes = ['individual', 'sole_trader', 'partnership', 'company', 'trust', 'super_fund'];
        for (const type of validTypes) {
            expect(validateEntityType(type), `Expected "${type}" to be valid`).toBe(true);
        }
    });

    it('should reject invalid entity types', () => {
        expect(validateEntityType('corporation')).toBe(false);
        expect(validateEntityType('')).toBe(false);
        expect(validateEntityType('COMPANY')).toBe(false); // Case sensitive
    });
});

describe('BAS Frequency Validation', () => {
    it('should validate correct BAS frequencies', () => {
        expect(validateBasFrequency('monthly')).toBe(true);
        expect(validateBasFrequency('quarterly')).toBe(true);
        expect(validateBasFrequency('annually')).toBe(true);
    });

    it('should reject invalid BAS frequencies', () => {
        expect(validateBasFrequency('weekly')).toBe(false);
        expect(validateBasFrequency('')).toBe(false);
    });
});

describe('ANZSIC Code Validation', () => {
    it('should validate 4-digit codes', () => {
        expect(validateAnzsicCode('6932')).toBe(true);
        expect(validateAnzsicCode('3011')).toBe(true);
    });

    it('should reject invalid codes', () => {
        expect(validateAnzsicCode('693')).toBe(false); // Too short
        expect(validateAnzsicCode('69320')).toBe(false); // Too long
        expect(validateAnzsicCode('693A')).toBe(false); // Contains letter
    });
});

describe('Tax Agent Number Validation', () => {
    it('should validate 7-8 digit numbers', () => {
        expect(validateTaxAgentNumber('1234567')).toBe(true);
        expect(validateTaxAgentNumber('12345678')).toBe(true);
        expect(validateTaxAgentNumber('1234 5678')).toBe(true); // With space
    });

    it('should reject invalid numbers', () => {
        expect(validateTaxAgentNumber('123456')).toBe(false); // Too short
        expect(validateTaxAgentNumber('123456789')).toBe(false); // Too long
    });
});
