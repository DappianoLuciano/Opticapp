// src/pages/ConfiguracionPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../components/Toast";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNumOrNull(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

/* =========================
   UI SETTINGS (nombre + theme)
========================= */
const UI_KEY = "opticapp:ui";

const MODES = [
  {
    key: "clasico",
    label: "Clásico",
    vars: {
      "--bg": "#f6f7f8", "--card": "#ffffff", "--text": "#0f172a",
      "--muted": "rgba(15,23,42,0.65)", "--border": "rgba(15,23,42,0.10)",
      "--shadow": "0 10px 30px rgba(2,6,23,0.08)", "--input-bg": "#ffffff",
      "--green": "#7ad8b0", "--green-2": "#55c99a", "--green-soft": "rgba(122,216,176,0.22)",
      "--sidebar": "#0c5a55", "--sidebar-border": "rgba(255,255,255,0.10)",
    },
  },
  {
    key: "oscuro",
    label: "Oscuro",
    vars: {
      "--bg": "#0f172a", "--card": "#1e293b", "--text": "#e2e8f0",
      "--muted": "rgba(226,232,240,0.55)", "--border": "rgba(255,255,255,0.10)",
      "--shadow": "0 10px 30px rgba(0,0,0,0.40)", "--input-bg": "#293548",
      "--green": "#7ad8b0", "--green-2": "#55c99a", "--green-soft": "rgba(122,216,176,0.15)",
      "--sidebar": "#050d1a", "--sidebar-border": "rgba(255,255,255,0.08)",
    },
  },
];

function loadUi() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return { companyName: "OpticApp", themeKey: "clasico" };
    const parsed = JSON.parse(raw);
    const key = String(parsed?.themeKey ?? "clasico");
    const validKey = MODES.some((m) => m.key === key) ? key : "clasico";
    return { companyName: String(parsed?.companyName ?? "OpticApp"), themeKey: validKey };
  } catch {
    return { companyName: "OpticApp", themeKey: "clasico" };
  }
}

function applyTheme(key) {
  const mode = MODES.find((m) => m.key === key) ?? MODES[0];
  const r = document.documentElement;
  for (const [prop, val] of Object.entries(mode.vars)) r.style.setProperty(prop, val);
  if (key === "oscuro") r.setAttribute("data-theme", "dark");
  else r.removeAttribute("data-theme");
}

function saveUi(next) {
  localStorage.setItem(UI_KEY, JSON.stringify(next));
  // Aviso inmediato al App.jsx
  window.dispatchEvent(new CustomEvent("opticapp:ui-updated"));
}

