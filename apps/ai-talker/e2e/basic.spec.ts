import { test, expect } from '@playwright/test';

test.describe('AI Talker Basic Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3004');
        // Wait for Canvas to load (implies 3D scene is ready)
        // Canvas loading can be heavy, giving it some time
        await page.waitForSelector('canvas', { timeout: 30000 });
    });

    test('should render immersive HUD components', async ({ page }) => {
        // Verify UI Elements (Updated for Japanese Localization)

        // Note: 'AI Talker' might still be in the document title or metadata, 
        // but let's check for visible HUD elements.

        // Verify Status Indicator (This likely displays raw status like "IDLE" or "LISTENING" in uppercase)
        // Adjust expectation based on implementation. Assuming status codes are still English internally
        // or mapped. If UI shows icons mostly, we check for accessibility text or known labels.

        // 起動シーケンス後の待機 (SYSTEM STARTUP... -> UI表示)
        await page.waitForTimeout(2000);

        // Verify Mic Button Call-to-action (Updated to Japanese)
        await expect(page.getByText('TAP TO TALK')).toBeVisible();

        // Check for Settings Button availability
        const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings-2') });
        await expect(settingsButton).toBeVisible();
    });

    test('should open settings dialog via header button', async ({ page }) => {
        // 起動待ち
        await page.waitForTimeout(2000);

        const settingsButton = page.locator('button').filter({ has: page.locator('svg.lucide-settings-2') });
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();

        // Verify Dialog opens with Japanese Title
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'システム設定' })).toBeVisible();

        // Verify content within dialog (Localized labels)
        await expect(page.getByText('3Dアバターモデル')).toBeVisible();
        await expect(page.getByText('音声モデル (Voicevox)')).toBeVisible();
        await expect(page.getByText('性格・モード設定')).toBeVisible();
    });
});
