/**
 * api/index.js
 * Capa centralizada de acceso a window.api (IPC Electron).
 * Todos los llamados pasan por acá para:
 *  - manejar errores en un solo lugar
 *  - facilitar mocking en tests
 *  - agregar loading/error state con useApiCall
 */

function api() {
  if (!window.api) throw new Error("window.api no disponible");
  return window.api;
}

// ─── Pacientes ────────────────────────────────────────────────────────────────
export const listPatients    = ()  => api().listPatients();
export const createPatient   = (p) => api().createPatient(p);
export const updatePatient   = (p) => api().updatePatient(p);

// ─── Armazones ────────────────────────────────────────────────────────────────
export const listFrames       = ()  => api().listFrames();
export const createFrame      = (p) => api().createFrame(p);
export const updateFrame      = (p) => api().updateFrame(p);
export const updateFrameStock = (p) => api().updateFrameStock(p);
export const deleteFrame      = (p) => api().deleteFrame(p);
export const getFramesStockBajo = (p) => api().getFramesStockBajo(p);

// ─── Vidrios ──────────────────────────────────────────────────────────────────
export const listVidrios  = ()  => api().listVidrios();
export const createVidrio = (p) => api().createVidrio(p);
export const updateVidrio = (p) => api().updateVidrio(p);
export const deleteVidrio = (id) => api().deleteVidrio(id);

// ─── Recetas ──────────────────────────────────────────────────────────────────
export const createRecipe            = (p)    => api().createRecipe(p);
export const searchRecipes           = (q)    => api().searchRecipes(q);
export const getRecipe               = (id)   => api().getRecipe(id);
export const deleteRecipe            = (id)   => api().deleteRecipe(id);
export const listUpcomingDeliveries  = (days) => api().listUpcomingDeliveries(days);
export const listDeliveriesByDate    = (iso)  => api().listDeliveriesByDate(iso);
export const listPendingPickup       = ()     => api().listPendingPickup();
export const markRecipeDelivered     = (id)   => api().markRecipeDelivered(id);
export const markRecipeNoticeSent    = (id)   => api().markRecipeNoticeSent(id);
export const markRecipePickedUp      = (id)   => api().markRecipePickedUp(id);
export const countRecipesByMonth     = ()     => api().countRecipesByMonth();

// ─── Evoluciones ─────────────────────────────────────────────────────────────
export const listEvoluciones    = (pid) => api().listEvoluciones(pid);
export const addEvolucion       = (p)   => api().addEvolucion(p);
export const updateEvolucion    = (p)   => api().updateEvolucion(p);
export const deleteEvolucion    = (id)  => api().deleteEvolucion(id);
export const softDeleteEvolucion = (id) => api().softDeleteEvolucion(id);
export const restoreEvolucion   = (id)  => api().restoreEvolucion(id);

// ─── Servicios ────────────────────────────────────────────────────────────────
export const listServicios   = ()  => api().listServicios();
export const createServicio  = (p) => api().createServicio(p);
export const updateServicio  = (p) => api().updateServicio(p);
export const deleteServicio  = (id) => api().deleteServicio(id);

// ─── Configuración ────────────────────────────────────────────────────────────
export const getConfig            = ()  => api().getConfig();
export const setConfig            = (p) => api().setConfig(p);
export const setSeniaPorcentaje   = (n) => api().setSeniaPorcentaje(n);

// ─── Proveedores ─────────────────────────────────────────────────────────────
export const listSuppliers        = (tipo)    => api().listSuppliers(tipo);
export const createSupplier       = (p)       => api().createSupplier(p);
export const updateSupplier       = (p)       => api().updateSupplier(p);
export const deleteSupplier       = (id)      => api().deleteSupplier(id);
export const listSupplierMovements = (payload) => api().listSupplierMovements(payload);
export const addSupplierPayment   = (p)       => api().addSupplierPayment(p);
export const addSupplierPurchase  = (p)       => api().addSupplierPurchase(p);

// ─── Gastos ───────────────────────────────────────────────────────────────────
export const listCategoriasGasto  = ()    => api().listCategoriasGasto();
export const createCategoriaGasto = (p)   => api().createCategoriaGasto(p);
export const updateCategoriaGasto = (p)   => api().updateCategoriaGasto(p);
export const deleteCategoriaGasto = (id)  => api().deleteCategoriaGasto(id);
export const listGastos           = (f)   => api().listGastos(f);
export const upcomingGastos       = (d)   => api().upcomingGastos(d);
export const createGasto          = (p)   => api().createGasto(p);
export const updateGasto          = (p)   => api().updateGasto(p);
export const markGastoPagado      = (id)  => api().markGastoPagado(id);
export const markGastoPendiente   = (id)  => api().markGastoPendiente(id);
export const deleteGasto          = (id)  => api().deleteGasto(id);

// ─── Pagos / Ventas ───────────────────────────────────────────────────────────
export const getPagosResumen             = ()  => api().getPagosResumen();
export const getPagosTotalesPorProveedor = ()  => api().getPagosTotalesPorProveedor();
export const registrarPago               = (p) => api().registrarPago(p);
export const listVentas                  = (p) => api().listVentas(p);
export const getVentasStats              = ()  => api().getVentasStats();
export const getVentasTotalMes           = ()  => api().getVentasTotalMes();
export const updateEstadoPago            = (p) => api().updateEstadoPago(p);
export const deleteVenta                 = (id) => api().deleteVenta(id);

// ─── Balance ──────────────────────────────────────────────────────────────────
export const getBalance = (p) => api().getBalance(p);

// ─── Turnos ───────────────────────────────────────────────────────────────────
export const listTurnosByMonth  = (p)   => api().listTurnosByMonth(p);
export const listTurnosByDate   = (iso) => api().listTurnosByDate(iso);
export const createTurno        = (p)   => api().createTurno(p);
export const updateTurno        = (p)   => api().updateTurno(p);
export const updateTurnoEstado  = (p)   => api().updateTurnoEstado(p);
export const deleteTurno        = (id)  => api().deleteTurno(id);

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
export const whatsappInit        = ()   => api().whatsappInit();
export const whatsappGetStatus   = ()   => api().whatsappGetStatus();
export const whatsappDisconnect  = ()   => api().whatsappDisconnect();
export const whatsappSendMessage = (p)  => api().whatsappSendMessage(p);
export const onWhatsappStatus    = (cb) => api().onWhatsappStatus(cb);
export const offWhatsappStatus   = ()   => api().offWhatsappStatus();

// ─── Licencia ─────────────────────────────────────────────────────────────────
export const checkLicense    = ()     => api().checkLicense();
export const activateLicense = (code) => api().activateLicense(code);

// ─── Caja ─────────────────────────────────────────────────────────────────────
export const listCuentas          = ()  => api().listCuentas();
export const createCuenta         = (p) => api().createCuenta(p);
export const updateCuenta         = (p) => api().updateCuenta(p);
export const deleteCuenta         = (id) => api().deleteCuenta(id);
export const getCajaDiariaHoy     = ()  => api().getCajaDiariaHoy();
export const getCajaDiariaPorFecha = (f) => api().getCajaDiariaPorFecha(f);
export const getCajaSaldos        = ()  => api().getCajaSaldos();
export const agregarMovimientoCaja = (p) => api().agregarMovimientoCaja(p);

// ─── Sistema ──────────────────────────────────────────────────────────────────
export const openExternal = (url)  => api().openExternal(url);
export const printToPdf   = (opts) => api().printToPdf(opts);
