import { Calculator } from '../calculator';
import { Decimal } from '@prisma/client/runtime/library';

describe('Calculator', () => {
    describe('toDecimal', () => {
        it('should convert number to Decimal', () => {
            const result = Calculator.toDecimal(100);
            expect(result).toBeInstanceOf(Decimal);
            expect(result.toNumber()).toBe(100);
        });

        it('should convert string to Decimal', () => {
            const result = Calculator.toDecimal('100.5');
            expect(result.toNumber()).toBe(100.5);
        });

        it('should handle null/undefined', () => {
            expect(Calculator.toDecimal(null).toNumber()).toBe(0);
            expect(Calculator.toDecimal(undefined).toNumber()).toBe(0);
        });

        it('should return same Decimal instance', () => {
            const dec = new Decimal(100);
            expect(Calculator.toDecimal(dec)).toBe(dec);
        });

        it('should handle invalid values', () => {
            const result = Calculator.toDecimal('invalid');
            expect(result.toNumber()).toBe(0);
        });
    });

    describe('toNumber', () => {
        it('should convert Decimal to number', () => {
            const dec = new Decimal(100.5);
            expect(Calculator.toNumber(dec)).toBe(100.5);
        });

        it('should handle null/undefined', () => {
            expect(Calculator.toNumber(null)).toBe(0);
            expect(Calculator.toNumber(undefined)).toBe(0);
        });
    });

    describe('operations', () => {
        it('should add values', () => {
            const result = Calculator.add(10, 20);
            expect(result.toNumber()).toBe(30);
        });

        it('should subtract values', () => {
            const result = Calculator.sub(30, 10);
            expect(result.toNumber()).toBe(20);
        });

        it('should multiply values', () => {
            const result = Calculator.mul(10, 20);
            expect(result.toNumber()).toBe(200);
        });

        it('should divide values', () => {
            const result = Calculator.div(20, 10);
            expect(result.toNumber()).toBe(2);
        });

        it('should handle division by zero', () => {
            const result = Calculator.div(10, 0);
            expect(result.toNumber()).toBe(0);
        });
    });
});
