import { detectFormat, parseCSV } from '../csv-parsers';

// Mock the actual parsers
jest.mock('../csv-parsers/rakuten', () => ({
    parseRakutenCSV: jest.fn(() => [{ type: 'income', amount: 1000 }])
}));

jest.mock('../csv-parsers/rakuten-bank', () => ({
    parseRakutenBankCSV: jest.fn(() => [{ type: 'expense', amount: 500 }])
}));

jest.mock('../csv-parsers/sbi', () => ({
    parseSBICSV: jest.fn(() => [{ type: 'income', amount: 2000 }])
}));

describe('CSV Parser Index', () => {
    describe('detectFormat', () => {
        it('should detect Rakuten format', () => {
            const csvData = '受渡日,銘柄,受渡金額/決済損益\n2024-01-01,テスト株,1000';
            expect(detectFormat(csvData)).toBe('rakuten');
        });

        it('should detect Rakuten Bank format', () => {
            const csvData = '取引日,入出金(円),入出金内容,残高\n2024-01-01,50000,給与振込,100000';
            expect(detectFormat(csvData)).toBe('rakuten-bank');
        });

        it('should detect SBI format', () => {
            const csvData = '約定日,銘柄コード,銘柄名,受渡金額\n2024-01-01,1234,テスト株,10000';
            expect(detectFormat(csvData)).toBe('sbi');
        });

        it('should return unknown for unrecognized format', () => {
            const csvData = 'Date,Description,Amount\n2024-01-01,Test,1000';
            expect(detectFormat(csvData)).toBe('unknown');
        });

        it('should handle empty CSV data', () => {
            expect(detectFormat('')).toBe('unknown');
        });
    });

    describe('parseCSV', () => {
        it('should parse Rakuten format using rakuten parser', () => {
            const csvData = 'test data';
            const result = parseCSV(csvData, 'rakuten');
            expect(result).toEqual([{ type: 'income', amount: 1000 }]);
        });

        it('should parse Rakuten Bank format using rakuten-bank parser', () => {
            const csvData = 'test data';
            const result = parseCSV(csvData, 'rakuten-bank');
            expect(result).toEqual([{ type: 'expense', amount: 500 }]);
        });

        it('should parse SBI format using sbi parser', () => {
            const csvData = 'test data';
            const result = parseCSV(csvData, 'sbi');
            expect(result).toEqual([{ type: 'income', amount: 2000 }]);
        });

        it('should throw error for unknown format', () => {
            const csvData = 'test data';
            expect(() => parseCSV(csvData, 'unknown')).toThrow('Unsupported CSV format');
        });
    });
});
