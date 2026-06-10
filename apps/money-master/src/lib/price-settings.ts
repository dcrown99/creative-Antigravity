import fs from 'fs/promises';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'price-settings.json');

/**
 * Price update settings configuration
 */
export interface PriceUpdateSettings {
    /** Whether auto price update is enabled */
    enabled: boolean;
    /** Hour of day to run price update (0-23) */
    scheduleHour: number;
    /** Last successful update timestamp (ISO8601) */
    lastUpdatedAt?: string;
    /** Last error message if update failed */
    lastError?: string;
}

/**
 * Default price update settings
 */
export const DEFAULT_PRICE_SETTINGS: PriceUpdateSettings = {
    enabled: true,
    scheduleHour: 19, // 19:00 JST - after market close
};

/**
 * Load price update settings from file
 * @returns Current settings (or defaults if file doesn't exist)
 */
export async function loadPriceSettings(): Promise<PriceUpdateSettings> {
    try {
        const content = await fs.readFile(SETTINGS_PATH, 'utf-8');
        const settings = JSON.parse(content) as Partial<PriceUpdateSettings>;

        // Merge with defaults to ensure all fields exist
        return {
            ...DEFAULT_PRICE_SETTINGS,
            ...settings,
        };
    } catch (error) {
        // File doesn't exist or is invalid, return defaults
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log('[PriceSettings] No settings file found, using defaults');
        } else {
            console.error('[PriceSettings] Failed to load settings:', error);
        }
        return { ...DEFAULT_PRICE_SETTINGS };
    }
}

/**
 * Save price update settings to file
 * @param settings Settings to save
 */
export async function savePriceSettings(settings: PriceUpdateSettings): Promise<void> {
    // Validate settings
    if (settings.scheduleHour < 0 || settings.scheduleHour > 23) {
        throw new Error('scheduleHour must be between 0 and 23');
    }

    try {
        // Ensure data directory exists
        await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });

        await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('[PriceSettings] Settings saved:', settings);
    } catch (error) {
        console.error('[PriceSettings] Failed to save settings:', error);
        throw error;
    }
}

/**
 * Update last updated timestamp
 */
export async function updateLastPriceUpdate(error?: string): Promise<void> {
    const settings = await loadPriceSettings();
    settings.lastUpdatedAt = new Date().toISOString();
    settings.lastError = error;
    await savePriceSettings(settings);
}
