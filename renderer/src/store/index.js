/**
 * store/index.js
 * Zustand global store.
 * Contiene los datos que se comparten entre múltiples páginas
 * para evitar re-fetchear en cada mount.
 */
import { create } from "zustand";
import * as api from "../api/index.js";

export const useAppStore = create((set, get) => ({
  // ─── Pacientes ─────────────────────────────────────────────────────────────
  patients: [],
  patientsLoaded: false,
  patientsLoading: false,
  fetchPatients: async (force = false) => {
    if (get().patientsLoaded && !force) return;
    set({ patientsLoading: true });
    try {
      const data = await api.listPatients();
      set({ patients: data, patientsLoaded: true });
    } catch (e) {
      console.error("fetchPatients error:", e);
    } finally {
      set({ patientsLoading: false });
    }
  },
  invalidatePatients: () => set({ patientsLoaded: false }),

  // ─── Armazones ─────────────────────────────────────────────────────────────
  frames: [],
  framesLoaded: false,
  framesLoading: false,
  fetchFrames: async (force = false) => {
    if (get().framesLoaded && !force) return;
    set({ framesLoading: true });
    try {
      const data = await api.listFrames();
      set({ frames: data, framesLoaded: true });
    } catch (e) {
      console.error("fetchFrames error:", e);
    } finally {
      set({ framesLoading: false });
    }
  },
  invalidateFrames: () => set({ framesLoaded: false }),

  // ─── Vidrios ───────────────────────────────────────────────────────────────
  vidrios: [],
  vidriosLoaded: false,
  fetchVidrios: async (force = false) => {
    if (get().vidriosLoaded && !force) return;
    try {
      const data = await api.listVidrios();
      set({ vidrios: data, vidriosLoaded: true });
    } catch (e) {
      console.error("fetchVidrios error:", e);
    }
  },
  invalidateVidrios: () => set({ vidriosLoaded: false }),

  // ─── Configuración ─────────────────────────────────────────────────────────
  config: null,
  configLoaded: false,
  fetchConfig: async (force = false) => {
    if (get().configLoaded && !force) return;
    try {
      const data = await api.getConfig();
      set({ config: data, configLoaded: true });
    } catch (e) {
      console.error("fetchConfig error:", e);
    }
  },
  invalidateConfig: () => set({ configLoaded: false }),

  // ─── Licencia ──────────────────────────────────────────────────────────────
  licenseStatus: "checking", // "checking" | "inactive" | "active" | "expired"
  licenseExpiresAt: null,
  setLicenseStatus: (status, expiresAt = null) =>
    set({ licenseStatus: status, licenseExpiresAt: expiresAt }),

  // ─── Filtros Ventas ────────────────────────────────────────────────────────
  ventasFiltros: {
    periodoTab: "hoy",
    desde: "",
    hasta: "",
    pacienteId: "",
    pacienteQ: "",
    estadoFiltro: "",
  },
  setVentasFiltros: (patch) =>
    set((s) => ({ ventasFiltros: { ...s.ventasFiltros, ...patch } })),

  // ─── Filtros Balance ───────────────────────────────────────────────────────
  balanceFiltros: {
    periodoTab: "mes",
    desde: "",
    hasta: "",
  },
  setBalanceFiltros: (patch) =>
    set((s) => ({ balanceFiltros: { ...s.balanceFiltros, ...patch } })),
}));
