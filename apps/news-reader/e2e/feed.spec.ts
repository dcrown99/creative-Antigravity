import { test, expect } from '@playwright/test';

test.describe('News Reader Feed Management', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app (running on port 3005)
        await page.goto('http://localhost:3005');
        // Wait for feed sidebar to load (it might take a moment to read from localstorage or render)
        await page.waitForSelector('aside');
    });

    test('should display default feeds in sidebar', async ({ page }) => {
        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible();
        // Use getByRole for better accessibility check, or ensure text is visible
        await expect(page.getByText('TechCrunch')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('The Verge')).toBeVisible();
    });

    test('should allow adding a new feed via URL', async ({ page }) => {
        // Mock the API response for feed discovery/parsing
        await page.route('**/api/feeds**', async route => {
            const json = {
                title: 'Mock Feed',
                items: [
                    {
                        title: 'Mock Article 1',
                        link: 'https://example.com/1',
                        pubDate: new Date().toISOString(),
                        content: 'Content 1'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        // Find the input and button. The button is inside the form.
        const sidebar = page.locator('aside');
        await sidebar.getByPlaceholder('Add URL...').fill('https://example.com/feed');

        // The button has a type="submit" and is inside the form.
        // Since it has no text, we can target it by type or class, or simpler: locate the form and press enter?
        // Let's try pressing Enter which triggers submit
        await sidebar.getByPlaceholder('Add URL...').press('Enter');

        // Wait for the new feed to appear
        await expect(sidebar.getByText('https://example.com/feed')).toBeVisible();
    });
});
