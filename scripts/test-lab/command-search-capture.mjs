/** Inspect the shared page-search dialog without selecting a command or issuing writes. */
export async function captureCommandSearch(page, path) {
  const dialog = page
    .locator('[data-slot="dialog-content"]')
    .filter({ has: page.locator('[data-slot="command-input"]') });
  const originallyOpen = await dialog.isVisible();
  let opened = false;
  try {
    if (!originallyOpen) {
      await page.getByRole('button', { name: 'Search...', exact: true }).click({ timeout: 5000 });
      opened = true;
    }
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const input = element.querySelector('[data-slot="command-input"]');
      const group = element.querySelector('[data-slot="input-group"]');
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        inputHeight: Math.round(input?.getBoundingClientRect().height ?? 0),
        groupHeight: Math.round(group?.getBoundingClientRect().height ?? 0),
        itemCount: element.querySelectorAll('[data-slot="command-item"]').length,
        inViewport:
          rect.left >= -1 &&
          rect.top >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.bottom <= window.innerHeight + 1,
      };
    });
    await dialog.screenshot({ path, animations: 'disabled', timeout: 12000 });
    return geometry;
  } finally {
    if (opened) {
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }
}
