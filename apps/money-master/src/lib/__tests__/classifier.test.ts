import { classifyTransaction, classifyAsset, CategoryRule } from '../classifier';

describe('classifier', () => {
  describe('classifyTransaction', () => {
    describe('with empty or null input', () => {
      it('should return "未分類" for empty string', () => {
        expect(classifyTransaction('')).toBe('未分類');
      });

      it('should return "未分類" for null input', () => {
        expect(classifyTransaction(null as unknown as string)).toBe('未分類');
      });

      it('should return "未分類" for undefined input', () => {
        expect(classifyTransaction(undefined as unknown as string)).toBe('未分類');
      });
    });

    describe('default rules - salary', () => {
      it('should classify "給与" as 給与', () => {
        expect(classifyTransaction('月給与振込')).toBe('給与');
      });

      it('should classify "賞与" as 給与', () => {
        expect(classifyTransaction('夏季賞与')).toBe('給与');
      });

      it('should classify company transfer as 給与', () => {
        expect(classifyTransaction('振込 カブシキガイシャABC')).toBe('給与');
      });
    });

    describe('default rules - dividends', () => {
      it('should classify "配当" as 配当・分配金', () => {
        expect(classifyTransaction('株式配当金')).toBe('配当・分配金');
      });

      it('should classify "分配金" as 配当・分配金', () => {
        expect(classifyTransaction('投信分配金')).toBe('配当・分配金');
      });

      it('should classify "利息" as 配当・分配金', () => {
        expect(classifyTransaction('普通預金利息')).toBe('配当・分配金');
      });
    });

    describe('default rules - utilities', () => {
      it('should classify "電気" as 水道光熱費', () => {
        expect(classifyTransaction('電気代支払い')).toBe('水道光熱費');
      });

      it('should classify "ガス" as 水道光熱費', () => {
        expect(classifyTransaction('東京ガス')).toBe('水道光熱費');
      });

      it('should classify "水道" as 水道光熱費', () => {
        expect(classifyTransaction('水道料金')).toBe('水道光熱費');
      });

      it('should classify "東京電力" as 水道光熱費', () => {
        expect(classifyTransaction('東京電力')).toBe('水道光熱費');
      });
    });

    describe('default rules - communication', () => {
      it('should classify "docomo" as 通信費', () => {
        expect(classifyTransaction('NTT docomo')).toBe('通信費');
      });

      it('should classify "softbank" as 通信費', () => {
        expect(classifyTransaction('Softbank モバイル')).toBe('通信費');
      });

      it('should classify "ahamo" as 通信費', () => {
        expect(classifyTransaction('ahamo料金')).toBe('通信費');
      });
    });

    describe('default rules - food', () => {
      it('should classify "セブン" as 食費', () => {
        expect(classifyTransaction('セブンイレブン')).toBe('食費');
      });

      it('should classify "イオン" as 食費', () => {
        expect(classifyTransaction('イオンモール')).toBe('食費');
      });

      it('should classify "ローソン" as 食費', () => {
        expect(classifyTransaction('ローソン店舗')).toBe('食費');
      });
    });

    describe('default rules - daily goods', () => {
      it('should classify "amazon" as 日用品', () => {
        expect(classifyTransaction('Amazon.co.jp')).toBe('日用品');
      });

      it('should classify "楽天" as 日用品', () => {
        expect(classifyTransaction('楽天市場')).toBe('日用品');
      });

      it('should classify "メルカリ" as 日用品', () => {
        expect(classifyTransaction('メルカリ購入')).toBe('日用品');
      });
    });

    describe('default rules - transportation', () => {
      it('should classify "JR" as 交通費', () => {
        expect(classifyTransaction('JR東日本')).toBe('交通費');
      });

      it('should classify "suica" as 交通費', () => {
        expect(classifyTransaction('Suicaチャージ')).toBe('交通費');
      });

      it('should classify "タクシー" as 交通費', () => {
        expect(classifyTransaction('タクシー代')).toBe('交通費');
      });
    });

    describe('default rules - housing', () => {
      it('should classify "家賃" as 住居費', () => {
        expect(classifyTransaction('家賃振込')).toBe('住居費');
      });

      it('should classify "管理費" as 住居費', () => {
        expect(classifyTransaction('マンション管理費')).toBe('住居費');
      });
    });

    describe('default rules - investment', () => {
      it('should classify "積立" as 投資信託', () => {
        expect(classifyTransaction('毎月積立')).toBe('投資信託');
      });

      it('should classify "nisa" as 投資信託', () => {
        expect(classifyTransaction('つみたてNISA')).toBe('投資信託');
      });

      it('should classify "sbi" as 投資信託', () => {
        expect(classifyTransaction('SBI証券')).toBe('投資信託');
      });
    });

    describe('unmatched transactions', () => {
      it('should return "その他" for unmatched transactions', () => {
        expect(classifyTransaction('ランダムな取引')).toBe('その他');
      });

      it('should return "その他" for completely unknown description', () => {
        expect(classifyTransaction('XYZ123')).toBe('その他');
      });
    });

    describe('with custom DB rules', () => {
      it('should match custom DB rule before default rules', () => {
        const customRules: CategoryRule[] = [
          { id: '1', pattern: 'カスタム', category: 'カスタムカテゴリ' }
        ];
        expect(classifyTransaction('カスタム取引', customRules)).toBe('カスタムカテゴリ');
      });

      it('should be case-insensitive for custom rules', () => {
        const customRules: CategoryRule[] = [
          { id: '1', pattern: 'TEST', category: 'テストカテゴリ' }
        ];
        expect(classifyTransaction('test transaction', customRules)).toBe('テストカテゴリ');
      });

      it('should fall back to default rules if no custom rule matches', () => {
        const customRules: CategoryRule[] = [
          { id: '1', pattern: 'なし', category: '該当なし' }
        ];
        expect(classifyTransaction('給与振込', customRules)).toBe('給与');
      });

      it('should handle empty custom rules array', () => {
        expect(classifyTransaction('給与振込', [])).toBe('給与');
      });

      it('should handle RegExp pattern in custom rules (skip)', () => {
        // RegExp patterns in DB rules are skipped (pattern string becomes empty)
        const customRules: CategoryRule[] = [
          { id: '1', pattern: /test/i, category: 'RegExpカテゴリ' }
        ];
        expect(classifyTransaction('test', customRules)).toBe('その他');
      });
    });
  });

  describe('classifyAsset', () => {
    it('should delegate to classifyTransaction', () => {
      expect(classifyAsset('給与振込')).toBe('給与');
    });

    it('should return "その他" for unclassified asset', () => {
      expect(classifyAsset('不明な資産')).toBe('その他');
    });

    it('should return "未分類" for empty string', () => {
      expect(classifyAsset('')).toBe('未分類');
    });
  });
});
