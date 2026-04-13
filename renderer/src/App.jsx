// src/App.jsx
import { lazy, Suspense, useEffect, useState } from "react";
import ActivationPage, { BlockedPage } from "./pages/ActivationPage";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/tables.css";
import "./styles/proveedores.css";
import "./styles/evoluciones.css";
import "./styles/print.css";

// Páginas livianas — cargadas en el bundle inicial
import HomePage           from "./pages/HomePage";
import PacientesPage      from "./pages/PacientesPage";
import TurnosPage         from "./pages/TurnosPage";
import ConfiguracionPage  from "./pages/ConfiguracionPage";
import CajaDiariaPage     from "./pages/CajaDiariaPage";
import { ToastContainer } from "./components/Toast";

// Páginas pesadas — cargadas bajo demanda (code splitting)
const BuscarPacientesPage  = lazy(() => import("./pages/BuscarPacientesPage"));
const InventarioPage       = lazy(() => import("./pages/InventarioPage"));
const NuevaRecetaPage      = lazy(() => import("./pages/NuevaRecetaPage"));
const ProveedoresPage      = lazy(() => import("./pages/ProveedoresPage"));
const BuscarRecetasPage    = lazy(() => import("./pages/BuscarRecetasPage"));
const GastosPage           = lazy(() => import("./pages/GastosPage"));
const VentasPage           = lazy(() => import("./pages/VentasPage"));
const BalancePage          = lazy(() => import("./pages/BalancePage"));
const CajaPage             = lazy(() => import("./pages/CajaPage"));
const PanelProfesionalPage = lazy(() => import("./pages/PanelProfesionalPage"));

function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, opacity: 0.4, fontSize: 14 }}>
      Cargando...
    </div>
  );
}

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
    const p = JSON.parse(raw);
    const key = String(p?.themeKey ?? "clasico");
    const validKey = MODES.some((m) => m.key === key) ? key : "clasico";
    return { companyName: String(p?.companyName ?? "OpticApp"), themeKey: validKey };
  } catch { return { companyName: "OpticApp", themeKey: "clasico" }; }
}

function applyTheme(key) {
  const mode = MODES.find((m) => m.key === key) ?? MODES[0];
  const r = document.documentElement;
  for (const [prop, val] of Object.entries(mode.vars)) r.style.setProperty(prop, val);
  if (key === "oscuro") r.setAttribute("data-theme", "dark");
  else r.removeAttribute("data-theme");
}

const NAV = [
  { section: "Inicio",     key: "home",           label: "Home" },
  { section: null,         key: "panel",          label: "Panel Profesional" },
  { section: null,         key: "turnos",          label: "Turnos" },
  { section: "Pacientes",  key: "pacientes",       label: "Crear Paciente" },
  { section: null,         key: "buscarPaciente",  label: "Buscar Paciente" },
  { section: "Recetas",    key: "receta",          label: "Nueva Receta" },
  { section: null,         key: "buscarRecetas",   label: "Buscar Recetas" },
  { section: "Inventario", key: "inventario",      label: "Inventario" },
  { section: null,         key: "proveedores",     label: "Proveedores" },
  { section: "Finanzas",   key: "ventas",          label: "Ventas" },
  { section: null,         key: "caja",            label: "Caja" },
  { section: null,         key: "balance",         label: "Balance" },
  { section: null,         key: "gastos",          label: "Gastos" },
  { section: "Sistema",    key: "config",          label: "Configuración" },
];

export default function App() {
  const [tab, setTab]           = useState("home");
  const [ui,  setUi]            = useState(() => loadUi());
  // "checking" | "inactive" | "active" | "expired"
  const [licenseStatus, setLicenseStatus] = useState("checking");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState(null);

  useEffect(() => {
    window.api.checkLicense().then((res) => {
      setLicenseStatus(res.status);
      setLicenseExpiresAt(res.expiresAt ?? null);
    });
  }, []);

  useEffect(() => {
    applyTheme(ui.themeKey);
    function onUiUpdated() {
      const next = loadUi();
      setUi(next);
      applyTheme(next.themeKey);
    }
    window.addEventListener("opticapp:ui-updated", onUiUpdated);
    window.addEventListener("storage", onUiUpdated);
    return () => {
      window.removeEventListener("opticapp:ui-updated", onUiUpdated);
      window.removeEventListener("storage", onUiUpdated);
    };
  }, []);

  if (licenseStatus === "checking") return null;
  if (licenseStatus === "expired")  return <BlockedPage />;
  if (licenseStatus === "inactive") {
    return <ActivationPage onActivated={() => setLicenseStatus("active")} />;
  }

  // Warning de licencia: mostrar si quedan 7 días o menos
  const licenseWarningDays = (() => {
    if (licenseStatus !== "active" || !licenseExpiresAt) return null;
    const diff = new Date(licenseExpiresAt) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 7 ? days : null;
  })();

  let lastSection = null;

  return (
    <>
    <ToastContainer />
    <div className="appLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarBrand">{ui.companyName || "OpticApp"}</div>
        </div>

        <nav className="sideNav">
          {NAV.map(({ section, key, label }) => {
            const showDivider = section && section !== lastSection;
            if (showDivider) lastSection = section;
            return (
              <div key={key}>
                {showDivider && (
                  <div style={{
                    fontSize: 10, fontWeight: 900, opacity: 0.5,
                    letterSpacing: "0.08em", padding: "6px 4px 2px",
                    textTransform: "uppercase",
                  }}>
                    {section}
                  </div>
                )}
                <button
                  className={`sideItem ${tab === key ? "active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  <span className="dot" />
                  {label}
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        {/* Banner de licencia próxima a vencer */}
        {licenseWarningDays !== null && (
          <div style={{
            background: "#fef3c7", borderBottom: "1px solid #fbbf24",
            padding: "8px 20px", fontSize: 13, fontWeight: 700, color: "#92400e",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span>⚠</span>
            La licencia vence en <strong>{licenseWarningDays} día{licenseWarningDays !== 1 ? "s" : ""}</strong>.
            Contactá al soporte para renovar.
          </div>
        )}

        <div className="mainContent">
          <div className="container">
            <Suspense fallback={<PageLoader />}>
              {tab === "home"           && <HomePage              onNavigate={setTab} />}
              {tab === "panel"          && <PanelProfesionalPage  />}
              {tab === "turnos"         && <TurnosPage            />}
              {tab === "receta"         && <NuevaRecetaPage       />}
              {tab === "pacientes"      && <PacientesPage         />}
              {tab === "buscarPaciente" && <BuscarPacientesPage   />}
              {tab === "inventario"     && <InventarioPage        />}
              {tab === "config"         && <ConfiguracionPage     />}
              {tab === "proveedores"    && <ProveedoresPage       />}
              {tab === "buscarRecetas"  && <BuscarRecetasPage     />}
              {tab === "gastos"         && <GastosPage            />}
              {tab === "ventas"         && <VentasPage            />}
              {tab === "caja"           && <CajaPage              />}
              {tab === "balance"        && <BalancePage           onNavigate={setTab} />}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
    </>
  );
}