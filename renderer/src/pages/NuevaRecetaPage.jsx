// src/pages/NuevaRecetaPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import ComboSelect from "../components/ComboSelect";
import { toast } from "../components/Toast";

function normalizeQuarter(value) {
  const s = String(value ?? "").trim();
  if (s === "" || s === "-") return s;
  const n = Number(s.replace(",", "."));
  if (Number.isNaN(n)) return "";
  const rounded = Math.round(n / 0.25) * 0.25;
  const result = (Math.round(rounded * 100) / 100).toFixed(2);
  return Number(result) > 0 ? "+" + result : result;
}

function stepQuarter(current, delta) {
  const s = String(current ?? "").trim();
  const base = s === "" || s === "-" ? 0 : Number(s.replace(",", "."));
  const safeBase = Number.isNaN(base) ? 0 : base;
  const next = safeBase + delta;
  const rounded = Math.round(next / 0.25) * 0.25;
  const result = (Math.round(rounded * 100) / 100).toFixed(2);
  return Number(result) > 0 ? "+" + result : result;
}

function toNumberOrNull(v) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  if (Number.isNaN(n)) return NaN;
  return n;
}

function money(n) {
  const x = Number(n ?? 0);
  const safe = Number.isFinite(x) ? x : 0;
  return safe.toLocaleString("es-AR");
}

function precioVidrioPorMontaje(vidrio, montaje) {
  if (!vidrio) return 0;
  if (montaje === "CAL") {
    const final = Number(vidrio.precioCalFinal ?? 0);
    if (final > 0) return final;
    return Number(vidrio.precioCal ?? 0) || 0;
  }
  if (montaje === "RANURA") {
    const final = Number(vidrio.precioRanuraFinal ?? 0);
    if (final > 0) return final;
    return Number(vidrio.precioRanura ?? 0) || 0;
  }
  if (montaje === "PERFORADO") {
    const final = Number(vidrio.precioPerforadoFinal ?? 0);
    if (final > 0) return final;
    return Number(vidrio.precioPerforado ?? 0) || 0;
  }
  return 0;
}

function onlyDigits(s) {
  return String(s ?? "").replace(/\D+/g, "");
}

function formatThousandsARFromDigits(digits) {
  const d = onlyDigits(digits);
  if (!d) return "";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}



const PATOLOGIAS = [
  "Cataratas", "Glaucoma", "Degeneración macular", "Retinopatía diabética",
  "Astigmatismo", "Miopía", "Hipermetropía", "Presbicia",
  "Ojo seco", "Conjuntivitis alérgica", "Queratocono", "Otro",
];

const MEDIOS_PAGO = [
  { value: "EFECTIVO",      label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "BILLETERA",     label: "T. Créd./Déb. Billetera Virtual" },
  { value: "TARJETA_BANCO", label: "T. Créd./Déb. Banco" },
];

// Valor especial para "Ninguno" en vidrio
const VIDRIO_NINGUNO = "__ninguno__";

