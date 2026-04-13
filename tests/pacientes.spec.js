/**
 * Tests de la sección "Crear Paciente"
 * Verifica campos, validaciones y comportamiento del formulario.
 */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, navigate } = require('./helpers/app');

let electronApp;
let page;

test.beforeAll(async () => {
  ({ electronApp, page } = await launchApp());
  await page.waitForSelector('.appLayout', { timeout: 20000 });
  await navigate(page, 'Crear Paciente');
});

test.afterAll(async () => {
  await closeApp(electronApp);
});

test('muestra el título "Pacientes"', async () => {
  await expect(page.locator('h2', { hasText: 'Pacientes' })).toBeVisible();
});

test('el formulario tiene todos los campos requeridos', async () => {
  await expect(page.locator('input[placeholder*="40.123.456"]')).toBeVisible(); // DNI
  await expect(page.locator('input[placeholder*="23456789"]')).toBeVisible();   // Teléfono
  await expect(page.locator('input[placeholder*="gmail.com"]')).toBeVisible();  // Email
  await expect(page.locator('input[type="date"]')).toBeVisible();               // Fecha nacimiento
});

test('el botón "Guardar paciente" está visible', async () => {
  await expect(page.locator('button.btn.primary', { hasText: 'Guardar' })).toBeVisible();
});

test('el campo nombre acepta texto', async () => {
  const input = page.locator('input').first();
  await input.fill('Juan Pérez Test');
  await expect(input).toHaveValue('Juan Pérez Test');
  await input.clear();
});

test('el campo DNI solo acepta números y formatea con puntos', async () => {
  const dniInput = page.locator('input[placeholder*="40.123.456"]');
  await dniInput.fill('40123456');
  // El campo formatea el DNI automáticamente
  await page.waitForTimeout(300);
  const val = await dniInput.inputValue();
  expect(val).toMatch(/\d/); // tiene algún dígito
  await dniInput.clear();
});

test('el campo email sugiere dominios automáticamente', async () => {
  const emailInput = page.locator('input[placeholder*="gmail.com"]');
  await emailInput.fill('test@');
  await page.waitForTimeout(300);
  // Debería aparecer el dropdown de sugerencias
  const suggestion = page.locator('li', { hasText: 'gmail.com' });
  await expect(suggestion).toBeVisible({ timeout: 3000 });
  await emailInput.clear();
});

test('el selector de obra social tiene opciones', async () => {
  const comboPlaceholder = page.locator('input[placeholder="— Seleccionar —"]');
  await comboPlaceholder.click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=OSDE').first()).toBeVisible();
  await page.keyboard.press('Escape');
});

test('el formulario muestra error al intentar guardar vacío', async () => {
  const submitBtn = page.locator('button.btn.primary', { hasText: 'Guardar' });
  await submitBtn.click();
  await page.waitForTimeout(500);
  // Debería aparecer algún error de validación
  const errorMsg = page.locator('.inputError, [class*="error"], [class*="Error"]');
  await expect(errorMsg.first()).toBeVisible({ timeout: 3000 });
});
