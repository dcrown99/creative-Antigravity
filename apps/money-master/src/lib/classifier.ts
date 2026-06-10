export type CategoryRule = {
  id?: string;
  pattern: string | RegExp;
  category: string;
};

const DEFAULT_RULES: CategoryRule[] = [
  { pattern: /(給与|賞与|振込.*カブシキガイシャ)/i, category: '給与' },
  { pattern: /(配当|分配金|利息)/i, category: '配当・分配金' },
  { pattern: /(電気|ガス|水道|東京電力|関西電力)/i, category: '水道光熱費' },
  { pattern: /(docomo|au|softbank|ahamo|povo|linemo|rakuten mobile)/i, category: '通信費' },
  { pattern: /(セブン|ローソン|ファミマ|スーパー|イオン|イトーヨーカドー)/i, category: '食費' },
  { pattern: /(amazon|楽天|メルカリ)/i, category: '日用品' },
  { pattern: /(jr|suica|pasmo|etc|タクシー)/i, category: '交通費' },
  { pattern: /(家賃|管理費)/i, category: '住居費' },
  { pattern: /(積立|投信|nisa|sbi|楽天証券)/i, category: '投資信託' },
];

export function classifyTransaction(description: string, dbRules: CategoryRule[] = []): string {
  if (!description) return '未分類';
  const target = description.toLowerCase();

  // 1. DB上のカスタムルールを優先評価
  for (const rule of dbRules) {
    try {
      // DBルールは通常文字列だが、RegExpオブジェクトの場合も考慮
      const patternStr = typeof rule.pattern === 'string' ? rule.pattern.toLowerCase() : '';

      if (patternStr && target.includes(patternStr)) {
        return rule.category;
      }
    } catch {
      continue;
    }
  }

  // 2. デフォルトルール（既存ロジック）を適用
  for (const rule of DEFAULT_RULES) {
    if (rule.pattern instanceof RegExp) {
      if (rule.pattern.test(description)) {
        return rule.category;
      }
    }
  }

  return 'その他';
}

// 互換性のために残す（必要に応じてclassifyTransactionを呼ぶように変更しても良い）
export function classifyAsset(description: string): string {
  return classifyTransaction(description);
}