export default function NuevaRecetaPage() {
  const [loading, setLoading]   = useState(false);
  const [patients, setPatients] = useState([]);
  const [frames, setFrames]     = useState([]);
  const [vidrios, setVidrios]   = useState([]);
  const [laboratorios, setLaboratorios] = useState([]); // proveedores VIDRIOS

  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfg, setCfg]               = useState(null);

  const [medioPago, setMedioPago]     = useState("");
  const [sena, setSena]               = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [labProveedorId, setLabProveedorId] = useState(null); // id del proveedor seleccionado
  const [labOpen, setLabOpen]               = useState(false);

  const [ordenOpen, setOrdenOpen]   = useState(false);
  // Fecha de entrega sugerida = hoy
  const [ordenEntrega, setOrdenEntrega] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [ordenMsg, setOrdenMsg]         = useState("");
  const [ultimaReceta, setUltimaReceta] = useState(null);

  const [pacienteId, setPacienteId] = useState("");
  const [armazonId, setArmazonId]   = useState("");
  const [distancia, setDistancia]   = useState("");

  const [odEsf, setOdEsf] = useState("");
  const [odCil, setOdCil] = useState("");
  const [odEje, setOdEje] = useState("");
  const [oiEsf, setOiEsf] = useState("");
  const [oiCil, setOiCil] = useState("");
  const [oiEje, setOiEje] = useState("");

  const [distancia2, setDistancia2] = useState("");
  const [od2Esf, setOd2Esf] = useState("");
  const [od2Cil, setOd2Cil] = useState("");
  const [od2Eje, setOd2Eje] = useState("");
  const [oi2Esf, setOi2Esf] = useState("");
  const [oi2Cil, setOi2Cil] = useState("");
  const [oi2Eje, setOi2Eje] = useState("");

  const [tratamiento, setTratamiento] = useState("");
  const [formato, setFormato]         = useState("");
  const [dip, setDip]                 = useState("");

  const [montaje, setMontaje]   = useState("");
  const [vidrioId, setVidrioId] = useState("");

  const [fechaReceta, setFechaReceta] = useState("");

  const [doctor, setDoctor]                   = useState("");
  const [patologias, setPatologias]           = useState([]);
  const [patologiaQuery, setPatologiaQuery]   = useState("");
  const [patologiaOpen, setPatologiaOpen]     = useState(false);
  const [obs, setObs]                         = useState("");

  const [cuotasSel, setCuotasSel] = useState(1);

  // ── CAMBIO 6: total editable ──────────────────────────────────────────────
  const [totalOverride, setTotalOverride] = useState("");
  const [totalEditMode, setTotalEditMode] = useState(false);

  // ── PESTAÑA FOTO ──────────────────────────────────────────────────────────
  const [tabModo, setTabModo] = useState("manual"); // "manual" | "foto"
  const [camStream, setCamStream] = useState(null);
  const [camStep, setCamStep] = useState("camera"); // "camera" | "preview"
  const [fotosCapturadas, setFotosCapturadas] = useState([]);
  const [currentFoto, setCurrentFoto] = useState(null);
  const [currentObs, setCurrentObs] = useState("");
  const [errorCam, setErrorCam] = useState("");
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const videoRef = useRef(null);
  const camStreamRef = useRef(null);

  function showToast(msg, type = "info") {
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else toast.info(msg);
  }

  const [errors, setErrors] = useState({
    pacienteId: "", armazonId: "", distancia: "",
    odEsf: "", odCil: "", odEje: "",
    oiEsf: "", oiCil: "", oiEje: "",
    tratamiento: "", formato: "", dip: "",
    sena: "", montaje: "", medioPago: "",
  });

  function clearError(key) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  async function loadConfig() {
    setCfgLoading(true);
    try {
      const c = await window.api.getConfig();
      setCfg(c || null);
    } catch (e) {
      console.error(e);
      setCfg(null);
    } finally {
      setCfgLoading(false);
    }
  }

  async function loadAll() {
    try {
      setLoading(true);
      const [p, f, v, labs] = await Promise.all([
        window.api.listPatients(),
        window.api.listFrames(),
        window.api.listVidrios(),
        window.api.listSuppliers("VIDRIOS"),
      ]);
      setPatients(Array.isArray(p) ? p : []);
      setFrames(Array.isArray(f) ? f : []);
      setVidrios(Array.isArray(v) ? v : []);
      setLaboratorios(Array.isArray(labs) ? labs : []);
    } catch (e) {
      showToast(e?.message || "Error cargando datos", "error");
    } finally {
      setLoading(false);
    }
  }

  const didInitRef = useRef(false);

  useEffect(() => {
    (async () => {
      await Promise.all([loadAll(), loadConfig()]);
      didInitRef.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (!didInitRef.current) return;
      loadAll();
      loadConfig();
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    const onFocus      = () => { refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpieza de cámara al desmontar
  useEffect(() => () => {
    if (camStreamRef.current) camStreamRef.current.getTracks().forEach((t) => t.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Iniciar/detener cámara al cambiar de pestaña
  useEffect(() => {
    if (tabModo === "foto") {
      setCamStep("camera");
      setFotosCapturadas([]);
      setCurrentFoto(null);
      setCurrentObs("");
      setErrorCam("");
      setTimeout(iniciarCamara, 120);
    } else {
      detenerCamara();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabModo]);

  // Teclado: Enter/Space captura foto
  useEffect(() => {
    function onKey(e) {
      if (tabModo !== "foto" || camStep !== "camera" || !camStreamRef.current) return;
      if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); capturarFoto(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabModo, camStep]);

  const framesDisponibles = useMemo(() => frames.filter((x) => (x?.stock ?? 0) > 0), [frames]);

  // ── BUSCADOR PACIENTE ──────────────────────────────────────────────────────
  const [pacienteQuery, setPacienteQuery] = useState("");
  const [pacienteOpen, setPacienteOpen]   = useState(false);

  const pacientesFiltrados = useMemo(() => {
    const term = pacienteQuery.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((p) => {
      const nombre = (p.nombre || "").toLowerCase();
      const dni    = String(p.dni || "").toLowerCase();
      return nombre.includes(term) || dni.includes(term);
    });
  }, [pacienteQuery, patients]);

  const pacienteSeleccionado = useMemo(
    () => (!pacienteId ? null : patients.find((p) => String(p.id) === String(pacienteId)) || null),
    [pacienteId, patients]
  );

  function selectPaciente(p) {
    setPacienteId(String(p.id));
    setPacienteQuery(`${p.nombre}${p.dni ? ` (DNI ${p.dni})` : ""}`);
    setPacienteOpen(false);
    clearError("pacienteId");
  }

  // ── BUSCADOR ARMAZÓN ───────────────────────────────────────────────────────
  const [armazonQuery, setArmazonQuery] = useState("");
  const [armazonOpen, setArmazonOpen]   = useState(false);

  const armazonesFiltrados = useMemo(() => {
    const term = armazonQuery.trim().toLowerCase();
    if (!term) return framesDisponibles;
    return framesDisponibles.filter((f) => {
      const marca  = (f.marca  || "").toLowerCase();
      const modelo = (f.modelo || "").toLowerCase();
      const codigo = String(f.codigo || "").toLowerCase();
      return marca.includes(term) || modelo.includes(term) || codigo.includes(term);
    });
  }, [armazonQuery, framesDisponibles]);

  const armazonSeleccionado = useMemo(
    () => (!armazonId ? null : framesDisponibles.find((f) => String(f.id) === String(armazonId)) || null),
    [armazonId, framesDisponibles]
  );

  function selectArmazon(f) {
    setArmazonId(String(f.id));
    setArmazonQuery(
      `${f.marca} ${f.modelo}${f.codigo ? ` (Código ${f.codigo})` : ""} (stock: ${f.stock ?? 0})`
    );
    setArmazonOpen(false);
    clearError("armazonId");
  }

  // ── BUSCADOR VIDRIO ────────────────────────────────────────────────────────
  const [vidrioQuery, setVidrioQuery] = useState("");
  const [vidrioOpen, setVidrioOpen]   = useState(false);

  const vidriosFiltrados = useMemo(() => {
    const term = vidrioQuery.trim().toLowerCase();
    if (!term) return vidrios;
    return vidrios.filter((v) => {
      const nombre = (v.nombre      || "").toLowerCase();
      const desc   = (v.descripcion || "").toLowerCase();
      return nombre.includes(term) || desc.includes(term);
    });
  }, [vidrioQuery, vidrios]);

  const vidrioSeleccionado = useMemo(
    () => (!vidrioId || vidrioId === VIDRIO_NINGUNO ? null : vidrios.find((v) => String(v.id) === String(vidrioId)) || null),
    [vidrioId, vidrios]
  );

  function selectVidrio(v) {
    setVidrioId(String(v.id));
    setTratamiento(v.nombre);
    setVidrioQuery(`${v.nombre}${v.descripcion ? ` — ${v.descripcion}` : ""}`);
    setVidrioOpen(false);
    clearError("tratamiento");
  }

  // ── CAMBIO 4: selección Ninguno para vidrio ───────────────────────────────
  function selectVidrioNinguno() {
    setVidrioId(VIDRIO_NINGUNO);
    setTratamiento("Ninguno");
    setVidrioQuery("Ninguno");
    setVidrioOpen(false);
    clearError("tratamiento");
  }

  // ── PRECIOS ────────────────────────────────────────────────────────────────
  const precioArmazon = useMemo(() => {
    if (!armazonSeleccionado) return 0;
    // Usa precioFinal si está cargado, sino costo
    const pf = Number(armazonSeleccionado?.precioFinal ?? 0);
    if (pf > 0) return pf;
    const n = Number(armazonSeleccionado?.costo ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [armazonSeleccionado]);

  const precioVidrio = useMemo(() => {
    if (vidrioId === VIDRIO_NINGUNO || montaje === "NINGUNO") return 0;
    return precioVidrioPorMontaje(vidrioSeleccionado, montaje);
  }, [vidrioSeleccionado, vidrioId, montaje]);

  // Total automático (suma armazón + vidrio)
  const totalAuto = useMemo(() => (precioArmazon || 0) + (precioVidrio || 0), [precioArmazon, precioVidrio]);

  // ── CAMBIO 6: totalFinal respeta override si está activo ──────────────────
  const totalFinal = useMemo(() => {
    if (totalOverride !== "") {
      const n = Number(onlyDigits(totalOverride));
      return Number.isFinite(n) ? n : totalAuto;
    }
    return totalAuto;
  }, [totalOverride, totalAuto]);

  const seniaPct = useMemo(() => {
    const n = Number(cfg?.seniaPorcentaje ?? 30);
    return Number.isFinite(n) ? n : 30;
  }, [cfg]);

  const seniaSugerida = useMemo(() => {
    return Math.round(Number(totalFinal || 0) * (Number(seniaPct || 0) / 100));
  }, [totalFinal, seniaPct]);

  const descEfectivo      = Number(cfg?.descuentoEfectivo     ?? 0) || 0;
  const descDebito        = Number(cfg?.descuentoDebito        ?? 0) || 0;
  const descTransferencia = Number(cfg?.descuentoTransferencia ?? 0) || 0;

  const cuotasCredito = useMemo(() => {
    const arr = Array.isArray(cfg?.cuotasCredito) ? cfg.cuotasCredito : [];
    const cleaned = arr
      .map((x) => ({ cuotas: Number(x?.cuotas), recargoPct: Number(x?.recargoPct ?? 0) }))
      .filter((x) => Number.isInteger(x.cuotas) && x.cuotas > 0 && Number.isFinite(x.recargoPct))
      .sort((a, b) => a.cuotas - b.cuotas);
    return cleaned.length ? cleaned : [{ cuotas: 1, recargoPct: 0 }];
  }, [cfg]);

  useEffect(() => {
    const exists = cuotasCredito.some((x) => x.cuotas === Number(cuotasSel));
    if (!exists) setCuotasSel(cuotasCredito[0]?.cuotas ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuotasCredito]);

  const recargoSel = useMemo(() => {
    const row = cuotasCredito.find((x) => x.cuotas === Number(cuotasSel));
    return row ? Number(row.recargoPct ?? 0) : 0;
  }, [cuotasCredito, cuotasSel]);

  function applyDiscount(total, pct)  { return Math.round(Number(total||0) * (1 - Number(pct||0)/100)); }
  function applySurcharge(total, pct) { return Math.round(Number(total||0) * (1 + Number(pct||0)/100)); }

  const totalEfectivo      = useMemo(() => applyDiscount(totalFinal, descEfectivo),     [totalFinal, descEfectivo]);
  const totalBilletera     = useMemo(() => applyDiscount(totalFinal, descDebito),        [totalFinal, descDebito]);
  const totalTransferencia = useMemo(() => applyDiscount(totalFinal, descTransferencia), [totalFinal, descTransferencia]);
  const totalTarjetaBanco  = useMemo(() => applySurcharge(totalFinal, recargoSel),       [totalFinal, recargoSel]);

  const cuotaMensual = useMemo(() => {
    const c = Number(cuotasSel || 1);
    if (!Number.isFinite(c) || c <= 0) return 0;
    return Math.round(totalTarjetaBanco / c);
  }, [totalTarjetaBanco, cuotasSel]);

  const totalSegunMedio = useMemo(() => {
    if (medioPago === "EFECTIVO")      return totalEfectivo;
    if (medioPago === "TRANSFERENCIA") return totalTransferencia;
    if (medioPago === "BILLETERA")     return totalBilletera;
    if (medioPago === "TARJETA_BANCO") return totalTarjetaBanco;
    return totalFinal;
  }, [medioPago, totalEfectivo, totalBilletera, totalTransferencia, totalTarjetaBanco, totalFinal]);

  const senaNum = useMemo(() => {
    const n = Number(onlyDigits(sena));
    return Number.isFinite(n) ? n : 0;
  }, [sena]);

  const saldoRestante = useMemo(() => Math.max(0, totalSegunMedio - senaNum), [totalSegunMedio, senaNum]);
  const senaBloqueada  = medioPago === "TARJETA_BANCO";

  // ── CÁMARA ────────────────────────────────────────────────────────────────
  function detenerCamara() {
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }
    setCamStream(null);
  }

  async function iniciarCamara() {
    detenerCamara();
    setErrorCam("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCamStream(s);
      camStreamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
    } catch {
      setErrorCam("No se pudo acceder a la cámara. Verificá que esté conectada y con permiso.");
    }
  }

  function capturarFoto() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width  = v.videoWidth  || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
    setCurrentFoto(canvas.toDataURL("image/jpeg", 0.95));
    setCurrentObs("");
    setCamStep("preview");
    detenerCamara();
  }

  function repetirFoto() {
    setCurrentFoto(null);
    setCurrentObs("");
    setCamStep("camera");
    iniciarCamara();
  }

  function agregarOtraFoto() {
    setFotosCapturadas((prev) => [...prev, { foto: currentFoto, observaciones: currentObs }]);
    setCurrentFoto(null);
    setCurrentObs("");
    setCamStep("camera");
    iniciarCamara();
  }

  function usarEstaFoto() {
    if (!currentFoto) return;
    setFotosCapturadas((prev) => [...prev, { foto: currentFoto, observaciones: currentObs }]);
    setCurrentFoto(null);
    setCurrentObs("");
    detenerCamara();
    setCamStep("done");
  }

  // ── VALIDACIÓN ─────────────────────────────────────────────────────────────
  function validateForm() {
    const next = {
      pacienteId: "", armazonId: "", distancia: "",
      odEsf: "", odCil: "", odEje: "",
      oiEsf: "", oiCil: "", oiEje: "",
      tratamiento: "", formato: "", dip: "",
      sena: "", montaje: "", medioPago: "",
    };

    if (!pacienteId) next.pacienteId = "Seleccioná un paciente";
    if (!armazonId)  next.armazonId  = "Seleccioná un armazón con stock";
    if (!distancia)  next.distancia  = "Seleccioná el uso";
    if (!medioPago)  next.medioPago  = "Seleccioná el medio de pago";

    const vidrioOk  = vidrioId && (vidrioId === VIDRIO_NINGUNO || vidrioSeleccionado);
    const montajeOk = montaje  && (montaje  === "NINGUNO" || ["CAL","RANURA","PERFORADO"].includes(montaje));
    const formatoOk = formato  && (formato  === "NINGUNO" || ["MONOFOCAL","CONTACTO","BIFOCAL","MULTIFOCAL"].includes(formato));

    if (!vidrioOk)  next.tratamiento = "Seleccioná el color (vidrio)";
    if (!montajeOk) next.montaje     = "Seleccioná el montaje";
    if (!formatoOk) next.formato     = "Seleccioná formato";

    if (vidrioId && vidrioId !== VIDRIO_NINGUNO && montaje && montaje !== "NINGUNO") {
      const pv = precioVidrioPorMontaje(vidrioSeleccionado, montaje);
      if (!pv || pv <= 0) next.montaje = "Ese vidrio no tiene precio para ese montaje";
    }

    const odEsfN = toNumberOrNull(odEsf);
    const odCilN = toNumberOrNull(odCil);
    const oiEsfN = toNumberOrNull(oiEsf);
    const oiCilN = toNumberOrNull(oiCil);

    if (odEsfN !== null && Number.isNaN(odEsfN)) next.odEsf = "Esf OD inválido";
    else if (odEsfN !== null && (odEsfN < -25 || odEsfN > 25)) next.odEsf = "Esf OD fuera de rango (-25 a +25)";

    if (odCilN !== null && Number.isNaN(odCilN)) next.odCil = "Cil OD inválido";
    else if (odCilN !== null && (odCilN < -12 || odCilN > 12)) next.odCil = "Cil OD fuera de rango (-12 a +12)";

    if (oiEsfN !== null && Number.isNaN(oiEsfN)) next.oiEsf = "Esf OI inválido";
    else if (oiEsfN !== null && (oiEsfN < -25 || oiEsfN > 25)) next.oiEsf = "Esf OI fuera de rango (-25 a +25)";

    if (oiCilN !== null && Number.isNaN(oiCilN)) next.oiCil = "Cil OI inválido";
    else if (oiCilN !== null && (oiCilN < -12 || oiCilN > 12)) next.oiCil = "Cil OI fuera de rango (-12 a +12)";

    if (String(odEje ?? "").trim() !== "") {
      const n = Number(odEje);
      if (!Number.isInteger(n) || n < 0 || n > 180) next.odEje = "Eje OD debe ser 0-180°";
    }
    if (String(oiEje ?? "").trim() !== "") {
      const n = Number(oiEje);
      if (!Number.isInteger(n) || n < 0 || n > 180) next.oiEje = "Eje OI debe ser 0-180°";
    }
    if (String(dip ?? "").trim() !== "") {
      const n = toNumberOrNull(dip);
      if (Number.isNaN(n)) next.dip = "DIP inválido";
      else if (n !== null && (n < 40 || n > 80)) next.dip = "DIP inusual (esperado 40-80 mm)";
    }
    if (!senaBloqueada && String(sena ?? "").trim() !== "") {
      const n = Number(onlyDigits(sena));
      if (!Number.isFinite(n) || n < 0) next.sena = "Seña inválida";
    }

    setErrors(next);
    const hasErrors = Object.values(next).some((x) => x);
    if (hasErrors) {
      // Scroll al primer campo con error
      setTimeout(() => {
        const el = document.querySelector(".inputError");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      const errorCount = Object.values(next).filter((x) => x).length;
      toast.error(`Revisá ${errorCount} campo${errorCount > 1 ? "s" : ""} con error`);
    }
    return !hasErrors;
  }

  // ── ORDEN ──────────────────────────────────────────────────────────────────
  function copyOrden()  { try { navigator.clipboard.writeText(ordenMsg); showToast("Copiado."); } catch { showToast("No se pudo copiar"); } }
  function printOrden() {
    const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
    const nombre = ultimaReceta?.paciente || "Receta";
    const html = document.getElementById("printArea")?.innerHTML || "";
    window.api.printToPdf({ defaultName: `${nombre} - ${fecha}`, html });
  }
  function openWhatsApp() { window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(ordenMsg)}`, "_blank"); }
  function openWhatsAppLab() {
    const encoded = encodeURIComponent(ordenMsg);
    if (!ultimaReceta?.labTelefono) {
      window.open(`https://web.whatsapp.com/send?text=${encoded}`, "_blank");
      return;
    }
    const phone = String(ultimaReceta.labTelefono).replace(/\D/g, "");
    const waPhone = phone.startsWith("54") ? phone : `54${phone}`;
    window.open(`https://web.whatsapp.com/send?phone=${waPhone}&text=${encoded}`, "_blank");
  }

  function resetForm({ keepPaciente = false } = {}) {
    if (!keepPaciente) { setPacienteId(""); setPacienteQuery(""); }
    setArmazonId(""); setDistancia("");
    setOdEsf(""); setOdCil(""); setOdEje("");
    setOiEsf(""); setOiCil(""); setOiEje("");
    setDistancia2(""); setOd2Esf(""); setOd2Cil(""); setOd2Eje(""); setOi2Esf(""); setOi2Cil(""); setOi2Eje("");
    setTratamiento(""); setFormato(""); setDip("");
    setFechaReceta(""); setDoctor(""); setPatologias([]); setPatologiaQuery(""); setPatologiaOpen(false); setObs("");
    setSena(""); setLaboratorio(""); setLabProveedorId(null); setLabOpen(false);
    const hoy = new Date();
    setOrdenEntrega(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`);
    setArmazonQuery("");
    setMontaje(""); setVidrioId(""); setVidrioQuery("");
    setMedioPago(""); setCuotasSel(1);
    setTotalOverride(""); setTotalEditMode(false);
    setErrors({
      pacienteId: "", armazonId: "", distancia: "",
      odEsf: "", odCil: "", odEje: "",
      oiEsf: "", oiCil: "", oiEje: "",
      tratamiento: "", formato: "", dip: "",
      sena: "", montaje: "", medioPago: "",
    });
  }

  async function onSave(e) {
    e.preventDefault();
    const ok = validateForm();
    if (!ok) return;

    try {
      await window.api.createRecipe({
        pacienteId: Number(pacienteId),
        armazonId:  Number(armazonId),
        distancia,
        odEsf, odCil, odEje,
        oiEsf, oiCil, oiEje,
        distancia2: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? distancia2 : null,
        od2Esf: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? od2Esf : null,
        od2Cil: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? od2Cil : null,
        od2Eje: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? od2Eje : null,
        oi2Esf: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? oi2Esf : null,
        oi2Cil: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? oi2Cil : null,
        oi2Eje: (formato === "BIFOCAL" || formato === "MULTIFOCAL") ? oi2Eje : null,
        tratamiento, formato, dip,
        fechaReceta: fechaReceta || null,
        doctor, patologia: patologias.join(", ") || null, obs,
        sena:       senaBloqueada ? null : onlyDigits(sena) || null,
        laboratorio,
        vidrioId:   (vidrioId && vidrioId !== VIDRIO_NINGUNO) ? Number(vidrioId) : null,
        montaje:    montaje === "NINGUNO" ? null : montaje,
        precioVidrio:  Number(precioVidrio  || 0),
        precioArmazon: Number(precioArmazon || 0),
        total:         Number(totalSegunMedio || 0),
        metodoPago:    medioPago || null,
        estadoPago: (() => {
          if (medioPago === "TARJETA_BANCO" || medioPago === "BILLETERA") return "PAGADO";
          const s = Number(onlyDigits(sena) || 0);
          if (s > 0) return "PARCIAL";
          return "PAGADO";
        })(),
        montoPagado: (() => {
          if (medioPago === "TARJETA_BANCO" || medioPago === "BILLETERA") return null;
          const s = Number(onlyDigits(sena) || 0);
          return s > 0 ? s : null;
        })(),
        entregaFecha: (() => {
          // SOL + pago completo → entregado en el momento, no necesita fecha de entrega
          const esSol = distancia === "SOL";
          const pagaCompleto = medioPago === "TARJETA_BANCO" || medioPago === "BILLETERA" ||
            Number(onlyDigits(sena) || 0) === 0;
          if (esSol && pagaCompleto) return null;
          return ordenEntrega || null;
        })(),
        entregada: (() => {
          const esSol = distancia === "SOL";
          const pagaCompleto = medioPago === "TARJETA_BANCO" || medioPago === "BILLETERA" ||
            Number(onlyDigits(sena) || 0) === 0;
          return esSol && pagaCompleto;
        })(),
      });

      showToast("Receta guardada. Se descontó 1 del stock del armazón.", "success");

      const medioPagoLabel = MEDIOS_PAGO.find((m) => m.value === medioPago)?.label || medioPago || "-";

      const data = {
        paciente: pacienteSeleccionado?.nombre || "",
        dni:      pacienteSeleccionado?.dni    || "",
        armazon:  armazonSeleccionado
          ? `${armazonSeleccionado.marca} ${armazonSeleccionado.modelo}${armazonSeleccionado.codigo ? ` (Cod ${armazonSeleccionado.codigo})` : ""}`
          : "",
        vidrio: tratamiento || "",
        montaje, formato,
        uso: distancia,
        od: { esf: odEsf, cil: odCil, eje: odEje },
        oi: { esf: oiEsf, cil: oiCil, eje: oiEje },
        dip, obs, laboratorio,
        labTelefono: laboratorios.find((l) => l.id === labProveedorId)?.telefono || null,
        entregaFecha: ordenEntrega || "",
        precioArmazon, precioVidrio,
        totalFinal:    totalSegunMedio,
        medioPago:     medioPagoLabel,
        sena:          senaBloqueada ? null : onlyDigits(sena) || null,
        saldoRestante: senaBloqueada ? null : saldoRestante,
        cuotas:        medioPago === "TARJETA_BANCO" ? cuotasSel    : null,
        cuotaMensual:  medioPago === "TARJETA_BANCO" ? cuotaMensual : null,
      };

      const msg =
        `ORDEN DE LABORATORIO\n` +
        `Paciente: ${data.paciente}${data.dni ? ` (DNI ${data.dni})` : ""}\n` +
        `Armazón: ${data.armazon}\n` +
        `Vidrio/Color: ${data.vidrio}\n` +
        `Montaje: ${data.montaje}\n` +
        `Formato: ${data.formato}\n` +
        `Uso: ${data.uso}\n\n` +
        `OD: ESF ${data.od.esf || "-"}  CIL ${data.od.cil || "-"}  EJE ${data.od.eje || "-"}\n` +
        `OI: ESF ${data.oi.esf || "-"}  CIL ${data.oi.cil || "-"}  EJE ${data.oi.eje || "-"}\n` +
        `DIP: ${data.dip || "-"}\n\n` +
        `Obs: ${data.obs || "-"}\n` +
        `Entrega: ${data.entregaFecha || "-"}\n` +
        `Laboratorio: ${data.laboratorio || "-"}\n`;

      setUltimaReceta(data);
      setOrdenMsg(msg);
      setOrdenOpen(true);
      resetForm();
      await loadAll();
    } catch (e2) {
      showToast(e2?.message || "Error guardando receta", "error");
    }
  }

  // ── VALIDACIÓN PESTAÑA FOTO ────────────────────────────────────────────────
  function validateFormFoto() {
    const next = {
      pacienteId: "", armazonId: "", distancia: "",
      odEsf: "", odCil: "", odEje: "",
      oiEsf: "", oiCil: "", oiEje: "",
      tratamiento: "", formato: "", dip: "",
      sena: "", montaje: "", medioPago: "",
    };
    if (!pacienteId) next.pacienteId = "Seleccioná un paciente";
    if (!armazonId)  next.armazonId  = "Seleccioná un armazón con stock";
    if (!medioPago)  next.medioPago  = "Seleccioná el medio de pago";
    const vidrioOk  = vidrioId && (vidrioId === VIDRIO_NINGUNO || vidrioSeleccionado);
    const montajeOk = montaje  && (montaje  === "NINGUNO" || ["CAL","RANURA","PERFORADO"].includes(montaje));
    if (!vidrioOk)  next.tratamiento = "Seleccioná el color (vidrio)";
    if (!montajeOk) next.montaje     = "Seleccioná el montaje";
    if (vidrioId && vidrioId !== VIDRIO_NINGUNO && montaje && montaje !== "NINGUNO") {
      const pv = precioVidrioPorMontaje(vidrioSeleccionado, montaje);
      if (!pv || pv <= 0) next.montaje = "Ese vidrio no tiene precio para ese montaje";
    }
    if (String(dip ?? "").trim() !== "") {
      const n = toNumberOrNull(dip);
      if (Number.isNaN(n)) next.dip = "DIP inválido";
    }
    if (!senaBloqueada && String(sena ?? "").trim() !== "") {
      const n = Number(onlyDigits(sena));
      if (!Number.isFinite(n) || n < 0) next.sena = "Seña inválida";
    }
    setErrors(next);
    return Object.values(next).every((x) => !x);
  }

  async function onSaveFoto(e) {
    e.preventDefault();
    const todasFotos = currentFoto
      ? [...fotosCapturadas, { foto: currentFoto, observaciones: currentObs }]
      : fotosCapturadas;
    if (todasFotos.length === 0) {
      showToast("Sacá al menos una foto de la receta antes de guardar");
      return;
    }
    const ok = validateFormFoto();
    if (!ok) return;
    setGuardandoFoto(true);
    try {
      await window.api.createRecipe({
        pacienteId: Number(pacienteId),
        armazonId:  Number(armazonId),
        distancia:  null,
        odEsf: null, odCil: null, odEje: null,
        oiEsf: null, oiCil: null, oiEje: null,
        tratamiento, formato: null, dip,
        fechaReceta: fechaReceta || null,
        doctor, patologia: patologias.join(", ") || null, obs,
        sena:       senaBloqueada ? null : onlyDigits(sena) || null,
        laboratorio,
        vidrioId:   (vidrioId && vidrioId !== VIDRIO_NINGUNO) ? Number(vidrioId) : null,
        montaje:    montaje === "NINGUNO" ? null : montaje,
        precioVidrio:  Number(precioVidrio  || 0),
        precioArmazon: Number(precioArmazon || 0),
        total:         Number(totalSegunMedio || 0),
        metodoPago:    medioPago || null,
        estadoPago: (() => {
          if (medioPago === "TARJETA_BANCO" || medioPago === "BILLETERA") return "PAGADO";
          const s = Number(onlyDigits(sena) || 0);
          if (s > 0) return "PARCIAL";
          return "PAGADO";
        })(),
        montoPagado: (() => {
          if (medioPago === "TARJETA_BANCO" || medioPago === "BILLETERA") return null;
          const s = Number(onlyDigits(sena) || 0);
          return s > 0 ? s : null;
        })(),
        entregaFecha: ordenEntrega || null,
        entregada: false,
        fotos: todasFotos,
      });

      showToast("Receta guardada con fotos.", "success");

      const medioPagoLabel = MEDIOS_PAGO.find((m) => m.value === medioPago)?.label || medioPago || "-";
      const data = {
        paciente:     pacienteSeleccionado?.nombre || "",
        dni:          pacienteSeleccionado?.dni    || "",
        armazon:      armazonSeleccionado
          ? `${armazonSeleccionado.marca} ${armazonSeleccionado.modelo}${armazonSeleccionado.codigo ? ` (Cod ${armazonSeleccionado.codigo})` : ""}`
          : "",
        vidrio:       tratamiento || "",
        montaje, formato,
        uso:          distancia,
        od:           { esf: null, cil: null, eje: null },
        oi:           { esf: null, cil: null, eje: null },
        dip, obs, laboratorio,
        labTelefono:  laboratorios.find((l) => l.id === labProveedorId)?.telefono || null,
        entregaFecha: ordenEntrega || "",
        precioArmazon, precioVidrio,
        totalFinal:   totalSegunMedio,
        medioPago:    medioPagoLabel,
        sena:         senaBloqueada ? null : onlyDigits(sena) || null,
        saldoRestante: senaBloqueada ? null : saldoRestante,
        cuotas:       medioPago === "TARJETA_BANCO" ? cuotasSel    : null,
        cuotaMensual: medioPago === "TARJETA_BANCO" ? cuotaMensual : null,
      };

      const msg =
        `ORDEN DE LABORATORIO\n` +
        `Paciente: ${data.paciente}${data.dni ? ` (DNI ${data.dni})` : ""}\n` +
        `Armazón: ${data.armazon}\n` +
        `Vidrio/Color: ${data.vidrio}\n` +
        `Montaje: ${data.montaje}\n` +
        `Formato: ${data.formato}\n` +
        `Uso: ${data.uso}\n\n` +
        `DIP: ${data.dip || "-"}\n\n` +
        `Obs: ${data.obs || "-"}\n` +
        `Entrega: ${data.entregaFecha || "-"}\n` +
        `Laboratorio: ${data.laboratorio || "-"}\n`;

      setUltimaReceta(data);
      setOrdenMsg(msg);
      setOrdenOpen(true);

      detenerCamara();
      setCamStep("camera");
      setFotosCapturadas([]);
      setCurrentFoto(null);
      setCurrentObs("");
      resetForm();
      await loadAll();
    } catch (e2) {
      showToast(e2?.message || "Error guardando receta", "error");
    } finally {
      setGuardandoFoto(false);
    }
  }

  useEffect(() => {
    if (!patologiaOpen) return;
    const handler = (e) => { if (!e.target.closest(".patologiaDropdownRef")) setPatologiaOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [patologiaOpen]);

  const dropdownStyle = { maxHeight: 220, overflowY: "auto" };

  return (
    <div className="page">
      <h2>Nueva receta</h2>

      <section className="card">
        <div className="rowBetween">
          <h3>Crear receta</h3>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
            {loading || cfgLoading ? "Actualizando..." : "\u00A0"}
          </div>
        </div>

        <form onSubmit={tabModo === "manual" ? onSave : onSaveFoto} className="form">

          {/* ── PACIENTE ── */}
          <label className="field" style={{ position: "relative" }}>
            <span>Paciente *</span>
            <input
              className={errors.pacienteId ? "inputError" : ""}
              value={
                pacienteOpen
                  ? pacienteQuery
                  : pacienteSeleccionado
                  ? `${pacienteSeleccionado.nombre}${pacienteSeleccionado.dni ? ` (DNI ${pacienteSeleccionado.dni})` : ""}`
                  : pacienteQuery
              }
              placeholder="Escribí nombre o DNI..."
              onFocus={() => setPacienteOpen(true)}
              onChange={(e) => { setPacienteQuery(e.target.value); setPacienteId(""); setPacienteOpen(true); clearError("pacienteId"); }}
              onBlur={() => setTimeout(() => setPacienteOpen(false), 120)}
            />
            {pacienteOpen && (
              <div className="comboDropdown" style={dropdownStyle}>
                {pacientesFiltrados.length === 0
                  ? <div className="comboEmpty">Sin resultados</div>
                  : pacientesFiltrados.map((p) => (
                    <button type="button" key={p.id} className="comboItem"
                      onMouseDown={(e) => e.preventDefault()} onClick={() => selectPaciente(p)}>
                      <div style={{ fontWeight: 900 }}>{p.nombre}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{p.dni ? `DNI ${p.dni}` : "Sin DNI"}</div>
                    </button>
                  ))
                }
              </div>
            )}
            <div className="fieldErrorSlot">{errors.pacienteId || "\u00A0"}</div>
          </label>

          {/* ── MODO DE CARGA ── */}
          {pacienteId && (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button type="button"
                className={tabModo === "manual" ? "pillBtn active" : "pillBtn"}
                onClick={() => setTabModo("manual")}>
                Carga manual
              </button>
              <button type="button"
                className={tabModo === "foto" ? "pillBtn active" : "pillBtn"}
                onClick={() => setTabModo("foto")}>
                Subir foto
              </button>
            </div>
          )}

          {/* ── SECCIÓN CÁMARA (solo pestaña foto) ── */}
          {tabModo === "foto" && (
            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ margin: "0 0 10px" }}>Fotos de la receta</h4>

              {fotosCapturadas.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {fotosCapturadas.map((f, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={f.foto} alt={`Foto ${i + 1}`}
                        style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, border: "2px solid var(--green-2)" }} />
                      <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 10, color: "#fff", fontWeight: 700, textShadow: "0 1px 3px #000" }}>{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}

              {errorCam ? (
                <div>
                  <p style={{ color: "#b91c1c", fontSize: 13, margin: "0 0 14px" }}>{errorCam}</p>
                  <button type="button" className="btn" onClick={iniciarCamara}>Reintentar</button>
                </div>
              ) : camStep === "camera" ? (
                <div>
                  <video ref={videoRef} className="webcamVideo" autoPlay playsInline muted />
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, justifyContent: "flex-end" }}>
                    <button type="button" className="btnGhost" style={{ fontSize: 12, padding: "6px 12px" }}
                      onClick={iniciarCamara} title="Refrescar cámara si se pone negra">
                      ↺ Refrescar
                    </button>
                    <button type="button" className="btn" onClick={capturarFoto} disabled={!camStream}>
                      Capturar foto
                      {camStream && <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 6 }}>(Enter / Space)</span>}
                    </button>
                  </div>
                </div>
              ) : camStep === "preview" ? (
                <div>
                  <img src={currentFoto} alt="Captura" className="capturaPreview" />
                  <div className="field" style={{ marginTop: 12 }}>
                    <span>Observaciones de esta foto</span>
                    <input
                      type="text"
                      value={currentObs}
                      onChange={(e) => setCurrentObs(e.target.value)}
                      placeholder="Ej: Frente, reverso..."
                      style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }}
                      autoFocus
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button type="button" className="btnGhost" onClick={repetirFoto}>Repetir foto</button>
                    <button type="button" className="btn primary" style={{ width: "auto" }} onClick={usarEstaFoto}>Usar esta foto</button>
                    <button type="button" className="btnGhost" onClick={agregarOtraFoto}>+ Agregar otra foto</button>
                  </div>
                </div>
              ) : camStep === "done" ? (
                <div>
                  <p style={{ color: "#0b7a55", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                    ✓ {fotosCapturadas.length} foto{fotosCapturadas.length !== 1 ? "s" : ""} lista{fotosCapturadas.length !== 1 ? "s" : ""} para guardar
                  </p>
                  <button type="button" className="btnGhost" onClick={() => { setCamStep("camera"); setTimeout(iniciarCamara, 120); }}>
                    + Agregar otra foto
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* ── ARMAZÓN ── */}
          <label className="field" style={{ position: "relative" }}>
            <span>Armazón (solo con stock) *</span>
            <input
              className={errors.armazonId ? "inputError" : ""}
              value={
                armazonOpen
                  ? armazonQuery
                  : armazonSeleccionado
                  ? `${armazonSeleccionado.marca} ${armazonSeleccionado.modelo}${armazonSeleccionado.codigo ? ` (Código ${armazonSeleccionado.codigo})` : ""} (stock: ${armazonSeleccionado.stock ?? 0})`
                  : armazonQuery
              }
              placeholder="Escribí marca / modelo / código..."
              onFocus={() => setArmazonOpen(true)}
              onChange={(e) => { setArmazonQuery(e.target.value); setArmazonId(""); setArmazonOpen(true); clearError("armazonId"); }}
              onBlur={() => setTimeout(() => setArmazonOpen(false), 120)}
            />
            {armazonOpen && (
              <div className="comboDropdown" style={dropdownStyle}>
                {armazonesFiltrados.length === 0
                  ? <div className="comboEmpty">Sin resultados</div>
                  : armazonesFiltrados.map((f) => (
                    <button type="button" key={f.id} className="comboItem"
                      onMouseDown={(e) => e.preventDefault()} onClick={() => selectArmazon(f)}>
                      <div style={{ fontWeight: 900 }}>{f.marca} {f.modelo}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>
                        {f.codigo ? `Código ${f.codigo}` : "Sin código"} — stock: {f.stock ?? 0}
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
            <div className="fieldErrorSlot">{errors.armazonId || "\u00A0"}</div>
          </label>

          {/* ── FORMATO + USO (solo carga manual) ── */}
          {tabModo === "manual" && <>
            <label className="field">
              <span>Formato *</span>
              <ComboSelect
                className={errors.formato ? "inputError" : ""}
                value={formato}
                onChange={(v) => {
                  setFormato(v);
                  clearError("formato");
                  if (v !== "BIFOCAL" && v !== "MULTIFOCAL") {
                    setDistancia2(""); setOd2Esf(""); setOd2Cil(""); setOd2Eje("");
                    setOi2Esf(""); setOi2Cil(""); setOi2Eje("");
                  }
                }}
                options={[
                  { value: "", label: "Seleccionar..." },
                  { value: "NINGUNO", label: "Ninguno" },
                  { value: "MONOFOCAL", label: "Monofocal" },
                  { value: "CONTACTO", label: "Lentes de contacto" },
                  { value: "BIFOCAL", label: "Bifocal" },
                  { value: "MULTIFOCAL", label: "Multifocal" },
                ]}
              />
              <div className="fieldErrorSlot">{errors.formato || "\u00A0"}</div>
            </label>

            {(formato === "BIFOCAL" || formato === "MULTIFOCAL") && (
              <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 13, color: "var(--muted)" }}>Primer uso</p>
            )}

            <label className="field">
              <span>Uso *</span>
              <ComboSelect
                className={errors.distancia ? "inputError" : ""}
                value={distancia}
                onChange={(v) => {
                  setDistancia(v);
                  clearError("distancia");
                  if (v === "SOL") {
                    setVidrioId(VIDRIO_NINGUNO); setTratamiento("Ninguno"); setVidrioQuery("Ninguno");
                    setFormato("NINGUNO");
                    setMontaje("NINGUNO");
                  }
                }}
                options={[
                  { value: "", label: "Seleccionar..." },
                  { value: "LEJOS", label: "Lejos" },
                  { value: "CERCA", label: "Cerca" },
                  { value: "INTERMEDIA", label: "Intermedia" },
                  { value: "LENTE_CONTACTO", label: "Lente de contacto" },
                  { value: "SOL", label: "Sol" },
                ].filter((o) => !o.value || o.value !== distancia2)}
              />
              <div className="fieldErrorSlot">{errors.distancia || "\u00A0"}</div>
            </label>
          </>}

          {/* ── GRADUACIÓN (solo carga manual) ── */}
          {tabModo === "manual" && <div className="grid2" style={{ alignItems: "stretch" }}>
            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ margin: "0 0 10px" }}>Ojo derecho (OD)</h4>
              <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span>Esférico</span>
                  <div className="stepper">
                    <button type="button" className="stepBtn" onClick={() => { setOdEsf(stepQuarter(odEsf, -0.25)); clearError("odEsf"); }}>-</button>
                    <input className={errors.odEsf ? "inputError" : ""} value={odEsf}
                      onChange={(e) => { setOdEsf(e.target.value); clearError("odEsf"); }}
                      onBlur={() => { const s = String(odEsf ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setErrors(p=>({...p,odEsf:"Esf OD inválido"})); else setOdEsf(normalizeQuarter(odEsf)); }}
                      placeholder="Ej: -1.25" inputMode="decimal" />
                    <button type="button" className="stepBtn" onClick={() => { setOdEsf(stepQuarter(odEsf, +0.25)); clearError("odEsf"); }}>+</button>
                  </div>
                  <div className="fieldErrorSlot">{errors.odEsf || "\u00A0"}</div>
                </label>
                <label className="field">
                  <span>Cilíndrico</span>
                  <div className="stepper">
                    <button type="button" className="stepBtn" onClick={() => { setOdCil(stepQuarter(odCil, -0.25)); clearError("odCil"); }}>-</button>
                    <input className={errors.odCil ? "inputError" : ""} value={odCil}
                      onChange={(e) => { setOdCil(e.target.value); clearError("odCil"); }}
                      onBlur={() => { const s = String(odCil ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setErrors(p=>({...p,odCil:"Cil OD inválido"})); else setOdCil(normalizeQuarter(odCil)); }}
                      placeholder="Ej: -0.50" inputMode="decimal" />
                    <button type="button" className="stepBtn" onClick={() => { setOdCil(stepQuarter(odCil, +0.25)); clearError("odCil"); }}>+</button>
                  </div>
                  <div className="fieldErrorSlot">{errors.odCil || "\u00A0"}</div>
                </label>
              </div>
              <label className="field">
                <span>Eje (-360 a 360)</span>
                <input className={errors.odEje ? "inputError" : ""} value={odEje}
                  onChange={(e) => { setOdEje(e.target.value); clearError("odEje"); }}
                  placeholder="Ej: 90" inputMode="numeric" />
                <div className="fieldErrorSlot">{errors.odEje || "\u00A0"}</div>
              </label>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ margin: "0 0 10px" }}>Ojo izquierdo (OI)</h4>
              <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label className="field">
                  <span>Esférico</span>
                  <div className="stepper">
                    <button type="button" className="stepBtn" onClick={() => { setOiEsf(stepQuarter(oiEsf, -0.25)); clearError("oiEsf"); }}>-</button>
                    <input className={errors.oiEsf ? "inputError" : ""} value={oiEsf}
                      onChange={(e) => { setOiEsf(e.target.value); clearError("oiEsf"); }}
                      onBlur={() => { const s = String(oiEsf ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setErrors(p=>({...p,oiEsf:"Esf OI inválido"})); else setOiEsf(normalizeQuarter(oiEsf)); }}
                      placeholder="Ej: -1.00" inputMode="decimal" />
                    <button type="button" className="stepBtn" onClick={() => { setOiEsf(stepQuarter(oiEsf, +0.25)); clearError("oiEsf"); }}>+</button>
                  </div>
                  <div className="fieldErrorSlot">{errors.oiEsf || "\u00A0"}</div>
                </label>
                <label className="field">
                  <span>Cilíndrico</span>
                  <div className="stepper">
                    <button type="button" className="stepBtn" onClick={() => { setOiCil(stepQuarter(oiCil, -0.25)); clearError("oiCil"); }}>-</button>
                    <input className={errors.oiCil ? "inputError" : ""} value={oiCil}
                      onChange={(e) => { setOiCil(e.target.value); clearError("oiCil"); }}
                      onBlur={() => { const s = String(oiCil ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (Number.isNaN(n)) setErrors(p=>({...p,oiCil:"Cil OI inválido"})); else setOiCil(normalizeQuarter(oiCil)); }}
                      placeholder="Ej: -0.75" inputMode="decimal" />
                    <button type="button" className="stepBtn" onClick={() => { setOiCil(stepQuarter(oiCil, +0.25)); clearError("oiCil"); }}>+</button>
                  </div>
                  <div className="fieldErrorSlot">{errors.oiCil || "\u00A0"}</div>
                </label>
              </div>
              <label className="field">
                <span>Eje (-360 a 360)</span>
                <input className={errors.oiEje ? "inputError" : ""} value={oiEje}
                  onChange={(e) => { setOiEje(e.target.value); clearError("oiEje"); }}
                  placeholder="Ej: 80" inputMode="numeric" />
                <div className="fieldErrorSlot">{errors.oiEje || "\u00A0"}</div>
              </label>
            </div>
          </div>}

          {/* ── SEGUNDO USO (solo carga manual + bifocal/multifocal) ── */}
          {tabModo === "manual" && (formato === "BIFOCAL" || formato === "MULTIFOCAL") && (<>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
              <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: "var(--muted)" }}>Segundo uso</p>
            </div>
            <label className="field">
              <span>Uso 2 *</span>
              <ComboSelect
                value={distancia2}
                onChange={(v) => setDistancia2(v)}
                options={[
                  { value: "", label: "Seleccionar..." },
                  { value: "LEJOS", label: "Lejos" },
                  { value: "CERCA", label: "Cerca" },
                  { value: "INTERMEDIA", label: "Intermedia" },
                  { value: "LENTE_CONTACTO", label: "Lente de contacto" },
                ].filter((o) => !o.value || o.value !== distancia)}
              />
            </label>
            <div className="grid2" style={{ alignItems: "stretch" }}>
              <div className="card" style={{ padding: 12 }}>
                <h4 style={{ margin: "0 0 10px" }}>Ojo derecho 2 (OD)</h4>
                <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="field">
                    <span>Esférico</span>
                    <div className="stepper">
                      <button type="button" className="stepBtn" onClick={() => setOd2Esf(stepQuarter(od2Esf, -0.25))}>-</button>
                      <input value={od2Esf} onChange={(e) => setOd2Esf(e.target.value)}
                        onBlur={() => { const s = String(od2Esf ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (!Number.isNaN(n)) setOd2Esf(normalizeQuarter(od2Esf)); }}
                        placeholder="Ej: -1.25" inputMode="decimal" />
                      <button type="button" className="stepBtn" onClick={() => setOd2Esf(stepQuarter(od2Esf, +0.25))}>+</button>
                    </div>
                  </label>
                  <label className="field">
                    <span>Cilíndrico</span>
                    <div className="stepper">
                      <button type="button" className="stepBtn" onClick={() => setOd2Cil(stepQuarter(od2Cil, -0.25))}>-</button>
                      <input value={od2Cil} onChange={(e) => setOd2Cil(e.target.value)}
                        onBlur={() => { const s = String(od2Cil ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (!Number.isNaN(n)) setOd2Cil(normalizeQuarter(od2Cil)); }}
                        placeholder="Ej: -0.50" inputMode="decimal" />
                      <button type="button" className="stepBtn" onClick={() => setOd2Cil(stepQuarter(od2Cil, +0.25))}>+</button>
                    </div>
                  </label>
                </div>
                <label className="field">
                  <span>Eje (-360 a 360)</span>
                  <input value={od2Eje} onChange={(e) => setOd2Eje(e.target.value)} placeholder="Ej: 90" inputMode="numeric" />
                </label>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <h4 style={{ margin: "0 0 10px" }}>Ojo izquierdo 2 (OI)</h4>
                <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="field">
                    <span>Esférico</span>
                    <div className="stepper">
                      <button type="button" className="stepBtn" onClick={() => setOi2Esf(stepQuarter(oi2Esf, -0.25))}>-</button>
                      <input value={oi2Esf} onChange={(e) => setOi2Esf(e.target.value)}
                        onBlur={() => { const s = String(oi2Esf ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (!Number.isNaN(n)) setOi2Esf(normalizeQuarter(oi2Esf)); }}
                        placeholder="Ej: -1.00" inputMode="decimal" />
                      <button type="button" className="stepBtn" onClick={() => setOi2Esf(stepQuarter(oi2Esf, +0.25))}>+</button>
                    </div>
                  </label>
                  <label className="field">
                    <span>Cilíndrico</span>
                    <div className="stepper">
                      <button type="button" className="stepBtn" onClick={() => setOi2Cil(stepQuarter(oi2Cil, -0.25))}>-</button>
                      <input value={oi2Cil} onChange={(e) => setOi2Cil(e.target.value)}
                        onBlur={() => { const s = String(oi2Cil ?? "").trim(); if (!s) return; const n = Number(s.replace(",",".")); if (!Number.isNaN(n)) setOi2Cil(normalizeQuarter(oi2Cil)); }}
                        placeholder="Ej: -0.75" inputMode="decimal" />
                      <button type="button" className="stepBtn" onClick={() => setOi2Cil(stepQuarter(oi2Cil, +0.25))}>+</button>
                    </div>
                  </label>
                </div>
                <label className="field">
                  <span>Eje (-360 a 360)</span>
                  <input value={oi2Eje} onChange={(e) => setOi2Eje(e.target.value)} placeholder="Ej: 80" inputMode="numeric" />
                </label>
              </div>
            </div>
          </>)}

          {/* ── LENTE + MÉDICO ── */}
          <div className="grid2" style={{ alignItems: "stretch" }}>
            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ margin: "0 0 10px" }}>Opciones de lente</h4>

              <div className="grid2">
                {/* ── CAMBIO 4: Color/Vidrio con Ninguno ── */}
                <label className="field" style={{ position: "relative" }}>
                  <span>Color / Vidrio *</span>
                  <input
                    className={errors.tratamiento ? "inputError" : ""}
                    value={
                      vidrioOpen
                        ? vidrioQuery
                        : vidrioId === VIDRIO_NINGUNO
                        ? "Ninguno"
                        : vidrioSeleccionado
                        ? `${vidrioSeleccionado.nombre}${vidrioSeleccionado.descripcion ? ` — ${vidrioSeleccionado.descripcion}` : ""}`
                        : vidrioQuery
                    }
                    placeholder="Escribí para buscar..."
                    onFocus={() => setVidrioOpen(true)}
                    onChange={(e) => {
                      setVidrioQuery(e.target.value);
                      setVidrioId("");
                      setTratamiento("");
                      setVidrioOpen(true);
                      clearError("tratamiento");
                    }}
                    onBlur={() => setTimeout(() => setVidrioOpen(false), 120)}
                  />
                  {vidrioOpen && (
                    <div className="comboDropdown" style={dropdownStyle}>
                      {/* Opción fija: Ninguno */}
                      <button type="button" className="comboItem"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={selectVidrioNinguno}
                        style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <div style={{ fontWeight: 900, opacity: 0.55 }}>— Ninguno —</div>
                      </button>
                      {vidriosFiltrados.length === 0
                        ? <div className="comboEmpty">Sin resultados</div>
                        : vidriosFiltrados.map((v) => (
                          <button type="button" key={v.id} className="comboItem"
                            onMouseDown={(e) => e.preventDefault()} onClick={() => selectVidrio(v)}>
                            <div style={{ fontWeight: 900 }}>{v.nombre}</div>
                            <div style={{ opacity: 0.75, fontSize: 12 }}>{v.descripcion || "\u00A0"}</div>
                          </button>
                        ))
                      }
                    </div>
                  )}
                  <div className="fieldErrorSlot">{errors.tratamiento || "\u00A0"}</div>
                </label>

                {/* ── CAMBIO 3: Montaje con Ninguno ── */}
                <label className="field">
                  <span>Montaje *</span>
                  <ComboSelect
                    className={errors.montaje ? "inputError" : ""}
                    value={montaje}
                    onChange={(v) => { setMontaje(v); clearError("montaje"); }}
                    options={[
                      { value: "", label: "Seleccionar..." },
                      { value: "NINGUNO", label: "Ninguno" },
                      { value: "CAL", label: "Calibrado Común (CAL)" },
                      { value: "RANURA", label: "Ranurado (RANURA)" },
                      { value: "PERFORADO", label: "Perforado" },
                    ]}
                  />
                  <div className="fieldErrorSlot">{errors.montaje || "\u00A0"}</div>
                </label>
              </div>

              <label className="field">
                <span>DIP (opcional)</span>
                <input className={errors.dip ? "inputError" : ""} value={dip}
                  onChange={(e) => { setDip(e.target.value); clearError("dip"); }}
                  placeholder="Ej: 62" inputMode="decimal" />
                <div className="fieldErrorSlot">{errors.dip || "\u00A0"}</div>
              </label>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ margin: "0 0 10px" }}>Datos médicos</h4>
              <div className="grid2">
                <label className="field">
                  <span>Fecha de la receta (opcional)</span>
                  <input type="date" value={fechaReceta} onChange={(e) => setFechaReceta(e.target.value)} />
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </label>
                <label className="field">
                  <span>Doctor (opcional)</span>
                  <input value={doctor} onChange={(e) => setDoctor(e.target.value)} />
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </label>

                <label className="field">
                  <span>Observaciones (opcional)</span>
                  <input value={obs} onChange={(e) => setObs(e.target.value)} />
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </label>

                <label className="field patologiaDropdownRef" style={{ position: "relative" }}>
                  <span>Patología (opcional)</span>
                  <div onClick={() => setPatologiaOpen((o) => !o)} style={{
                    width: "100%", minHeight: 42, padding: "10px 12px", borderRadius: 12,
                    border: patologiaOpen ? "1px solid rgba(85,201,154,0.9)" : "1px solid var(--border)",
                    boxShadow: patologiaOpen ? "0 0 0 4px rgba(122,216,176,0.25)" : "none",
                    background: "var(--input-bg)", cursor: "pointer", display: "flex", flexWrap: "wrap",
                    alignItems: "center", gap: 4, userSelect: "none", boxSizing: "border-box",
                  }}>
                    {patologias.length === 0
                      ? <span style={{ opacity: 0.45, fontSize: 13 }}>Seleccionar...</span>
                      : patologias.map((p) => (
                        <span key={p} style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "2px 8px", borderRadius: 20,
                          background: "var(--color-primary, #2563eb)", color: "#fff", fontSize: 11, fontWeight: 800,
                        }}>
                          {p}
                          <button type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setPatologias((prev) => prev.filter((x) => x !== p)); }}
                            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1, opacity: 0.85 }}>×</button>
                        </span>
                      ))
                    }
                    <span style={{ marginLeft: "auto", opacity: 0.4, fontSize: 11 }}>{patologiaOpen ? "▲" : "▼"}</span>
                  </div>
                  {patologiaOpen && (
                    <div className="comboDropdown" style={{ padding: 0, overflow: "hidden" }}
                      onMouseDown={(e) => e.preventDefault()}>
                      <div style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <input autoFocus value={patologiaQuery} onChange={(e) => setPatologiaQuery(e.target.value)}
                          placeholder="Escribí para buscar..."
                          style={{ width: "100%", border: "none", outline: "none", fontSize: 13, background: "transparent", padding: "2px 4px" }} />
                      </div>
                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {PATOLOGIAS.filter((p) => p.toLowerCase().includes(patologiaQuery.toLowerCase())).map((p) => {
                          const checked = patologias.includes(p);
                          return (
                            <label key={p} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                              cursor: "pointer", background: checked ? "rgba(37,99,235,0.07)" : "transparent",
                              borderBottom: "1px solid rgba(0,0,0,0.04)",
                            }}>
                              <input type="checkbox" checked={checked}
                                onChange={() => setPatologias((prev) => checked ? prev.filter((x) => x !== p) : [...prev, p])}
                                style={{ accentColor: "var(--color-primary, #2563eb)", width: 15, height: 15 }} />
                              <span style={{ fontSize: 13, fontWeight: checked ? 800 : 500 }}>{p}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="fieldErrorSlot">{"\u00A0"}</div>
                </label>
              </div>
            </div>
          </div>

          {/* ── TOTAL + MEDIO DE PAGO ── */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: "0 0 10px" }}>Total y medio de pago</h4>

            {/* ── CAMBIO 6: desglose con total editable ── */}
            <div style={{
              padding: 10, borderRadius: 12,
              background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)", marginBottom: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ opacity: 0.8 }}>Armazón:</div>
                <div style={{ fontWeight: 900 }}>${money(precioArmazon)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ opacity: 0.8 }}>Vidrio{montaje && montaje !== "NINGUNO" ? ` (${montaje})` : ""}:</div>
                <div style={{ fontWeight: 900 }}>${money(precioVidrio)}</div>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(0,0,0,0.15)",
              }}>
                <div style={{ fontWeight: 900 }}>TOTAL (armazón + vidrio):</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {totalEditMode ? (
                    <input
                      autoFocus
                      value={formatThousandsARFromDigits(totalOverride)}
                      onChange={(e) => setTotalOverride(onlyDigits(e.target.value))}
                      onBlur={() => { if (!totalOverride) setTotalEditMode(false); }}
                      inputMode="numeric"
                      style={{
                        width: 130, textAlign: "right", fontWeight: 900, fontSize: 18,
                        border: "2px solid var(--color-primary, #2563eb)",
                        borderRadius: 8, padding: "4px 8px", outline: "none",
                      }}
                      placeholder="0"
                    />
                  ) : (
                    <span style={{ fontWeight: 900, fontSize: 18 }}>${money(totalFinal)}</span>
                  )}
                  <button type="button"
                    onClick={() => {
                      if (totalEditMode) { setTotalEditMode(false); }
                      else { setTotalOverride(String(totalFinal)); setTotalEditMode(true); }
                    }}
                    title={totalEditMode ? "Volver al automático" : "Editar total manualmente"}
                    style={{
                      background: totalEditMode ? "var(--color-primary,#2563eb)" : "rgba(0,0,0,0.08)",
                      color: totalEditMode ? "#fff" : "inherit",
                      border: "none", borderRadius: 8, padding: "4px 10px",
                      cursor: "pointer", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap",
                    }}>
                    {totalEditMode ? "✓ Listo" : "✏ Editar"}
                  </button>
                </div>
              </div>
              {(totalEditMode || totalOverride !== "") && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, textAlign: "right", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                  <span>Auto: ${money(totalAuto)}{totalOverride ? ` · Manual: $${money(totalFinal)}` : ""}</span>
                  {totalOverride !== "" && !totalEditMode && (
                    <button type="button" onClick={() => setTotalOverride("")}
                      style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.75, textDecoration: "underline", padding: 0 }}>
                      ↺ Volver al automático
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Selector de medio de pago */}
            <label className="field" style={{ marginBottom: 12 }}>
              <span>Medio de pago *</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                {MEDIOS_PAGO.map((m) => (
                  <button key={m.value} type="button"
                    onClick={() => { setMedioPago(m.value); if (m.value === "TARJETA_BANCO") setSena(""); clearError("medioPago"); }}
                    style={{
                      padding: "7px 16px", borderRadius: 20,
                      border: medioPago === m.value ? "2px solid var(--color-primary, #2563eb)" : "2px solid rgba(0,0,0,0.12)",
                      background: medioPago === m.value ? "var(--color-primary, #2563eb)" : "transparent",
                      color: medioPago === m.value ? "#fff" : "inherit",
                      fontWeight: 800, cursor: "pointer", fontSize: 13, transition: "all 0.15s",
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="fieldErrorSlot">{errors.medioPago || "\u00A0"}</div>
            </label>

            {medioPago && (
              <div style={{
                padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.08)", marginBottom: 12,
              }}>
                {medioPago === "EFECTIVO" && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ opacity: 0.85 }}>Efectivo ({descEfectivo}% desc.)</span>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>${money(totalEfectivo)}</span>
                  </div>
                )}
                {medioPago === "BILLETERA" && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ opacity: 0.85 }}>Billetera Virtual ({descDebito}% desc.)</span>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>${money(totalBilletera)}</span>
                  </div>
                )}
                {medioPago === "TRANSFERENCIA" && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ opacity: 0.85 }}>Transferencia ({descTransferencia}% desc.)</span>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>${money(totalTransferencia)}</span>
                  </div>
                )}
                {medioPago === "TARJETA_BANCO" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ opacity: 0.85 }}>Tarjeta Banco ({recargoSel}% recargo)</span>
                      <span style={{ fontWeight: 900, fontSize: 16 }}>${money(totalTarjetaBanco)}</span>
                    </div>
                    <label className="field" style={{ margin: 0 }}>
                      <span>Cuotas</span>
                      <ComboSelect
                        value={String(cuotasSel)}
                        onChange={(v) => setCuotasSel(Number(v))}
                        options={cuotasCredito.map((c) => ({
                          value: String(c.cuotas),
                          label: `${c.cuotas} cuota${c.cuotas === 1 ? "" : "s"} (${Number(c.recargoPct || 0)}% recargo)`,
                        }))}
                      />
                      <div className="fieldErrorSlot">{"\u00A0"}</div>
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ opacity: 0.85 }}>{cuotasSel} cuota{Number(cuotasSel) === 1 ? "" : "s"} aprox.</span>
                      <span style={{ fontWeight: 900 }}>${money(cuotaMensual)}/mes</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="hint">*Los descuentos/recargos se configuran en <b>Configuración</b>.</div>
          </div>

          {/* ── SEÑA, LABORATORIO Y ENTREGA ── */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: "0 0 10px" }}>Seña, laboratorio y entrega</h4>

            <div className="grid3">
              <label className="field">
                <span>Seña / Pago parcial ($) {senaBloqueada ? "(no aplica con tarjeta)" : "(opcional)"}</span>
                <input
                  className={errors.sena ? "inputError" : ""}
                  value={senaBloqueada ? "" : formatThousandsARFromDigits(sena)}
                  disabled={senaBloqueada}
                  onChange={(e) => { setSena(onlyDigits(e.target.value)); clearError("sena"); }}
                  placeholder={senaBloqueada ? "—" : "Ej: 10.000"}
                  inputMode="numeric"
                  style={senaBloqueada ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                />
                {!senaBloqueada && (
                  <div className="seniaHint">
                    Sugerida ({seniaPct}%): <span style={{ fontWeight: 900 }}>${money(seniaSugerida)}</span>
                  </div>
                )}
                <div className="fieldErrorSlot">{errors.sena || "\u00A0"}</div>
              </label>

              <label className="field" style={{ position: "relative" }}>
                <span>Laboratorio (opcional)</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      value={laboratorio}
                      placeholder="Escribí o seleccioná un proveedor..."
                      onFocus={() => setLabOpen(true)}
                      onChange={(e) => { setLaboratorio(e.target.value); setLabProveedorId(null); setLabOpen(true); }}
                      onBlur={() => setTimeout(() => setLabOpen(false), 150)}
                    />
                    {labOpen && laboratorios.length > 0 && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
                        maxHeight: 180, overflowY: "auto",
                        background: "var(--card)", border: "1px solid var(--border)",
                        borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        marginTop: 4,
                      }}>
                        {laboratorios
                          .filter((l) => {
                            const term = laboratorio.trim().toLowerCase();
                            if (!term) return true;
                            return l.nombre.toLowerCase().includes(term);
                          })
                          .map((l) => (
                            <button type="button" key={l.id}
                              className="comboItem"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setLaboratorio(l.nombre);
                                setLabProveedorId(l.id);
                                setLabOpen(false);
                              }}
                              style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer" }}>
                              <div style={{ fontWeight: 900 }}>{l.nombre}</div>
                              {l.telefono && <div style={{ opacity: 0.6, fontSize: 12 }}>{l.telefono}</div>}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
                <div className="fieldErrorSlot">{"\u00A0"}</div>
              </label>

              {/* ── CAMBIO 1: fecha inicia en ayer ── */}
              <label className="field">
                <span>Fecha de entrega (opcional)</span>
                <input type="date" value={ordenEntrega}
                  onChange={(e) => setOrdenEntrega(e.target.value)} />
                <div className="fieldErrorSlot">{"\u00A0"}</div>
              </label>
            </div>

            {!senaBloqueada && senaNum > 0 && medioPago && (
              <div style={{
                marginTop: 8, padding: "10px 14px", borderRadius: 10,
                background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>Seña abonada</div>
                  <div style={{ fontWeight: 900 }}>${money(senaNum)}</div>
                </div>
                <div style={{ fontSize: 20, opacity: 0.3 }}>→</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>Saldo restante</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: saldoRestante === 0 ? "green" : "inherit" }}>
                    ${money(saldoRestante)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {tabModo === "manual" ? (
            <button className="btn primary" type="submit">Guardar receta</button>
          ) : (
            <button className="btn primary" type="submit" disabled={guardandoFoto}>
              {(() => {
                const n = fotosCapturadas.length + (currentFoto ? 1 : 0);
                if (guardandoFoto) return "Guardando...";
                return n > 0 ? `Guardar receta (${n} foto${n !== 1 ? "s" : ""})` : "Guardar receta con foto";
              })()}
            </button>
          )}
        </form>

        <div className="hint">
          Nota: al guardar, se descuenta automáticamente <b>stock -1</b> del armazón, se crea una evolución y, si cargás fecha, también aparece en <b>Calendario</b>.
        </div>
      </section>

      {/* ── MODAL ORDEN ── */}
      {ordenOpen && ultimaReceta && (
        <div className="modalOverlay noPrint" onMouseDown={() => setOrdenOpen(false)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Orden al laboratorio</div>
              <button className="modalClose" type="button" onClick={() => setOrdenOpen(false)}>✕</button>
            </div>
            <div className="form">
              <div className="card" style={{ padding: 12 }}>
                <h4 style={{ margin: "0 0 10px" }}>Vista previa</h4>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{ordenMsg}</pre>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <h4 style={{ margin: "0 0 10px" }}>Resumen de pago</h4>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ opacity: 0.8 }}>Medio de pago:</span>
                    <span style={{ fontWeight: 900 }}>{ultimaReceta.medioPago}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ opacity: 0.8 }}>Total:</span>
                    <span style={{ fontWeight: 900 }}>${money(ultimaReceta.totalFinal)}</span>
                  </div>
                  {ultimaReceta.cuotas && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.8 }}>Cuotas:</span>
                      <span style={{ fontWeight: 900 }}>{ultimaReceta.cuotas}x ${money(ultimaReceta.cuotaMensual)}/mes</span>
                    </div>
                  )}
                  {ultimaReceta.sena && !ultimaReceta.cuotas && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ opacity: 0.8 }}>Seña abonada:</span>
                        <span style={{ fontWeight: 900 }}>${money(ultimaReceta.sena)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(0,0,0,0.15)" }}>
                        <span style={{ fontWeight: 900 }}>Saldo restante:</span>
                        <span style={{ fontWeight: 900, fontSize: 16 }}>${money(ultimaReceta.saldoRestante)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modalActions">
                <button className="btn" type="button" onClick={copyOrden}>Copiar</button>
                <button className="btn" type="button"
                  style={{ background: "#25d366", color: "#fff", borderColor: "#25d366" }}
                  onClick={openWhatsAppLab}>
                  WhatsApp
                </button>
                <button className="btn primary" type="button" onClick={printOrden}>Imprimir</button>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
                <button className="btn" type="button" style={{ width: "100%" }}
                  onClick={() => { setOrdenOpen(false); resetForm({ keepPaciente: true }); setTabModo("manual"); }}>
                  + Otra venta para este paciente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT ── */}
      {ultimaReceta && (
        <div id="printArea" style={{ display: "none" }}>
          <h2 style={{ margin: "0 0 8px" }}>Orden de Laboratorio</h2>
          <div style={{ marginBottom: 8 }}>
            <div><b>Paciente:</b> {ultimaReceta.paciente} {ultimaReceta.dni ? `(DNI ${ultimaReceta.dni})` : ""}</div>
            <div><b>Armazón:</b> {ultimaReceta.armazon}</div>
            <div><b>Vidrio/Color:</b> {ultimaReceta.vidrio}</div>
            <div><b>Montaje:</b> {ultimaReceta.montaje}</div>
            <div><b>Formato:</b> {ultimaReceta.formato}</div>
            <div><b>Uso:</b> {ultimaReceta.uso}</div>
            <div><b>Entrega:</b> {ultimaReceta.entregaFecha || "-"}</div>
            <div><b>Laboratorio:</b> {ultimaReceta.laboratorio || "-"}</div>
          </div>
          <hr />
          <div style={{ marginTop: 8 }}>
            <div><b>OD:</b> ESF {ultimaReceta.od.esf || "-"} / CIL {ultimaReceta.od.cil || "-"} / EJE {ultimaReceta.od.eje || "-"}</div>
            <div><b>OI:</b> ESF {ultimaReceta.oi.esf || "-"} / CIL {ultimaReceta.oi.cil || "-"} / EJE {ultimaReceta.oi.eje || "-"}</div>
            <div><b>DIP:</b> {ultimaReceta.dip || "-"}</div>
            <div><b>Obs:</b> {ultimaReceta.obs || "-"}</div>
          </div>
        </div>
      )}

    </div>
  );
}