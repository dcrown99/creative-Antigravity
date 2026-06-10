import { useState, useEffect, useCallback } from 'react';

// 定義
export type ReadingDirection = 'ltr' | 'rtl'; // ltr: 左開き(小説等), rtl: 右開き(漫画)
export type ViewMode = 'single' | 'spread';   // single: 1ページ, spread: 見開き

interface ReadingProgress {
  lastReadIndex: number;
  totalLength: number;
  updatedAt: number;
}

interface ViewerSettings {
  direction: ReadingDirection;
  viewMode: ViewMode;
  fitMode: 'contain' | 'cover'; // contain: 蜈ｨ菴楢｡ｨ遉ｺ, cover: 逕ｻ髱｢荳譚ｯ(蛻・ｊ謚懊″縺ゅｊ)
}

const STORAGE_KEY_PREFIX = 'my-kindle-progress-';
const SETTINGS_KEY = 'my-kindle-settings';

export function useReadingState(bookId: string) {
  // --- 險ｭ螳・(Settings) ---
  const [settings, setSettings] = useState<ViewerSettings>({
    direction: 'rtl', // 繝・ヵ繧ｩ繝ｫ繝医・貍ｫ逕ｻ繝｢繝ｼ繝会ｼ亥承髢九″・・
    viewMode: 'single', // 繝・ヵ繧ｩ繝ｫ繝医・蜊倥・繝ｼ繧ｸ・医Δ繝舌う繝ｫ閠・・縲￣C縺ｪ繧鋭pread謗ｨ螂ｨ縺縺御ｸ譌ｦsingle・・
    fitMode: 'contain', // 繝・ヵ繧ｩ繝ｫ繝医・縲悟・菴薙ｒ陦ｨ遉ｺ縲・
  });

  // --- 進捗 (Progress) ---
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // 初期ロード：設定と進捗を復元
  useEffect(() => {
    try {
      // 設定の読み込み
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) })); // 既存設定 + 新規項目のマージ
      } else {
        // 初回でPC/タブレットのような横長画面なら見開きをデフォルトにする判定を入れても良い
        if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) {
          setSettings(prev => ({ ...prev, viewMode: 'spread' }));
        }
      }

      // 進捗の読み込み
      const savedProgress = localStorage.getItem(`${STORAGE_KEY_PREFIX}${bookId}`);
      if (savedProgress) {
        const progress: ReadingProgress = JSON.parse(savedProgress);
        setCurrentIndex(progress.lastReadIndex);
      }
    } catch (e) {
      console.error('Failed to load reading state', e);
    } finally {
      setIsLoaded(true);
    }
  }, [bookId]);

  // 進捗の保存
  const saveProgress = useCallback((index: number, total: number) => {
    setCurrentIndex(index);
    try {
      const progress: ReadingProgress = {
        lastReadIndex: index,
        totalLength: total,
        updatedAt: Date.now(),
      };
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${bookId}`, JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save progress', e);
    }
  }, [bookId]);

  // 設定の保存
  const saveSettings = useCallback((newSettings: Partial<ViewerSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    currentIndex,
    settings,
    isLoaded,
    saveProgress,
    saveSettings,
  };
}