// ── WhatsApp status badge ─────────────────────────────────────────────────────
function WaBadge({ status }) {
  const MAP = {
    ready:        { color: "#0b7a55", bg: "rgba(85,201,154,0.15)", label: "Conectado" },
    connecting:   { color: "#b45309", bg: "rgba(245,158,11,0.12)", label: "Conectando..." },
    qr:           { color: "#1d4ed8", bg: "rgba(59,130,246,0.12)", label: "Escaneá el QR" },
    disconnected: { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Desconectado" },
  };
  const info = MAP[status] ?? MAP.disconnected;
  return (
    <span style={{
      fontSize: 12, fontWeight: 900, padding: "3px 10px", borderRadius: 999,
      background: info.bg, color: info.color, border: `1px solid ${info.color}33`,
    }}>
      {info.label}
    </span>
  );
}

export default function ConfiguracionPage({ licenseModules = [] }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [seniaPorcentaje, setSeniaPorcentaje] = useState("");

  const [descuentoEfectivo, setDescuentoEfectivo] = useState("");
  const [descuentoDebito, setDescuentoDebito] = useState("");
  const [descuentoTransferencia, setDescuentoTransferencia] = useState("");

  // cuotas: [{ cuotas, recargoPct }]
  const [cuotasCredito, setCuotasCredito] = useState([]);

  const [err, setErr] = useState("");

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const [waStatus,   setWaStatus]   = useState("disconnected");
  const [waQR,       setWaQR]       = useState(null);
  const [waLoading,  setWaLoading]  = useState(false);
  const waInitRef = useRef(false);

  const [waTestPhone,   setWaTestPhone]   = useState("");
  const [waTestMsg,     setWaTestMsg]     = useState("Hola! Este es un mensaje de prueba de OpticApp.");
  const [waTestLoading, setWaTestLoading] = useState(false);
  const [waTestResult,  setWaTestResult]  = useState(null); // { ok, msg }

  // ── Licencia ──────────────────────────────────────────────────────────────
  const [licenseInfo, setLicenseInfo] = useState(null); // { status, expiresAt, daysLeft }

  // ── Backup ────────────────────────────────────────────────────────────────
  const [backupLoading, setBackupLoading] = useState(false);

  // ── Google Drive Backup ───────────────────────────────────────────────────
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [gdriveLoading,   setGdriveLoading]   = useState(false);
  const [gdriveMsg,       setGdriveMsg]       = useState(null); // { ok, text }

  // ── Auto-update ───────────────────────────────────────────────────────────
  const [appVersion,    setAppVersion]    = useState("");
  const [updateStatus,  setUpdateStatus]  = useState("idle");
  // idle | checking | available | not-available | downloading | downloaded | error
  const [updateInfo,    setUpdateInfo]    = useState(null); // { version, percent, message }
  const [updateLoading, setUpdateLoading] = useState(false);

  // Escuchar actualizaciones push desde el proceso principal
  useEffect(() => {
    window.api.onWhatsappStatus((data) => {
      setWaStatus(data.status);
      setWaQR(data.qrDataUrl ?? null);
    });
    // Obtener estado actual al montar
    window.api.whatsappGetStatus().then((data) => {
      setWaStatus(data.status);
      setWaQR(data.qrDataUrl ?? null);
    }).catch(() => {});
    return () => window.api.offWhatsappStatus();
  }, []);

  async function waConnect() {
    if (waLoading || waInitRef.current) return;
    waInitRef.current = true;
    setWaLoading(true);
    try {
      await window.api.whatsappInit();
    } catch (e) {
      toast.error("Error al iniciar WhatsApp: " + (e?.message ?? e));
    } finally {
      setWaLoading(false);
      waInitRef.current = false;
    }
  }

  async function waDisconnect() {
    setWaLoading(true);
    try { await window.api.whatsappDisconnect(); } catch (_) {}
    setWaLoading(false);
  }

  async function waSendTest() {
    if (!waTestPhone.trim()) { setWaTestResult({ ok: false, msg: "Ingresá un teléfono" }); return; }
    if (!waTestMsg.trim())   { setWaTestResult({ ok: false, msg: "El mensaje está vacío" }); return; }
    setWaTestLoading(true);
    setWaTestResult(null);
    try {
      await window.api.whatsappSendMessage(waTestPhone.trim(), waTestMsg.trim());
      setWaTestResult({ ok: true, msg: "Mensaje enviado correctamente" });
    } catch (e) {
      setWaTestResult({ ok: false, msg: e?.message || "Error al enviar" });
    } finally {
      setWaTestLoading(false);
    }
  }

  // ✅ UI
  const initialUi = useMemo(() => loadUi(), []);
  const [companyName, setCompanyName] = useState(initialUi.companyName);
  const [themeKey, setThemeKey] = useState(initialUi.themeKey);

  const seniaNum = useMemo(() => toNumOrNull(seniaPorcentaje), [seniaPorcentaje]);
  const deNum = useMemo(() => toNumOrNull(descuentoEfectivo), [descuentoEfectivo]);
  const ddNum = useMemo(() => toNumOrNull(descuentoDebito), [descuentoDebito]);
  const dtNum = useMemo(() => toNumOrNull(descuentoTransferencia), [descuentoTransferencia]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const cfg = await window.api.getConfig();

      setSeniaPorcentaje(String(cfg?.seniaPorcentaje ?? 30));
      setDescuentoEfectivo(String(cfg?.descuentoEfectivo ?? 0));
      setDescuentoDebito(String(cfg?.descuentoDebito ?? 0));
      setDescuentoTransferencia(String(cfg?.descuentoTransferencia ?? 0));

      const cuotas = Array.isArray(cfg?.cuotasCredito) ? cfg.cuotasCredito : [];
      setCuotasCredito(
        cuotas.length
          ? cuotas.map((x) => ({
              cuotas: String(x?.cuotas ?? ""),
              recargoPct: String(x?.recargoPct ?? 0),
            }))
          : [
              { cuotas: "1", recargoPct: "0" },
              { cuotas: "3", recargoPct: "10" },
              { cuotas: "6", recargoPct: "20" },
            ]
      );
    } catch (e) {
      setErr(e?.message || "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  // ── Google Drive helpers ───────────────────────────────────────────────────
  async function loadGdriveStatus() {
    try {
      const res = await window.api.gdriveStatus?.();
      setGdriveConnected(!!res?.connected);
    } catch { /* no crítico */ }
  }

  async function doGdriveConnect() {
    setGdriveLoading(true);
    setGdriveMsg(null);
    try {
      await window.api.gdriveConnect();
      setGdriveConnected(true);
      setGdriveMsg({ ok: true, text: "¡Conectado con Google Drive!" });
    } catch (e) {
      setGdriveMsg({ ok: false, text: e?.message || "Error al conectar con Google Drive" });
    } finally {
      setGdriveLoading(false);
    }
  }

  async function doGdriveDisconnect() {
    try {
      await window.api.gdriveDisconnect();
      setGdriveConnected(false);
      setGdriveMsg({ ok: true, text: "Desconectado de Google Drive." });
    } catch (e) {
      toast.error(e?.message || "Error al desconectar");
    }
  }

  async function doGdriveBackupNow() {
    setGdriveLoading(true);
    setGdriveMsg(null);
    try {
      const res = await window.api.gdriveBackup();
      setGdriveMsg({ ok: true, text: `Backup subido: ${res.name}` });
    } catch (e) {
      setGdriveMsg({ ok: false, text: e?.message || "Error al subir el backup" });
    } finally {
      setGdriveLoading(false);
    }
  }

  // ── Auto-update helpers ────────────────────────────────────────────────────
  async function doCheckUpdate() {
    setUpdateLoading(true);
    setUpdateStatus("checking");
    setUpdateInfo(null);
    try {
      const res = await window.api.checkForUpdates();
      if (!res?.active) {
        setUpdateStatus("not-available");
        setUpdateInfo({ message: "Actualizaciones no disponibles en modo desarrollo." });
      }
      // El estado real llega por el evento onUpdaterStatus
    } catch (e) {
      setUpdateStatus("error");
      setUpdateInfo({ message: e?.message || "Error al verificar actualizaciones" });
    } finally {
      setUpdateLoading(false);
    }
  }

  async function doDownload() {
    setUpdateStatus("downloading");
    setUpdateInfo((p) => ({ ...p, percent: 0 }));
    try { await window.api.downloadUpdate(); } catch (e) {
      setUpdateStatus("error");
      setUpdateInfo({ message: e?.message || "Error al descargar" });
    }
  }

  async function doInstall() {
    await window.api.installUpdate();
  }

  useEffect(() => {
    applyTheme(themeKey);
    load();
    loadGdriveStatus();

    // Versión actual
    window.api.getAppVersion?.().then((r) => setAppVersion(r?.version ?? "")).catch(() => {});

    // Escuchar eventos del updater
    window.api.onUpdaterStatus?.((data) => {
      switch (data.event) {
        case "checking":
          setUpdateStatus("checking");
          break;
        case "available":
          setUpdateStatus("available");
          setUpdateInfo({ version: data.version, releaseNotes: data.releaseNotes });
          break;
        case "not-available":
          setUpdateStatus("not-available");
          break;
        case "progress":
          setUpdateStatus("downloading");
          setUpdateInfo((p) => ({ ...p, percent: data.percent }));
          break;
        case "downloaded":
          setUpdateStatus("downloaded");
          setUpdateInfo((p) => ({ ...p, version: data.version }));
          break;
        case "error":
          setUpdateStatus("error");
          setUpdateInfo({ message: data.message });
          break;
        default: break;
      }
    });

    // Cargar info de licencia
    window.api.checkLicense().then((res) => {
      if (res.status === "active" && res.expiresAt) {
        const diff = new Date(res.expiresAt) - new Date();
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        setLicenseInfo({ status: res.status, expiresAt: res.expiresAt, daysLeft });
      } else {
        setLicenseInfo({ status: res.status, expiresAt: res.expiresAt ?? null, daysLeft: null });
      }
    }).catch(() => {});

    return () => window.api.offUpdaterStatus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    const s = seniaNum;
    if (s === null) return "El porcentaje de seña es obligatorio";
    if (Number.isNaN(s)) return "Porcentaje de seña inválido";
    if (s < 0 || s > 100) return "Seña debe estar entre 0 y 100";

    const vals = [
      { label: "Descuento efectivo", v: deNum },
      { label: "Descuento billetera virtual", v: ddNum },
      { label: "Descuento transferencia", v: dtNum },
    ];

    for (const it of vals) {
      if (it.v === null) continue;
      if (Number.isNaN(it.v)) return `${it.label} inválido`;
      if (it.v < 0 || it.v > 100) return `${it.label} debe estar entre 0 y 100`;
    }

    if (!Array.isArray(cuotasCredito) || cuotasCredito.length === 0) return "Cargá al menos 1 opción de cuotas";

    for (const row of cuotasCredito) {
      const c = Number(String(row.cuotas ?? "").trim());
      const r = Number(String(row.recargoPct ?? "").trim().replace(",", "."));

      if (!Number.isInteger(c) || c <= 0) return "Cuotas inválidas (deben ser enteras > 0)";
      if (!Number.isFinite(r) || r < 0 || r > 300) return "Recargo inválido (0 a 300)";
    }

    return "";
  }

  async function onSave() {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const payload = {
        seniaPorcentaje: clamp(seniaNum, 0, 100),
        descuentoEfectivo: clamp(deNum === null ? 0 : deNum, 0, 100),
        descuentoDebito: clamp(ddNum === null ? 0 : ddNum, 0, 100),
        descuentoTransferencia: clamp(dtNum === null ? 0 : dtNum, 0, 100),
        cuotasCredito: cuotasCredito.map((x) => ({
          cuotas: Number(String(x.cuotas).trim()),
          recargoPct: Number(String(x.recargoPct).trim().replace(",", ".")),
        })),
      };

      const saved = await window.api.setConfig(payload);

      setSeniaPorcentaje(String(saved?.seniaPorcentaje ?? payload.seniaPorcentaje));
      setDescuentoEfectivo(String(saved?.descuentoEfectivo ?? payload.descuentoEfectivo));
      setDescuentoDebito(String(saved?.descuentoDebito ?? payload.descuentoDebito));
      setDescuentoTransferencia(String(saved?.descuentoTransferencia ?? payload.descuentoTransferencia));

      const cuotas = Array.isArray(saved?.cuotasCredito) ? saved.cuotasCredito : payload.cuotasCredito;
      setCuotasCredito(
        cuotas.map((x) => ({
          cuotas: String(x?.cuotas ?? ""),
          recargoPct: String(x?.recargoPct ?? 0),
        }))
      );
    } catch (e) {
      setErr(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function updateCuota(idx, key, val) {
    setCuotasCredito((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  }

  function addCuota() {
    setCuotasCredito((prev) => [...prev, { cuotas: "", recargoPct: "0" }]);
  }

  function removeCuota(idx) {
    setCuotasCredito((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ cuotas: "1", recargoPct: "0" }];
    });
  }

  function stepCuota(idx, delta) {
    setCuotasCredito((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = Math.max(1, (parseInt(r.cuotas) || 0) + delta);
        return { ...r, cuotas: String(next) };
      })
    );
  }

  // ✅ UI actions
  function saveCompany() {
    const nextName = (companyName || "").trim() || "OpticApp";
    const next = { companyName: nextName, themeKey };
    saveUi(next);
  }

  function pickTheme(key) {
    setThemeKey(key);
    applyTheme(key);
    const next = { companyName: (companyName || "").trim() || "OpticApp", themeKey: key };
    saveUi(next);
  }

  return (
    <div className="page">
      <h2>Configuración</h2>

      {/* ── WhatsApp Recordatorios ── */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="rowBetween">
          <div>
            <h3 style={{ margin: 0 }}>WhatsApp — Recordatorios automáticos</h3>
            <div className="hint" style={{ marginTop: 6 }}>
              Envía un mensaje automático <b>24 horas antes</b> y <b>2 horas antes</b> de cada turno
              (requiere teléfono cargado en el turno y la app abierta).
            </div>
          </div>
          <WaBadge status={waStatus} />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* QR code */}
          {waStatus === "qr" && waQR && (
            <div style={{ textAlign: "center" }}>
              <img src={waQR} alt="QR WhatsApp" style={{ width: 200, height: 200, borderRadius: 12, border: "1px solid var(--border)" }} />
              <div className="hint" style={{ marginTop: 6, fontSize: 11 }}>
                Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </div>
            </div>
          )}

          {/* Info + botones */}
          <div style={{ flex: 1, minWidth: 220 }}>
            {waStatus === "disconnected" && (
              <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.7 }}>
                Conectá tu cuenta de WhatsApp para habilitar el envío automático de recordatorios.
              </div>
            )}
            {waStatus === "connecting" && (
              <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.7 }}>
                Iniciando sesión, aguardá unos segundos...
              </div>
            )}
            {waStatus === "qr" && (
              <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.7 }}>
                Escaneá el código QR con tu teléfono para vincular la cuenta.
              </div>
            )}
            {waStatus === "ready" && (
              <div style={{ marginBottom: 12, fontSize: 13, color: "#0b7a55", fontWeight: 700 }}>
                WhatsApp conectado. Los recordatorios se enviarán automáticamente.
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              {(waStatus === "disconnected") && (
                <button className="btnPrimary" onClick={waConnect} disabled={waLoading}>
                  {waLoading ? "Iniciando..." : "Conectar WhatsApp"}
                </button>
              )}
              {(waStatus === "ready" || waStatus === "connecting" || waStatus === "qr") && (
                <button className="btnGhost" onClick={waDisconnect} disabled={waLoading}>
                  Desconectar
                </button>
              )}
            </div>

            {/* ── Prueba de envío manual ── */}
            {waStatus === "ready" && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Probar envío manual</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    value={waTestPhone}
                    onChange={(e) => setWaTestPhone(e.target.value)}
                    placeholder="Teléfono (ej: 3412345678)"
                    style={{ fontSize: 13 }}
                  />
                  <textarea
                    value={waTestMsg}
                    onChange={(e) => setWaTestMsg(e.target.value)}
                    rows={2}
                    style={{ fontSize: 13, resize: "vertical", borderRadius: 8, padding: "8px 10px", border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button className="btn primary" onClick={waSendTest} disabled={waTestLoading} style={{ fontSize: 12, padding: "6px 16px" }}>
                      {waTestLoading ? "Enviando..." : "Enviar mensaje de prueba"}
                    </button>
                    {waTestResult && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: waTestResult.ok ? "#0b7a55" : "#b91c1c" }}>
                        {waTestResult.msg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Licencia ── */}
      {licenseInfo && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="rowBetween">
            <div>
              <h3 style={{ margin: 0 }}>Licencia</h3>
              <div className="hint" style={{ marginTop: 6 }}>
                Estado de la activación del software.
              </div>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 900, padding: "3px 10px", borderRadius: 999,
              background: licenseInfo.status === "active"
                ? "rgba(85,201,154,0.15)"
                : "rgba(185,28,28,0.12)",
              color: licenseInfo.status === "active" ? "#0b7a55" : "#b91c1c",
              border: `1px solid ${licenseInfo.status === "active" ? "#0b7a5533" : "#b91c1c33"}`,
            }}>
              {licenseInfo.status === "active" ? "Activa" : licenseInfo.status === "expired" ? "Vencida" : "Inactiva"}
            </span>
          </div>

          {licenseInfo.status === "active" && licenseInfo.expiresAt && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, display: "flex", gap: 20 }}>
                <div>
                  <span style={{ opacity: 0.55, fontWeight: 600 }}>Vence el: </span>
                  <span style={{ fontWeight: 800 }}>
                    {new Date(licenseInfo.expiresAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div>
                  <span style={{ opacity: 0.55, fontWeight: 600 }}>Días restantes: </span>
                  <span style={{
                    fontWeight: 900,
                    color: licenseInfo.daysLeft <= 7 ? "#b45309" : licenseInfo.daysLeft <= 30 ? "#0b7a55" : "var(--text)",
                  }}>
                    {licenseInfo.daysLeft}
                  </span>
                </div>
              </div>
              {licenseInfo.daysLeft <= 7 && (
                <div style={{
                  marginTop: 10, padding: "10px 14px", borderRadius: 8,
                  background: "rgba(180,83,9,0.10)", border: "1px solid rgba(180,83,9,0.30)",
                  fontSize: 13, color: "#b45309", fontWeight: 600,
                }}>
                  La licencia vence pronto. Contactá al soporte para renovar.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Backup en Google Drive (módulo backup_cloud) ── */}
      {licenseModules.includes("backup_cloud") && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="rowBetween" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Backup automático en Google Drive</h3>
              <div className="hint" style={{ marginTop: 6 }}>
                Se sube una copia de la base de datos a tu Google Drive <b>cada 7 días</b> de forma automática.
                Las copias quedan en la carpeta <strong>"OpticApp Backups"</strong> de tu Drive (se conservan las últimas 12).
              </div>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 900, padding: "3px 10px", borderRadius: 999,
              background: gdriveConnected ? "rgba(85,201,154,0.15)" : "rgba(100,116,139,0.12)",
              color: gdriveConnected ? "#0b7a55" : "#64748b",
              border: `1px solid ${gdriveConnected ? "#0b7a5533" : "#64748b33"}`,
              flexShrink: 0,
            }}>
              {gdriveConnected ? "Conectado" : "No conectado"}
            </span>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {!gdriveConnected ? (
              <button className="btn primary" type="button" onClick={doGdriveConnect} disabled={gdriveLoading}>
                {gdriveLoading ? "Abriendo navegador..." : "Conectar con Google Drive"}
              </button>
            ) : (
              <>
                <button className="btn primary" type="button" onClick={doGdriveBackupNow} disabled={gdriveLoading}>
                  {gdriveLoading ? "Subiendo..." : "Subir backup ahora"}
                </button>
                <button className="btn" type="button" onClick={doGdriveDisconnect} disabled={gdriveLoading}>
                  Desconectar
                </button>
              </>
            )}
          </div>

          {gdriveMsg && (
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: gdriveMsg.ok ? "rgba(85,201,154,0.10)" : "rgba(185,28,28,0.08)",
              border: `1px solid ${gdriveMsg.ok ? "rgba(85,201,154,0.35)" : "rgba(185,28,28,0.25)"}`,
              color: gdriveMsg.ok ? "#0b7a55" : "#b91c1c",
            }}>
              {gdriveMsg.text}
            </div>
          )}

          {!gdriveConnected && (
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 12, opacity: 0.7, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 800, marginBottom: 6, opacity: 1 }}>Cómo conectar:</div>
              1. Hacé clic en <strong>"Conectar con Google Drive"</strong><br />
              2. Se va a abrir el navegador con la pantalla de Google<br />
              3. Iniciá sesión y dale permiso a OpticApp<br />
              4. Volvé a la app — la conexión queda guardada
            </div>
          )}
        </section>
      )}

      {/* ── Actualizaciones ── */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="rowBetween">
          <div>
            <h3 style={{ margin: 0 }}>Actualizaciones</h3>
            <div className="hint" style={{ marginTop: 6 }}>
              {appVersion ? <>Versión instalada: <strong>v{appVersion}</strong></> : "Versión actual de OpticApp."}
            </div>
          </div>
          {updateStatus !== "downloading" && updateStatus !== "downloaded" && (
            <button className="btn primary" type="button" onClick={doCheckUpdate} disabled={updateLoading || updateStatus === "checking"}>
              {updateStatus === "checking" ? "Verificando..." : "Buscar actualizaciones"}
            </button>
          )}
        </div>

        {updateStatus !== "idle" && (
          <div style={{ marginTop: 14 }}>
            {updateStatus === "checking" && (
              <div style={{ fontSize: 13, opacity: 0.6 }}>Verificando actualizaciones...</div>
            )}

            {updateStatus === "not-available" && (
              <div style={{ fontSize: 13, color: "#0b7a55", fontWeight: 700 }}>
                La aplicación está actualizada.
              </div>
            )}

            {updateStatus === "error" && (
              <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
                {updateInfo?.message || "Error al verificar actualizaciones."}
                {updateInfo?.message?.includes("desarrollo") && (
                  <span style={{ opacity: 0.6, fontWeight: 400 }}> (normal en modo dev)</span>
                )}
              </div>
            )}

            {updateStatus === "available" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>
                    Nueva versión disponible: <span style={{ color: "#4f46e5" }}>v{updateInfo?.version}</span>
                  </div>
                  {updateInfo?.releaseNotes && (
                    <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4, maxWidth: 400 }}
                      dangerouslySetInnerHTML={{ __html: String(updateInfo.releaseNotes).replace(/<[^>]*>/g, " ").slice(0, 200) }}
                    />
                  )}
                </div>
                <button className="btn primary" type="button" onClick={doDownload} style={{ flexShrink: 0, marginLeft: 16 }}>
                  Descargar
                </button>
              </div>
            )}

            {updateStatus === "downloading" && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Descargando actualización... {updateInfo?.percent ?? 0}%
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${updateInfo?.percent ?? 0}%`, background: "var(--green-2)", borderRadius: 999, transition: "width 0.3s" }} />
                </div>
              </div>
            )}

            {updateStatus === "downloaded" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "rgba(122,216,176,0.10)", border: "1px solid rgba(85,201,154,0.35)" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>
                    v{updateInfo?.version} lista para instalar
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3 }}>
                    La aplicación se reiniciará para completar la actualización.
                  </div>
                </div>
                <button className="btn primary" type="button" onClick={doInstall} style={{ flexShrink: 0, marginLeft: 16 }}>
                  Instalar y reiniciar
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        {/* Header */}
        <div className="rowBetween">
          <div>
            <h3 style={{ margin: 0 }}>Parámetros generales</h3>
            <div className="hint" style={{ marginTop: 6 }}>
              Estos valores impactan en <b>Nueva receta</b>: seña sugerida, descuentos y recargos por cuotas.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn" type="button" onClick={load} disabled={loading || saving}>
              {loading ? "Cargando..." : "Recargar"}
            </button>
            <button className="btn primary" type="button" onClick={onSave} disabled={loading || saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        {err && (
          <div className="fieldErrorSlot" style={{ marginTop: 10 }}>{err}</div>
        )}

        {/* ── Interfaz y empresa ── */}
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 14, letterSpacing: 0.2 }}>
            Interfaz y empresa
          </div>
          <div className="grid2" style={{ alignItems: "start" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Nombre de la empresa</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="OpticApp"
                  disabled={loading || saving}
                />
                <button className="btn" type="button" onClick={saveCompany} disabled={loading || saving}>
                  Guardar
                </button>
              </div>
              <div className="hint" style={{ marginTop: 6 }}>Se muestra en el panel izquierdo.</div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Modo de visualización</div>
              <div style={{ display: "flex", gap: 10 }}>
                {MODES.map((m) => {
                  const isActive = themeKey === m.key;
                  const isDark = m.key === "oscuro";
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => pickTheme(m.key)}
                      disabled={loading || saving}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: isActive ? "2px solid var(--green-2)" : "1px solid var(--border)",
                        background: isDark ? "#1e293b" : "#f0f2f4",
                        color: isDark ? "#e2e8f0" : "#0f172a",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",
                        boxShadow: isActive ? "0 0 0 3px rgba(85,201,154,0.25)" : "none",
                        transition: "all 0.15s",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{
                        width: 20, height: 20, borderRadius: 999,
                        background: isDark ? "#0f172a" : "#fff",
                        border: `2px solid ${isDark ? "#334155" : "#d1d5db"}`,
                        display: "inline-block", flexShrink: 0,
                      }} />
                      {m.label}
                      {isActive && (
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#55c99a", fontWeight: 900 }}>
                          Activo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Pagos y seña ── */}
        <div className="card" style={{ padding: 20, marginTop: 16 }}>

          {/* Fila superior: Seña | Descuentos */}
          <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>

            {/* Seña */}
            <div style={{ paddingRight: 24, minWidth: 160 }}>
              <div style={{ fontWeight: 900, fontSize: 11, marginBottom: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.9 }}>Seña</div>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: 12 }}>Porcentaje (%)</span>
                <input
                  value={seniaPorcentaje}
                  onChange={(e) => { setSeniaPorcentaje(e.target.value); if (err) setErr(""); }}
                  placeholder="30"
                  inputMode="decimal"
                  disabled={loading || saving}
                  style={{ padding: "6px 10px", fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", marginRight: 24 }} />

            {/* Descuentos */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 11, marginBottom: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.9 }}>Descuentos por medio de pago</div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Efectivo", value: descuentoEfectivo, set: setDescuentoEfectivo },
                  { label: "Billetera Virtual", value: descuentoDebito, set: setDescuentoDebito },
                  { label: "Transferencia", value: descuentoTransferencia, set: setDescuentoTransferencia },
                ].map(({ label, value, set }) => (
                  <label key={label} className="field" style={{ margin: 0, flex: 1 }}>
                    <span style={{ fontSize: 12 }}>{label} (%)</span>
                    <input
                      value={value}
                      onChange={(e) => { set(e.target.value); if (err) setErr(""); }}
                      placeholder="0"
                      inputMode="decimal"
                      disabled={loading || saving}
                      style={{ padding: "6px 10px", fontSize: 13 }}
                    />
                  </label>
                ))}
              </div>
              <div className="hint" style={{ marginTop: 6, fontSize: 11 }}>
                Descuento sobre el total (ej: 10% ⇒ Total × 0.90).
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "18px 0" }} />

          {/* Cuotas */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 11, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.9 }}>Tarjeta Banco — cuotas</div>
              <div className="hint" style={{ marginTop: 3, fontSize: 11 }}>
                Recargo sobre el total (ej: 10% ⇒ Total × 1.10).
              </div>
            </div>
            <button className="btn" type="button" onClick={addCuota} disabled={loading || saving} style={{ fontSize: 12, padding: "5px 14px" }}>
              + Agregar
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {cuotasCredito.map((row, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
                {/* Stepper */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>Cuotas</span>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden", background: "var(--input-bg)" }}>
                    <button
                      type="button"
                      onClick={() => stepCuota(idx, -1)}
                      disabled={loading || saving}
                      style={{ width: 28, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "var(--text)", opacity: 0.55 }}
                    >−</button>
                    <input
                      value={row.cuotas}
                      onChange={(e) => updateCuota(idx, "cuotas", e.target.value)}
                      inputMode="numeric"
                      disabled={loading || saving}
                      style={{ width: 38, textAlign: "center", border: "none", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", background: "transparent", fontSize: 13, fontWeight: 800, padding: "5px 2px", color: "var(--text)" }}
                    />
                    <button
                      type="button"
                      onClick={() => stepCuota(idx, +1)}
                      disabled={loading || saving}
                      style={{ width: 28, height: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "var(--text)", opacity: 0.55 }}
                    >+</button>
                  </div>
                </div>

                {/* Recargo */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>Recargo (%)</span>
                  <input
                    value={row.recargoPct}
                    onChange={(e) => updateCuota(idx, "recargoPct", e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    disabled={loading || saving}
                    style={{ padding: "5px 8px", fontSize: 13, width: "100%" }}
                  />
                </div>

                {/* Eliminar */}
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => removeCuota(idx)}
                  disabled={loading || saving}
                  style={{ alignSelf: "center", fontSize: 12, padding: "6px 10px", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}