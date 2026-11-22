/** One opt-in local UI-only screenshot; restore menu open state even on failure. */
export async function captureMobileNavigation(page, path) {
  const panel = page.locator('[data-slot="sidebar"][data-mobile="true"]');
  const originallyOpen = await panel.isVisible();
  let opened = false;
  try {
    if (!originallyOpen) {
      await page.locator('[data-slot="sidebar-trigger"]').first().click({ timeout: 5000 });
      opened = true;
    }
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path, animations: 'disabled', timeout: 12000 });
  } finally {
    if (opened) {
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }
}
