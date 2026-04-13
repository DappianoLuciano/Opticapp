# Manual de publicación — OpticApp

---

## 1. Instalar la app en un cliente nuevo

1. Abrí la carpeta `dist-electron/` dentro del proyecto
2. Encontrás el archivo `OpticApp Setup 1.0.0.exe`
3. Mandáselo al cliente (WhatsApp, Drive, USB, correo)
4. El cliente hace doble click → se instala solo → ícono en el escritorio
5. La primera vez le pide el código de licencia para activarla

---

## 2. Publicar una versión nueva

### Paso 1 — Modificá el número de versión

Abrí `package.json` y cambiá la línea:

```json
"version": "1.0.0"
```

Por el número nuevo, por ejemplo:

```json
"version": "1.0.1"
```

Regla simple:
- Bug o corrección pequeña → subís el último número (1.0.0 → 1.0.1)
- Funcionalidad nueva → subís el del medio (1.0.0 → 1.1.0)
- Cambio grande → subís el primero (1.0.0 → 2.0.0)

### Paso 2 — Publicar

Hacé doble click en el archivo `publicar.bat` que está en el escritorio.

O desde la terminal en la carpeta del proyecto:

```cmd
npx cross-env GH_TOKEN=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 npm run release
```

### Paso 3 — Esperar (5 a 15 minutos)

El proceso hace tres cosas automáticamente:
1. Compila el código
2. Genera el instalador `.exe`
3. Lo sube a GitHub Releases

Cuando termina sin errores, la actualización ya está disponible para todos los clientes.

---

## 3. Qué ven los clientes

La próxima vez que abran la app:

1. La app verifica GitHub en silencio al arrancar
2. Si hay versión nueva → en **Configuración → Actualizaciones** aparece un aviso
3. El cliente hace click en **"Descargar"** → ve una barra de progreso
4. Al terminar → click en **"Instalar y reiniciar"**
5. La app se cierra, se actualiza sola y vuelve a abrir

El cliente nunca necesita descargar ni instalar nada manualmente.

---

## 4. Archivo publicar.bat

Creá este archivo en el escritorio para publicar con doble click:

```bat
@echo off
cd "C:\Users\ludap\OneDrive\Desktop\OPTICA\opticapp"
npx cross-env GH_TOKEN=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 npm run release
pause
```

---

## 5. Copias de seguridad (backup)

- **Automático**: cada vez que se abre la app se genera una copia en la carpeta configurada
- **Manual**: Configuración → Copia de seguridad → "Guardar copia ahora"
- **En la nube**: Configuración → "Elegir carpeta" → seleccioná una carpeta de Google Drive, OneDrive o Dropbox. A partir de ahí los backups automáticos se guardan ahí y la nube los sincroniza sola.
- Se conservan las últimas 15 copias automáticas

---

## 6. Contactos útiles

| Qué             | Dónde                                      |
|-----------------|--------------------------------------------|
| Código fuente   | github.com/DappianoLuciano/opticapp        |
| Releases        | github.com/DappianoLuciano/opticapp/releases |
| Token GitHub    | Guardado en publicar.bat                   |
