import { z } from 'zod';

/**
 * Date schema: strictly YYYY-MM-DD format only
 * Prevents issues with mixed date formats in database queries
 */
export const dateSchema = z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'YYYY-MM-DD形式で入力してください'
);

/**
 * Transaction validation schema
 */
export const TransactionSchema = z.object({
    date: dateSchema,
    amount: z.number().positive('金額は正の数で入力してください'),
    type: z.enum(['income', 'expense'], {
        errorMap: () => ({ message: '種別を選択してください' }),
    }),
    category: z.string().min(1, 'カテゴリを選択してください'),
    description: z.string().optional(),
    assetId: z.string().optional(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

/**
 * Dividend validation schema
 */
export const DividendSchema = z.object({
    assetId: z.string().min(1, '資産を選択してください'),
    date: dateSchema,
    amount: z.number().positive('金額は正の数で入力してください'),
    currency: z.enum(['JPY', 'USD'], {
        errorMap: () => ({ message: '通貨を選択してください' }),
    }),
});

export type DividendInput = z.infer<typeof DividendSchema>;

/**
 * Helper to parse FormData into a transaction object for validation
 */
export function parseTransactionFormData(formData: FormData): TransactionInput {
    return {
        date: formData.get('date') as string,
        amount: Number(formData.get('amount')),
        type: formData.get('type') as 'income' | 'expense',
        category: formData.get('category') as string,
        description: (formData.get('description') as string) || undefined,
        assetId: (formData.get('assetId') as string) || undefined,
    };
}

/**
 * Helper to parse FormData into a dividend object for validation
 */
export function parseDividendFormData(formData: FormData): DividendInput {
    return {
        assetId: formData.get('assetId') as string,
        date: formData.get('date') as string,
        amount: Number(formData.get('amount')),
        currency: formData.get('currency') as 'JPY' | 'USD',
    };
}
