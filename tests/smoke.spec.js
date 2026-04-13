/**
 * Smoke tests — verifica que todas las secciones carguen sin crashear.
 * Una sola instancia de Electron para todos los tests (más rápido).
 */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, navigate } = require('./helpers/app');

let electronApp;
let page;

test.beforeAll(async () => {
  ({ electronApp, page } = await launchApp());
});

test.afterAll(async () => {
  await closeApp(electronApp);
});

test('la app inicia y muestra el layout principal', async () => {
  const layout = page.locator('.appLayout');
  await expect(layout).toBeVisible({ timeout: 15000 });
});

test('el sidebar contiene todos los items de navegación', async () => {
  const items = [
    'Home', 'Turnos',
    'Crear Paciente', 'Buscar Paciente',
    'Nueva Receta', 'Buscar Recetas',
    'Inventario', 'Proveedores',
    'Ventas', 'Caja', 'Balance', 'Gastos',
    'Configuración',
  ];

  for (const label of items) {
    await expect(
      page.locator('.sideItem', { hasText: label })
    ).toBeVisible({ timeout: 5000 });
  }
});

// ─── Navegación por cada sección ────────────────────────────────────────────

test('Home carga sin errores', async () => {
  await navigate(page, 'Home');
  await expect(page.locator('.container')).toBeVisible();
});

test('Turnos carga sin errores', async () => {
  await navigate(page, 'Turnos');
  await expect(page.locator('.container')).toBeVisible();
});

test('Crear Paciente carga sin errores', async () => {
  await navigate(page, 'Crear Paciente');
  await expect(page.locator('.container')).toBeVisible();
});

test('Buscar Paciente carga sin errores', async () => {
  await navigate(page, 'Buscar Paciente');
  await expect(page.locator('.container')).toBeVisible();
});

test('Nueva Receta carga sin errores', async () => {
  await navigate(page, 'Nueva Receta');
  await expect(page.locator('.container')).toBeVisible();
});

test('Buscar Recetas carga sin errores', async () => {
  await navigate(page, 'Buscar Recetas');
  await expect(page.locator('.container')).toBeVisible();
});

test('Inventario carga sin errores', async () => {
  await navigate(page, 'Inventario');
  await expect(page.locator('.container')).toBeVisible();
});

test('Proveedores carga sin errores', async () => {
  await navigate(page, 'Proveedores');
  await expect(page.locator('.container')).toBeVisible();
});

test('Ventas carga sin errores', async () => {
  await navigate(page, 'Ventas');
  await expect(page.locator('.container')).toBeVisible();
});

test('Caja carga sin errores', async () => {
  await navigate(page, 'Caja');
  await expect(page.locator('.container')).toBeVisible();
});

test('Balance carga sin errores', async () => {
  await navigate(page, 'Balance');
  await expect(page.locator('.container')).toBeVisible();
});

test('Gastos carga sin errores', async () => {
  await navigate(page, 'Gastos');
  await expect(page.locator('.container')).toBeVisible();
});

test('Configuración carga sin errores', async () => {
  await navigate(page, 'Configuración');
  await expect(page.locator('.container')).toBeVisible();
});
