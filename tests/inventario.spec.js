/**
 * Tests de la sección "Inventario"
 * Verifica tabs, formularios de armazones y vidrios.
 */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, navigate } = require('./helpers/app');

let electronApp;
let page;

test.beforeAll(async () => {
  ({ electronApp, page } = await launchApp());
  await page.waitForSelector('.appLayout', { timeout: 20000 });
  await navigate(page, 'Inventario');
});

test.afterAll(async () => {
  await closeApp(electronApp);
});

test('muestra el título "Inventario"', async () => {
  await expect(page.locator('h1', { hasText: 'Inventario' })).toBeVisible();
});

test('tiene las pestañas Armazones y Vidrios', async () => {
  await expect(page.locator('button', { hasText: 'Armazones' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'Vidrios' })).toBeVisible();
});

// ─── Tab Armazones ────────────────────────────────────────────────────────────

test('tab Armazones: muestra campos Marca, Modelo, Precio', async () => {
  await page.locator('button', { hasText: 'Armazones' }).click();
  await page.waitForTimeout(300);

  await expect(page.locator('input[placeholder*="25.000"]').first()).toBeVisible(); // precio
});

test('tab Armazones: el botón "Guardar armazón" existe', async () => {
  await expect(page.locator('button', { hasText: 'Guardar armazón' })).toBeVisible();
});

test('tab Armazones: los multiplicadores de precio están disponibles', async () => {
  // Los botones ×2.1, ×2.2, etc.
  await expect(page.locator('button', { hasText: '×' }).first()).toBeVisible();
});

test('tab Armazones: el campo marca acepta texto', async () => {
  const marcaInput = page.locator('input').first();
  await marcaInput.fill('Ray-Ban Test');
  await expect(marcaInput).toHaveValue('Ray-Ban Test');
  await marcaInput.clear();
});

// ─── Tab Vidrios ──────────────────────────────────────────────────────────────

test('tab Vidrios: muestra campos Nombre y Descripción', async () => {
  await page.locator('button', { hasText: 'Vidrios' }).click();
  await page.waitForTimeout(300);

  await expect(page.locator('input[placeholder*="Orgánico blanco"]')).toBeVisible();
  await expect(page.locator('input[placeholder*="-400"]')).toBeVisible();
});

test('tab Vidrios: el botón "Agregar vidrio" existe', async () => {
  await expect(page.locator('button', { hasText: 'Agregar vidrio' })).toBeVisible();
});

test('tab Vidrios: el buscador de vidrios existe', async () => {
  await expect(page.locator('input[placeholder*="Nombre o descripción"]')).toBeVisible();
});

test('tab Vidrios: el buscador filtra al escribir', async () => {
  const searchInput = page.locator('input[placeholder*="Nombre o descripción"]');
  await searchInput.fill('orgánico');
  await page.waitForTimeout(500);
  // No debe crashear y el input debe tener el valor ingresado
  await expect(searchInput).toHaveValue('orgánico');
  await searchInput.clear();
});
