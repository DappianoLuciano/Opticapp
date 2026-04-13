const { _electron: electron } = require('@playwright/test');
const path = require('path');

/**
 * Lanza la app de Electron y devuelve { electronApp, page }.
 * Mockea window.api.checkLicense para que siempre devuelva "active",
 * así los tests pasan la pantalla de licencia automáticamente.
 */
async function launchApp() {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../../main/main.js')],
    env: { ...process.env },
  });

  // Interceptar TODAS las ventanas que se abran para inyectar el mock
  electronApp.on('window', async (win) => {
    await win.addInitScript(() => {
      // Esperar a que window.api esté disponible (lo pone el preload)
      const patchApi = () => {
        if (window.api) {
          const orig = window.api.checkLicense;
          window.api.checkLicense = () => Promise.resolve({ status: 'active' });
        } else {
          setTimeout(patchApi, 10);
        }
      };
      patchApi();
    });
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Esperar a que cargue el layout principal (o la página de activación)
  await page.waitForSelector('.appLayout, [class*="activation"]', { timeout: 20000 }).catch(() => {});

  return { electronApp, page };
}

async function closeApp(electronApp) {
  await electronApp.close();
}

/**
 * Navega a una sección del sidebar por su label.
 * Ejemplo: await navigate(page, 'Turnos')
 */
async function navigate(page, label) {
  await page.locator('.sideItem', { hasText: label }).click();
  await page.waitForTimeout(500); // Esperar render
}

module.exports = { launchApp, closeApp, navigate };
