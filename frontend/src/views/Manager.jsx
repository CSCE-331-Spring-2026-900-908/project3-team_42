import { useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/manager/Modal';
import {
  DonutChart,
  HorizontalBarChart,
  LineChartCategory,
  VerticalBarChart,
} from '../components/manager/SvgCharts';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function toISODate(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

function daysAgoStr(days) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return toISODate(dt);
}

function formatCurrency(n) {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function Manager() {
  const navigate = useNavigate();
  const todayStr = useMemo(() => toISODate(new Date()), []);
  const defaultFrom = useMemo(() => daysAgoStr(7), []);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('reports'); // mirrors Project 2 "reports first" UX
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [orderHistoryError, setOrderHistoryError] = useState(null);
  const [menuCatalog, setMenuCatalog] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState(null);
  const [menuSavingId, setMenuSavingId] = useState(null);
  const [menuDrafts, setMenuDrafts] = useState({});
  const [newItemDraft, setNewItemDraft] = useState({
    name: '',
    description: '',
    category: 'Milk Tea',
    default_price: '5.00',
    discount_percent: '0',
    image_url: '',
    is_available: true,
  });
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState(null);
  const [employeeActionId, setEmployeeActionId] = useState(null);
  const [newEmployeeDraft, setNewEmployeeDraft] = useState({
    name: '',
    role: 'cashier',
    email: '',
  });
  const [shifts, setShifts] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftsError, setShiftsError] = useState(null);
  const [newShiftDraft, setNewShiftDraft] = useState({
    user_id: '',
    shift_date: '',
    start_time: '09:00',
    end_time: '17:00',
    role: '',
    notes: '',
  });
  const [scheduleFrom, setScheduleFrom] = useState(defaultFrom);
  const [scheduleTo, setScheduleTo] = useState(todayStr);
  const [laborData, setLaborData] = useState({ byEmployee: [], byRole: [] });
  const [laborLoading, setLaborLoading] = useState(false);
  const [laborError, setLaborError] = useState(null);
  const [inventoryAlerts, setInventoryAlerts] = useState({ now: [], soon: [], all: [] });
  const [inventoryAdjustments, setInventoryAdjustments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [operationsError, setOperationsError] = useState(null);
  const [inventoryAdjustmentDraft, setInventoryAdjustmentDraft] = useState({
    inventory_id: '',
    delta_quantity: '',
    reason: 'correction',
    notes: '',
  });
  const [supplierDraft, setSupplierDraft] = useState({
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  });
  const [purchaseOrderDraft, setPurchaseOrderDraft] = useState({
    supplier_id: '',
    expected_date: '',
    notes: '',
    inventory_id: '',
    quantity: '',
  });
  const [financeAdjustments, setFinanceAdjustments] = useState([]);
  const [financeError, setFinanceError] = useState(null);
  const [financeDraft, setFinanceDraft] = useState({
    order_id: '',
    transaction_id: '',
    adjustment_type: 'refund',
    amount: '',
    reason: '',
  });
  const [insightsData, setInsightsData] = useState({ lookbackDays: 30, top: [], points: [], suggestion: '' });
  const [inventoryForecast, setInventoryForecast] = useState({ lookbackDays: 30, points: [], atRisk: [] });
  const [insightsError, setInsightsError] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [exportSchedules, setExportSchedules] = useState([]);
  const [scheduleDraft, setScheduleDraft] = useState({ name: '', export_kind: 'sales', cadence_days: '7' });
  const [auditError, setAuditError] = useState(null);

  // Reports tab
  const [reportTab, setReportTab] = useState('productUsage'); // productUsage | xReport | zReport | salesReport
  const [rangeFrom, setRangeFrom] = useState(defaultFrom);
  const [rangeTo, setRangeTo] = useState(todayStr);
  const [signature, setSignature] = useState('');
  const [feedback, setFeedback] = useState('');

  const [modal, setModal] = useState({
    open: false,
    title: '',
    kind: null, // productUsage | xReport | salesReport | zReport
    loading: false,
    error: null,
    data: null,
  });
  const managerHeaders = useMemo(
    () => (user?.email ? { 'x-manager-email': String(user.email).toLowerCase() } : {}),
    [user?.email]
  );

  const fetchInventory = () => {
    setInventoryLoading(true);
    setInventoryError(null);
    api
      .get('/inventory')
      .then((res) => setInventory(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setInventoryError(err.response?.data?.error || err.message || 'Failed to load inventory');
      })
      .finally(() => setInventoryLoading(false));
  };

  const fetchOrderHistory = () => {
    setOrderHistoryLoading(true);
    setOrderHistoryError(null);
    api
      .get('/orders/history', { params: { limit: 120 } })
      .then((res) => setOrderHistory(Array.isArray(res.data?.orders) ? res.data.orders : []))
      .catch((err) => {
        setOrderHistoryError(err.response?.data?.error || err.message || 'Failed to load order history');
      })
      .finally(() => setOrderHistoryLoading(false));
  };

  const fetchMenuCatalog = () => {
    setMenuLoading(true);
    setMenuError(null);
    api
      .get('/menu/all')
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setMenuCatalog(rows);
        const nextDrafts = {};
        for (const row of rows) {
          nextDrafts[row.id] = {
            name: row.name || '',
            description: row.description || '',
            category: row.category || '',
            default_price: String(Number(row.default_price || 0).toFixed(2)),
            discount_percent: String(Number(row.discount_percent || 0).toFixed(2)),
            image_url: row.image_url || '',
            is_available: Boolean(row.is_available),
          };
        }
        setMenuDrafts(nextDrafts);
      })
      .catch((err) => {
        setMenuError(err.response?.data?.error || err.message || 'Failed to load menu catalog');
      })
      .finally(() => setMenuLoading(false));
  };

  const fetchEmployees = () => {
    setEmployeesLoading(true);
    setEmployeesError(null);
    api
      .get('/employees', { params: { include_inactive: 1 } })
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setEmployees(rows);
        if (!newShiftDraft.user_id) {
          const firstActive = rows.find((x) => x.is_active);
          if (firstActive) {
            setNewShiftDraft((d) => ({ ...d, user_id: String(firstActive.id) }));
          }
        }
      })
      .catch((err) => {
        setEmployeesError(err.response?.data?.error || err.message || 'Failed to load employees');
      })
      .finally(() => setEmployeesLoading(false));
  };

  const fetchShifts = () => {
    setShiftsLoading(true);
    setShiftsError(null);
    api
      .get('/shifts', { params: { from: scheduleFrom, to: scheduleTo } })
      .then((res) => setShifts(Array.isArray(res.data?.shifts) ? res.data.shifts : []))
      .catch((err) => setShiftsError(err.response?.data?.error || err.message || 'Failed to load shifts'))
      .finally(() => setShiftsLoading(false));
  };

  const fetchLaborReport = () => {
    setLaborLoading(true);
    setLaborError(null);
    api
      .get('/reports/labor', { params: { from: scheduleFrom, to: scheduleTo } })
      .then((res) => {
        setLaborData({
          byEmployee: Array.isArray(res.data?.byEmployee) ? res.data.byEmployee : [],
          byRole: Array.isArray(res.data?.byRole) ? res.data.byRole : [],
        });
      })
      .catch((err) => setLaborError(err.response?.data?.error || err.message || 'Failed to load labor report'))
      .finally(() => setLaborLoading(false));
  };

  const fetchOperations = () => {
    setOperationsError(null);
    Promise.all([
      api.get('/inventory/alerts'),
      api.get('/inventory/adjustments'),
      api.get('/suppliers'),
      api.get('/purchase-orders'),
    ])
      .then(([alertsRes, adjustRes, suppliersRes, poRes]) => {
        setInventoryAlerts(alertsRes.data || { now: [], soon: [], all: [] });
        setInventoryAdjustments(Array.isArray(adjustRes.data?.adjustments) ? adjustRes.data.adjustments : []);
        setSuppliers(Array.isArray(suppliersRes.data?.suppliers) ? suppliersRes.data.suppliers : []);
        setPurchaseOrders(Array.isArray(poRes.data?.purchaseOrders) ? poRes.data.purchaseOrders : []);
      })
      .catch((err) => setOperationsError(err.response?.data?.error || err.message || 'Failed to load operations data'));
  };

  const fetchFinance = () => {
    setFinanceError(null);
    api
      .get('/finance/adjustments')
      .then((res) => setFinanceAdjustments(Array.isArray(res.data?.adjustments) ? res.data.adjustments : []))
      .catch((err) => setFinanceError(err.response?.data?.error || err.message || 'Failed to load finance adjustments'));
  };

  const fetchInsights = () => {
    setInsightsError(null);
    Promise.all([
      api.get('/insights/peak-hours', { params: { days: 30 } }),
      api.get('/insights/inventory-forecast', { params: { days: 30 } }),
    ])
      .then(([peakRes, forecastRes]) => {
        setInsightsData(peakRes.data || { lookbackDays: 30, top: [], points: [], suggestion: '' });
        setInventoryForecast(forecastRes.data || { lookbackDays: 30, points: [], atRisk: [] });
      })
      .catch((err) => setInsightsError(err.response?.data?.error || err.message || 'Failed to load insights'));
  };

  const fetchAuditLogs = () => {
    setAuditError(null);
    Promise.all([api.get('/audit-log'), api.get('/export-schedules')])
      .then(([auditRes, scheduleRes]) => {
        setAuditLogs(Array.isArray(auditRes.data?.logs) ? auditRes.data.logs : []);
        setExportSchedules(Array.isArray(scheduleRes.data?.schedules) ? scheduleRes.data.schedules : []);
      })
      .catch((err) => setAuditError(err.response?.data?.error || err.message || 'Failed to load audit logs'));
  };

  useEffect(() => {
    if (!user || activeTab !== 'inventory') return;
    fetchInventory();
    const id = window.setInterval(fetchInventory, 8000);
    return () => window.clearInterval(id);
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'history') return;
    fetchOrderHistory();
    const id = window.setInterval(fetchOrderHistory, 5000);
    return () => window.clearInterval(id);
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'menu') return;
    fetchMenuCatalog();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'employees') return;
    fetchEmployees();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'schedule') return;
    fetchEmployees();
    fetchShifts();
    fetchLaborReport();
  }, [user, activeTab, scheduleFrom, scheduleTo]);

  useEffect(() => {
    if (!user || activeTab !== 'operations') return;
    fetchOperations();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'finance') return;
    fetchFinance();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'insights') return;
    fetchInsights();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'audit') return;
    fetchAuditLogs();
  }, [user, activeTab]);

  const handleLogin = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    // Verifying token claims locally for MVP
    if (decoded.email === 'reveille.bubbletea@gmail.com' || decoded.email_verified) {
      setUser(decoded);
    } else {
      alert('Unauthorized email address!');
    }
  };

  const isValidRange = (from, to) => {
    if (!from || !to) return false;
    // ISO format lets us use string comparison for dates.
    return from <= to;
  };

  const openModal = (title, kind) => {
    setModal({
      open: true,
      title,
      kind,
      loading: true,
      error: null,
      data: null,
    });
  };

  const setModalError = (err) => {
    const msg = err?.response?.data?.error || err?.message || 'Request failed';
    setModal((m) => ({ ...m, loading: false, error: msg }));
  };

  const handleReportTabChange = (nextTab) => {
    setFeedback('');
    setModal((m) => ({ ...m, open: false, loading: false, error: null, data: null }));
    setReportTab(nextTab);
  };

  const openProductUsage = () => {
    if (!isValidRange(rangeFrom, rangeTo)) {
      setFeedback('Please choose a valid date range.');
      return;
    }
    setFeedback('');
    openModal(`Product Usage — ${rangeFrom} to ${rangeTo}`, 'productUsage');
    api
      .get('/reports/product-usage', { params: { from: rangeFrom, to: rangeTo } })
      .then((res) => {
        const points = res.data?.points || [];
        setModal({ open: true, title: `Product Usage — ${rangeFrom} to ${rangeTo}`, kind: 'productUsage', loading: false, error: null, data: { points } });
        setFeedback(points.length === 0 ? 'No usage data in selected window.' : 'Graph opened.');
      })
      .catch(setModalError);
  };

  const openXReport = () => {
    setFeedback('');
    openModal('X-Report (Hourly Sales)', 'xReport');
    api
      .get('/reports/x')
      .then((res) => {
        setModal({ open: true, title: 'X-Report (Hourly Sales)', kind: 'xReport', loading: false, error: null, data: res.data });
        const hours = res.data?.hours || [];
        setFeedback(hours.some((h) => Number(h.salesAmount) > 0) ? 'Chart opened.' : 'No hourly sales data yet.');
      })
      .catch(setModalError);
  };

  const openSalesByItem = () => {
    if (!isValidRange(rangeFrom, rangeTo)) {
      setFeedback('Please choose a valid date range.');
      return;
    }
    setFeedback('');
    openModal(`Sales by Item — ${rangeFrom} to ${rangeTo}`, 'salesReport');
    api
      .get('/reports/sales-by-item', { params: { from: rangeFrom, to: rangeTo } })
      .then((res) => {
        const items = res.data?.items || [];
        setModal({
          open: true,
          title: `Sales by Item — ${rangeFrom} to ${rangeTo}`,
          kind: 'salesReport',
          loading: false,
          error: null,
          data: { items },
        });
        setFeedback(items.length === 0 ? 'No sales in selected window.' : 'Report opened.');
      })
      .catch(setModalError);
  };

  const runZReport = () => {
    setFeedback('');
    openModal('Z-Report Summary', 'zReport');
    api
      .post('/reports/z-report', { signature })
      .then((res) => {
        setModal({ open: true, title: 'Z-Report Summary', kind: 'zReport', loading: false, error: null, data: res.data });
        setFeedback('Z-report generated.');
      })
      .catch(setModalError);
  };

  const updateMenuDraft = (id, field, value) => {
    setMenuDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const saveMenuItem = async (id) => {
    const draft = menuDrafts[id];
    if (!draft) return;
    setMenuSavingId(id);
    try {
      await api.put(`/menu/${id}`, {
        name: String(draft.name || '').trim(),
        description: draft.description || '',
        category: draft.category || '',
        default_price: Number(draft.default_price || 0),
        discount_percent: Number(draft.discount_percent || 0),
        image_url: draft.image_url || '',
        is_available: Boolean(draft.is_available),
      }, { headers: managerHeaders });
      await fetchMenuCatalog();
      setFeedback(`Saved menu item #${id}.`);
    } catch (err) {
      setMenuError(err.response?.data?.error || err.message || 'Failed to save menu item');
    } finally {
      setMenuSavingId(null);
    }
  };

  const removeMenuItem = async (id) => {
    const row = menuCatalog.find((x) => x.id === id);
    const label = row?.name ? `"${row.name}"` : `#${id}`;
    const ok = window.confirm(`Remove ${label} from active kiosk/cashier menu?`);
    if (!ok) return;

    setMenuSavingId(id);
    try {
      await api.delete(`/menu/${id}`, { headers: managerHeaders });
      await fetchMenuCatalog();
      setFeedback(`Removed menu item ${label} from active menu.`);
    } catch (err) {
      setMenuError(err.response?.data?.error || err.message || 'Failed to remove menu item');
    } finally {
      setMenuSavingId(null);
    }
  };

  const createMenuItem = async () => {
    setMenuSavingId('new');
    try {
      await api.post('/menu', {
        name: String(newItemDraft.name || '').trim(),
        description: newItemDraft.description || '',
        category: newItemDraft.category || '',
        default_price: Number(newItemDraft.default_price || 0),
        discount_percent: Number(newItemDraft.discount_percent || 0),
        image_url: newItemDraft.image_url || '',
        is_available: Boolean(newItemDraft.is_available),
      }, { headers: managerHeaders });
      setNewItemDraft({
        name: '',
        description: '',
        category: 'Milk Tea',
        default_price: '5.00',
        discount_percent: '0',
        image_url: '',
        is_available: true,
      });
      await fetchMenuCatalog();
      setFeedback('Added new menu item.');
    } catch (err) {
      setMenuError(err.response?.data?.error || err.message || 'Failed to add menu item');
    } finally {
      setMenuSavingId(null);
    }
  };

  const addEmployee = async () => {
    setEmployeeActionId('new');
    try {
      await api.post('/employees', {
        name: String(newEmployeeDraft.name || '').trim(),
        role: String(newEmployeeDraft.role || 'cashier').trim(),
        email: String(newEmployeeDraft.email || '').trim().toLowerCase(),
      }, { headers: managerHeaders });
      setNewEmployeeDraft({ name: '', role: 'cashier', email: '' });
      fetchEmployees();
      setFeedback('Employee added.');
    } catch (err) {
      setEmployeesError(err.response?.data?.error || err.message || 'Failed to add employee');
    } finally {
      setEmployeeActionId(null);
    }
  };

  const deactivateEmployee = async (id) => {
    setEmployeeActionId(id);
    try {
      await api.patch(`/employees/${id}/deactivate`, {}, { headers: managerHeaders });
      fetchEmployees();
      setFeedback(`Employee #${id} deactivated.`);
    } catch (err) {
      setEmployeesError(err.response?.data?.error || err.message || 'Failed to deactivate employee');
    } finally {
      setEmployeeActionId(null);
    }
  };

  const reactivateEmployee = async (id) => {
    setEmployeeActionId(id);
    try {
      await api.patch(`/employees/${id}/reactivate`, {}, { headers: managerHeaders });
      fetchEmployees();
      setFeedback(`Employee #${id} reactivated.`);
    } catch (err) {
      setEmployeesError(err.response?.data?.error || err.message || 'Failed to reactivate employee');
    } finally {
      setEmployeeActionId(null);
    }
  };

  const addShift = async () => {
    try {
      await api.post('/shifts', {
        user_id: Number(newShiftDraft.user_id),
        shift_date: newShiftDraft.shift_date || toISODate(new Date()),
        start_time: newShiftDraft.start_time,
        end_time: newShiftDraft.end_time,
        role: newShiftDraft.role || null,
        notes: newShiftDraft.notes || null,
      }, { headers: managerHeaders });
      setNewShiftDraft((d) => ({ ...d, notes: '' }));
      fetchShifts();
      fetchLaborReport();
      setFeedback('Shift added.');
    } catch (err) {
      setShiftsError(err.response?.data?.error || err.message || 'Failed to add shift');
    }
  };

  const removeShift = async (id) => {
    try {
      await api.delete(`/shifts/${id}`, { headers: managerHeaders });
      fetchShifts();
      fetchLaborReport();
      setFeedback('Shift removed.');
    } catch (err) {
      setShiftsError(err.response?.data?.error || err.message || 'Failed to remove shift');
    }
  };

  const createInventoryAdjustment = async () => {
    try {
      await api.post('/inventory/adjustments', {
        inventory_id: Number(inventoryAdjustmentDraft.inventory_id),
        delta_quantity: Number(inventoryAdjustmentDraft.delta_quantity || 0),
        reason: inventoryAdjustmentDraft.reason,
        notes: inventoryAdjustmentDraft.notes || '',
      }, { headers: managerHeaders });
      setInventoryAdjustmentDraft({ inventory_id: '', delta_quantity: '', reason: 'correction', notes: '' });
      fetchOperations();
      setFeedback('Inventory adjustment saved.');
    } catch (err) {
      setOperationsError(err.response?.data?.error || err.message || 'Failed to create inventory adjustment');
    }
  };

  const createSupplier = async () => {
    try {
      await api.post('/suppliers', { ...supplierDraft }, { headers: managerHeaders });
      setSupplierDraft({ name: '', contact_name: '', contact_email: '', contact_phone: '' });
      fetchOperations();
      setFeedback('Supplier added.');
    } catch (err) {
      setOperationsError(err.response?.data?.error || err.message || 'Failed to create supplier');
    }
  };

  const createPurchaseOrder = async () => {
    try {
      await api.post('/purchase-orders', {
        supplier_id: Number(purchaseOrderDraft.supplier_id),
        expected_date: purchaseOrderDraft.expected_date || null,
        notes: purchaseOrderDraft.notes || null,
        items: [{
          inventory_id: Number(purchaseOrderDraft.inventory_id),
          quantity: Number(purchaseOrderDraft.quantity || 0),
        }],
      }, { headers: managerHeaders });
      setPurchaseOrderDraft({ supplier_id: '', expected_date: '', notes: '', inventory_id: '', quantity: '' });
      fetchOperations();
      setFeedback('Purchase order created.');
    } catch (err) {
      setOperationsError(err.response?.data?.error || err.message || 'Failed to create purchase order');
    }
  };

  const receivePurchaseOrder = async (id) => {
    try {
      await api.post(`/purchase-orders/${id}/receive`, {}, { headers: managerHeaders });
      fetchOperations();
      setFeedback(`Purchase order #${id} received.`);
    } catch (err) {
      setOperationsError(err.response?.data?.error || err.message || 'Failed to receive purchase order');
    }
  };

  const createFinanceAdjustment = async () => {
    try {
      await api.post('/finance/adjustments', {
        order_id: financeDraft.order_id ? Number(financeDraft.order_id) : null,
        transaction_id: financeDraft.transaction_id ? Number(financeDraft.transaction_id) : null,
        adjustment_type: financeDraft.adjustment_type,
        amount: Number(financeDraft.amount || 0),
        reason: financeDraft.reason || '',
      }, { headers: managerHeaders });
      setFinanceDraft({ order_id: '', transaction_id: '', adjustment_type: 'refund', amount: '', reason: '' });
      fetchFinance();
      setFeedback('Finance adjustment logged.');
    } catch (err) {
      setFinanceError(err.response?.data?.error || err.message || 'Failed to create finance adjustment');
    }
  };

  const createExportSchedule = async () => {
    try {
      await api.post('/export-schedules', {
        name: String(scheduleDraft.name || '').trim(),
        export_kind: scheduleDraft.export_kind,
        cadence_days: Number(scheduleDraft.cadence_days || 0),
      }, { headers: managerHeaders });
      setScheduleDraft({ name: '', export_kind: 'sales', cadence_days: '7' });
      fetchAuditLogs();
      setFeedback('Export schedule added.');
    } catch (err) {
      setAuditError(err.response?.data?.error || err.message || 'Failed to create export schedule');
    }
  };

  const runExportSchedule = async (id) => {
    try {
      await api.post(`/export-schedules/${id}/run`, {}, { headers: managerHeaders });
      fetchAuditLogs();
      setFeedback(`Ran export schedule #${id}.`);
    } catch (err) {
      setAuditError(err.response?.data?.error || err.message || 'Failed to run export schedule');
    }
  };

  const exportCsv = async (kind) => {
    try {
      const response = await api.get(`/export/${kind}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${kind}-export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAuditError(err.response?.data?.error || err.message || `Failed to export ${kind}`);
    }
  };

  if (!user) {
    if (!googleClientId) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-sky-600 to-blue-700 flex flex-col items-center justify-center space-y-6 px-4">
          <h1 className="text-3xl font-extrabold text-white">Manager Access</h1>
          <p className="text-gray-700 text-lg max-w-xl text-center">
            Google OAuth is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in{' '}
            <code>frontend/.env.local</code>, then restart the dev server.
          </p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-600 to-blue-700 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img src="/logo.png" alt="Reveille Boba" className="mx-auto mb-4 h-20 w-20 object-contain drop-shadow-lg" />
            <h1 id="main-content" className="text-4xl font-extrabold text-white tracking-tight">Manager Access</h1>
            <p className="mt-2 text-sky-100 text-base">Sign in with your authorized Google account to continue.</p>
          </div>
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 border border-white/40">
            <div className="mb-6 grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
              <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
                <p className="text-lg mb-1">📊</p>
                <p className="font-semibold text-blue-700">Reports</p>
              </div>
              <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
                <p className="text-lg mb-1">👥</p>
                <p className="font-semibold text-blue-700">Staff</p>
              </div>
              <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
                <p className="text-lg mb-1">🏪</p>
                <p className="font-semibold text-blue-700">Operations</p>
              </div>
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleLogin}
                onError={() => {
                  console.log('Login Failed');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center">
      <header className="bg-gradient-to-r from-sky-600 to-blue-700 text-white w-full p-4 shadow-lg flex justify-between items-center px-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-sky-700 rounded transition"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full" />
            <span className="text-sky-200">Welcome, {user.name}</span>
          </div>
          <button
            onClick={() => setUser(null)}
            className="hover:bg-sky-700 px-4 py-2 rounded-lg font-semibold bg-white/20 shadow-sm border border-white/30 transition text-white text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main id="main-content" className="p-6 w-full max-w-7xl">
        {/* Tab navigation */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max bg-white border border-blue-100 rounded-xl p-1.5 shadow-sm" role="tablist" aria-label="Manager sections">
            {[
              { key: 'reports',    icon: '📊', label: 'Reports' },
              { key: 'inventory',  icon: '📦', label: 'Inventory' },
              { key: 'history',    icon: '🧾', label: 'Orders' },
              { key: 'menu',       icon: '🍵', label: 'Menu' },
              { key: 'employees',  icon: '👥', label: 'Employees' },
              { key: 'schedule',   icon: '📅', label: 'Schedules' },
              { key: 'operations', icon: '🏪', label: 'Operations' },
              { key: 'finance',    icon: '💰', label: 'Finance' },
              { key: 'insights',   icon: '💡', label: 'Insights' },
              { key: 'audit',      icon: '🔍', label: 'Audit' },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                aria-controls="tab-panel-main"
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === key
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md'
                    : 'text-blue-700 hover:bg-sky-50 bg-transparent'
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div id="tab-panel-main" role="tabpanel" className="bg-white p-8 rounded-xl shadow-sm min-h-[500px] border border-blue-100">
          {activeTab === 'inventory' && (
            <>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">📦</span>
                  <h2 className="text-2xl font-bold text-gray-800">Inventory Overview</h2>
                </div>
                <button
                  type="button"
                  onClick={fetchInventory}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition"
                >
                  Refresh
                </button>
              </div>
              {inventoryError && (
                <p className="text-red-600 mb-4" role="alert">
                  {inventoryError}
                </p>
              )}
              {inventoryLoading && <p className="text-gray-500 mb-4">Refreshing inventory…</p>}
              {!inventoryError && !inventoryLoading && inventory.length === 0 && <p className="text-gray-500">No inventory rows found.</p>}
              {inventory.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left border-collapse">
                    <caption className="sr-only">Store inventory quantities and restock thresholds</caption>
                    <thead>
                      <tr className="border-b-2 border-blue-100 bg-sky-50/60">
                        <th scope="col" className="p-3 font-semibold text-gray-700">
                          Item
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700">
                          Category
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700 text-right">
                          Quantity
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700">
                          Unit
                        </th>
                        <th scope="col" className="p-3 font-semibold text-gray-700 text-right">
                          Restock at
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 text-gray-900">{row.name}</td>
                          <td className="p-3 text-gray-600">{row.category || '—'}</td>
                          <td className="p-3 text-right tabular-nums">{Number(row.quantity).toFixed(2)}</td>
                          <td className="p-3 text-gray-600">{row.unit || '—'}</td>
                          <td className="p-3 text-right tabular-nums text-amber-700">
                            {Number(row.restock_threshold).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">🧾</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Order History</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Live feed of kiosk and cashier checkouts.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchOrderHistory}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition"
                >
                  Refresh
                </button>
              </div>

              {orderHistoryError && (
                <p className="text-red-600 mb-4" role="alert">
                  {orderHistoryError}
                </p>
              )}
              {orderHistoryLoading && <p className="text-gray-500 mb-4">Refreshing order history…</p>}
              {!orderHistoryError && !orderHistoryLoading && orderHistory.length === 0 && (
                <p className="text-gray-500">No orders yet.</p>
              )}

              {orderHistory.length > 0 && (
                <div className="space-y-4">
                  {orderHistory.map((order) => (
                    <section key={order.id} className="rounded-xl border border-blue-100 bg-sky-50/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-gray-900">
                          Order #{order.id} <span className="text-sm text-gray-500">({order.status})</span>
                        </p>
                        <p className="font-semibold text-blue-800">{formatCurrency(order.total_amount)}</p>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                        <p>Created: {formatDateTime(order.created_at)}</p>
                        <p>Cashier: {order.cashier_name || `ID ${order.cashier_id || '—'}`}</p>
                        <p>Customer: {order.customer_email || 'Guest / walk-in'}</p>
                        <p>Items: {Number(order.item_count || 0)}</p>
                      </div>

                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-gray-700">
                                <th className="py-2 pr-3">Item</th>
                                <th className="py-2 pr-3 text-right">Qty</th>
                                <th className="py-2 pr-3 text-right">Unit Price</th>
                                <th className="py-2 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items.map((it, idx) => {
                                const qty = Number(it.quantity || 0);
                                const price = Number(it.price_at_time || 0);
                                return (
                                  <tr key={`${order.id}-${idx}`} className="border-b border-gray-100 text-gray-800">
                                    <td className="py-2 pr-3">{it.item_name || `Menu #${it.menu_item_id}`}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums">{qty}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(price)}</td>
                                    <td className="py-2 text-right tabular-nums">{formatCurrency(qty * price)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'menu' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">🍵</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Menu Items & Pricing</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Name, price, discount, availability, and image — live on kiosk/cashier.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchMenuCatalog}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition"
                >
                  Refresh
                </button>
              </div>

              {menuError && <p className="text-red-600 mb-4">{menuError}</p>}
              {menuLoading && <p className="text-gray-500 mb-4">Loading menu catalog…</p>}

              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Add Menu Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newItemDraft.name}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, name: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={newItemDraft.category}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, category: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Base price"
                    value={newItemDraft.default_price}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, default_price: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Discount %"
                    value={newItemDraft.discount_percent}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, discount_percent: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Image URL (optional)"
                    value={newItemDraft.image_url}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, image_url: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm md:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newItemDraft.description}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, description: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm md:col-span-2"
                  />
                </div>
                <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={newItemDraft.is_available}
                    onChange={(e) => setNewItemDraft((d) => ({ ...d, is_available: e.target.checked }))}
                  />
                  Available
                </label>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={createMenuItem}
                    disabled={menuSavingId === 'new'}
                    className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
                  >
                    {menuSavingId === 'new' ? 'Adding…' : 'Add Item'}
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                {menuCatalog.map((item) => {
                  const draft = menuDrafts[item.id] || {};
                  const base = Number(draft.default_price || 0);
                  const discount = Number(draft.discount_percent || 0);
                  const effective = Math.max(0, base * (1 - discount / 100));
                  return (
                    <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <input
                          type="text"
                          value={draft.name || ''}
                          onChange={(e) => updateMenuDraft(item.id, 'name', e.target.value)}
                          className="rounded border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={draft.category || ''}
                          onChange={(e) => updateMenuDraft(item.id, 'category', e.target.value)}
                          className="rounded border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.default_price || '0'}
                          onChange={(e) => updateMenuDraft(item.id, 'default_price', e.target.value)}
                          className="rounded border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.discount_percent || '0'}
                          onChange={(e) => updateMenuDraft(item.id, 'discount_percent', e.target.value)}
                          className="rounded border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={draft.image_url || ''}
                          onChange={(e) => updateMenuDraft(item.id, 'image_url', e.target.value)}
                          placeholder="Image URL"
                          className="rounded border border-gray-200 px-3 py-2 text-sm md:col-span-2"
                        />
                        <input
                          type="text"
                          value={draft.description || ''}
                          onChange={(e) => updateMenuDraft(item.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="rounded border border-gray-200 px-3 py-2 text-sm md:col-span-2"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.is_available)}
                            onChange={(e) => updateMenuDraft(item.id, 'is_available', e.target.checked)}
                          />
                          Available
                        </label>
                        <p className="text-sm text-gray-600">
                          Effective price: <span className="font-semibold text-gray-900">{formatCurrency(effective)}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => saveMenuItem(item.id)}
                          disabled={menuSavingId === item.id}
                          className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
                        >
                          {menuSavingId === item.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMenuItem(item.id)}
                          disabled={menuSavingId === item.id}
                          className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {activeTab === 'employees' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">👥</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Employee Management</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Hire and manage staff while preserving sales history.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchEmployees}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition"
                >
                  Refresh
                </button>
              </div>

              {employeesError && <p className="text-red-600 mb-4">{employeesError}</p>}
              {employeesLoading && <p className="text-gray-500 mb-4">Loading employees…</p>}

              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Hire Employee</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={newEmployeeDraft.name}
                    onChange={(e) => setNewEmployeeDraft((d) => ({ ...d, name: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={newEmployeeDraft.role}
                    onChange={(e) => setNewEmployeeDraft((d) => ({ ...d, role: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="cashier">cashier</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                    <option value="supervisor">supervisor</option>
                    <option value="barista">barista</option>
                  </select>
                  <input
                    type="email"
                    placeholder="email@store.com"
                    value={newEmployeeDraft.email}
                    onChange={(e) => setNewEmployeeDraft((d) => ({ ...d, email: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={addEmployee}
                    disabled={employeeActionId === 'new'}
                    className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
                  >
                    {employeeActionId === 'new' ? 'Adding…' : 'Add Employee'}
                  </button>
                </div>
              </section>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-700">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Hired</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-100 text-gray-800">
                        <td className="py-2 pr-3 font-medium">{emp.name}</td>
                        <td className="py-2 pr-3">{emp.role}</td>
                        <td className="py-2 pr-3">{emp.email}</td>
                        <td className="py-2 pr-3">
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${emp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{formatDateTime(emp.hired_at)}</td>
                        <td className="py-2 text-right">
                          {emp.is_active ? (
                            <button
                              type="button"
                              onClick={() => deactivateEmployee(emp.id)}
                              disabled={employeeActionId === emp.id}
                              className="rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-60"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => reactivateEmployee(emp.id)}
                              disabled={employeeActionId === emp.id}
                              className="rounded bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-60"
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'schedule' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">📅</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Shift Scheduling</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Track weekly coverage and scheduled labor hours.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fetchShifts();
                    fetchLaborReport();
                  }}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition"
                >
                  Refresh
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">From</label>
                  <input type="date" value={scheduleFrom} onChange={(e) => setScheduleFrom(e.target.value)} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">To</label>
                  <input type="date" value={scheduleTo} onChange={(e) => setScheduleTo(e.target.value)} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>

              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Add Shift</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <select
                    value={newShiftDraft.user_id}
                    onChange={(e) => setNewShiftDraft((d) => ({ ...d, user_id: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Employee</option>
                    {employees.filter((e) => e.is_active).map((e) => (
                      <option key={e.id} value={String(e.id)}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={newShiftDraft.shift_date} onChange={(e) => setNewShiftDraft((d) => ({ ...d, shift_date: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="time" value={newShiftDraft.start_time} onChange={(e) => setNewShiftDraft((d) => ({ ...d, start_time: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="time" value={newShiftDraft.end_time} onChange={(e) => setNewShiftDraft((d) => ({ ...d, end_time: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="text" placeholder="Role on shift" value={newShiftDraft.role} onChange={(e) => setNewShiftDraft((d) => ({ ...d, role: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <button type="button" onClick={addShift} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">
                    Add Shift
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={newShiftDraft.notes}
                  onChange={(e) => setNewShiftDraft((d) => ({ ...d, notes: e.target.value }))}
                  className="rounded border border-gray-200 px-3 py-2 text-sm mt-3 w-full"
                />
              </section>

              {shiftsError && <p className="text-red-600 mb-3">{shiftsError}</p>}
              {shiftsLoading && <p className="text-gray-500 mb-3">Loading shifts…</p>}

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-700">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Employee</th>
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Start</th>
                      <th className="py-2 pr-3">End</th>
                      <th className="py-2 pr-3">Notes</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 text-gray-800">
                        <td className="py-2 pr-3">{s.shift_date?.slice(0, 10)}</td>
                        <td className="py-2 pr-3">{s.employee_name}</td>
                        <td className="py-2 pr-3">{s.role || s.employee_role || 'staff'}</td>
                        <td className="py-2 pr-3">{String(s.start_time || '').slice(0, 5)}</td>
                        <td className="py-2 pr-3">{String(s.end_time || '').slice(0, 5)}</td>
                        <td className="py-2 pr-3">{s.notes || '—'}</td>
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => removeShift(s.id)} className="rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Scheduled Hours by Employee</h3>
                  {laborLoading && <p className="text-gray-500">Loading labor metrics…</p>}
                  {laborError && <p className="text-red-600">{laborError}</p>}
                  {!laborLoading && !laborError && (
                    <HorizontalBarChart
                      data={(laborData.byEmployee || []).map((x) => ({
                        label: x.employeeName,
                        value: Number(x.scheduledHours || 0),
                      }))}
                      valueFormatter={(n) => `${Number(n || 0).toFixed(1)}h`}
                      height={300}
                    />
                  )}
                </section>

                <section className="rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Scheduled Hours by Role</h3>
                  {laborLoading && <p className="text-gray-500">Loading labor metrics…</p>}
                  {laborError && <p className="text-red-600">{laborError}</p>}
                  {!laborLoading && !laborError && (
                    <VerticalBarChart
                      data={(laborData.byRole || []).map((x) => ({
                        label: x.roleName,
                        value: Number(x.scheduledHours || 0),
                      }))}
                      valueFormatter={(n) => `${Number(n || 0).toFixed(1)}h`}
                      height={280}
                    />
                  )}
                </section>
              </div>
            </>
          )}

          {activeTab === 'operations' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">🏪</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Operations</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Low-stock alerts, inventory adjustments, suppliers, and purchase orders.</p>
                  </div>
                </div>
                <button type="button" onClick={fetchOperations} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition">Refresh</button>
              </div>
              {operationsError && <p className="text-red-600 mb-4">{operationsError}</p>}
              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Low-Stock Alerts</h3>
                <p className="text-sm text-gray-600">Now: {inventoryAlerts.now?.length || 0} | Soon: {inventoryAlerts.soon?.length || 0}</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(inventoryAlerts.now || []).slice(0, 6).map((row) => (
                    <div key={`now-${row.id}`} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-red-800">{row.name}</span> — {Number(row.quantity).toFixed(2)} (threshold {Number(row.restock_threshold).toFixed(2)})
                    </div>
                  ))}
                  {(inventoryAlerts.soon || []).slice(0, 6).map((row) => (
                    <div key={`soon-${row.id}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-amber-800">{row.name}</span> — {Number(row.quantity).toFixed(2)} (soon)
                    </div>
                  ))}
                </div>
              </section>
              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Inventory Adjustment Log</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select value={inventoryAdjustmentDraft.inventory_id} onChange={(e) => setInventoryAdjustmentDraft((d) => ({ ...d, inventory_id: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Inventory item</option>
                    {(inventoryAlerts.all || []).map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Delta (+/-)" value={inventoryAdjustmentDraft.delta_quantity} onChange={(e) => setInventoryAdjustmentDraft((d) => ({ ...d, delta_quantity: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <select value={inventoryAdjustmentDraft.reason} onChange={(e) => setInventoryAdjustmentDraft((d) => ({ ...d, reason: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <option value="correction">correction</option><option value="waste">waste</option><option value="spill">spill</option><option value="spoilage">spoilage</option><option value="supplier_receive">supplier_receive</option>
                  </select>
                  <button type="button" onClick={createInventoryAdjustment} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Apply</button>
                </div>
                <input type="text" placeholder="Notes" value={inventoryAdjustmentDraft.notes} onChange={(e) => setInventoryAdjustmentDraft((d) => ({ ...d, notes: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm mt-3 w-full" />
              </section>
              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Suppliers & Purchase Orders</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <input type="text" placeholder="Supplier name" value={supplierDraft.name} onChange={(e) => setSupplierDraft((d) => ({ ...d, name: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="text" placeholder="Contact name" value={supplierDraft.contact_name} onChange={(e) => setSupplierDraft((d) => ({ ...d, contact_name: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="email" placeholder="Contact email" value={supplierDraft.contact_email} onChange={(e) => setSupplierDraft((d) => ({ ...d, contact_email: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <button type="button" onClick={createSupplier} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Add Supplier</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <select value={purchaseOrderDraft.supplier_id} onChange={(e) => setPurchaseOrderDraft((d) => ({ ...d, supplier_id: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Supplier</option>{suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </select>
                  <select value={purchaseOrderDraft.inventory_id} onChange={(e) => setPurchaseOrderDraft((d) => ({ ...d, inventory_id: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Inventory item</option>{(inventoryAlerts.all || []).map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Qty" value={purchaseOrderDraft.quantity} onChange={(e) => setPurchaseOrderDraft((d) => ({ ...d, quantity: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="date" value={purchaseOrderDraft.expected_date} onChange={(e) => setPurchaseOrderDraft((d) => ({ ...d, expected_date: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <button type="button" onClick={createPurchaseOrder} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Create PO</button>
                </div>
                <div className="mt-4 space-y-2">
                  {purchaseOrders.slice(0, 8).map((po) => (
                    <div key={po.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                      <span>PO #{po.id} — {po.supplier_name || 'Unknown'} — {po.status}</span>
                      {po.status !== 'received' && <button type="button" onClick={() => receivePurchaseOrder(po.id)} className="rounded bg-blue-700 px-3 py-1 text-xs font-bold text-white hover:bg-blue-600">Receive</button>}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === 'finance' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">💰</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Finance Controls</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Voids, refunds, comps, discounts, and service-charge adjustments.</p>
                  </div>
                </div>
                <button type="button" onClick={fetchFinance} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition">Refresh</button>
              </div>
              {financeError && <p className="text-red-600 mb-4">{financeError}</p>}
              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Record Adjustment</h3>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <input type="number" placeholder="Order ID (optional)" value={financeDraft.order_id} onChange={(e) => setFinanceDraft((d) => ({ ...d, order_id: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="number" placeholder="Tx ID (optional)" value={financeDraft.transaction_id} onChange={(e) => setFinanceDraft((d) => ({ ...d, transaction_id: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <select value={financeDraft.adjustment_type} onChange={(e) => setFinanceDraft((d) => ({ ...d, adjustment_type: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <option value="void">void</option><option value="refund">refund</option><option value="comp">comp</option><option value="discount">discount</option><option value="service_charge">service_charge</option>
                  </select>
                  <input type="number" step="0.01" placeholder="Amount" value={financeDraft.amount} onChange={(e) => setFinanceDraft((d) => ({ ...d, amount: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm" />
                  <input type="text" placeholder="Reason" value={financeDraft.reason} onChange={(e) => setFinanceDraft((d) => ({ ...d, reason: e.target.value }))} className="rounded border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
                </div>
                <button type="button" onClick={createFinanceAdjustment} className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Save Adjustment</button>
              </section>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm border-collapse">
                  <thead><tr className="border-b border-gray-200 text-gray-700"><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Transaction</th><th className="py-2 pr-3">Reason</th><th className="py-2">Created</th></tr></thead>
                  <tbody>{financeAdjustments.slice(0, 80).map((a) => <tr key={a.id} className="border-b border-gray-100 text-gray-800"><td className="py-2 pr-3">{a.adjustment_type}</td><td className="py-2 pr-3">{formatCurrency(a.amount)}</td><td className="py-2 pr-3">{a.order_id || '—'}</td><td className="py-2 pr-3">{a.transaction_id || '—'}</td><td className="py-2 pr-3">{a.reason || '—'}</td><td className="py-2">{formatDateTime(a.created_at)}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'insights' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">💡</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Insights</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Peak hours and staffing suggestions from transaction history.</p>
                  </div>
                </div>
                <button type="button" onClick={fetchInsights} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition">Refresh</button>
              </div>
              {insightsError && <p className="text-red-600 mb-4">{insightsError}</p>}
              <section className="rounded-xl border border-gray-200 p-4">
                <p className="text-gray-700 font-medium mb-3">{insightsData.suggestion || 'No suggestion yet.'}</p>
                <HorizontalBarChart
                  data={(insightsData.top || []).map((p) => ({
                    label: `D${p.dayOfWeek} ${String(p.hourOfDay).padStart(2, '0')}:00`,
                    value: p.txCount,
                  }))}
                  valueFormatter={(n) => `${Number(n || 0)} tx`}
                  height={280}
                />
              </section>
              <section className="rounded-xl border border-gray-200 p-4 mt-6">
                <h3 className="font-semibold text-gray-800 mb-2">Inventory Depletion Forecast</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Based on last {inventoryForecast.lookbackDays || 30} days usage. Highlights items expected to hit threshold within 14 days.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-700">
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2 pr-3 text-right">Qty</th>
                        <th className="py-2 pr-3 text-right">Avg/day</th>
                        <th className="py-2 pr-3 text-right">Days to threshold</th>
                        <th className="py-2 text-right">Suggested reorder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventoryForecast.atRisk || []).map((row) => (
                        <tr key={row.inventoryId} className="border-b border-gray-100 text-gray-800">
                          <td className="py-2 pr-3">{row.inventoryName}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{Number(row.quantity || 0).toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{Number(row.avgDailyUse || 0).toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.daysUntilRestock == null ? '—' : Number(row.daysUntilRestock).toFixed(1)}</td>
                          <td className="py-2 text-right tabular-nums">{Number(row.suggestedReorderQty || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === 'audit' && (
            <>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">🔍</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Audit & Export</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Track who changed what and export CSV snapshots.</p>
                  </div>
                </div>
                <button type="button" onClick={fetchAuditLogs} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-sky-100 transition">Refresh</button>
              </div>
              {auditError && <p className="text-red-600 mb-4">{auditError}</p>}
              <div className="mb-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => exportCsv('sales')} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Export Sales CSV</button>
                <button type="button" onClick={() => exportCsv('inventory')} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Export Inventory CSV</button>
                <button type="button" onClick={() => exportCsv('labor')} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Export Labor CSV</button>
              </div>
              <section className="mb-6 rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Scheduled Exports</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Schedule name"
                    value={scheduleDraft.name}
                    onChange={(e) => setScheduleDraft((d) => ({ ...d, name: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={scheduleDraft.export_kind}
                    onChange={(e) => setScheduleDraft((d) => ({ ...d, export_kind: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="sales">sales</option>
                    <option value="inventory">inventory</option>
                    <option value="labor">labor</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={scheduleDraft.cadence_days}
                    onChange={(e) => setScheduleDraft((d) => ({ ...d, cadence_days: e.target.value }))}
                    className="rounded border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Cadence days"
                  />
                  <button type="button" onClick={createExportSchedule} className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600">Add Schedule</button>
                </div>
                <div className="space-y-2">
                  {exportSchedules.slice(0, 30).map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                      <span>
                        #{s.id} {s.name} ({s.export_kind}) every {s.cadence_days} day(s) | next: {formatDateTime(s.next_run_at)}
                      </span>
                      <button type="button" onClick={() => runExportSchedule(s.id)} className="rounded bg-blue-700 px-3 py-1 text-xs font-bold text-white hover:bg-blue-600">
                        Run now
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm border-collapse">
                  <thead><tr className="border-b border-gray-200 text-gray-700"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Actor</th><th className="py-2 pr-3">Action</th><th className="py-2 pr-3">Entity</th><th className="py-2">Details</th></tr></thead>
                  <tbody>{auditLogs.slice(0, 120).map((l) => <tr key={l.id} className="border-b border-gray-100 text-gray-800"><td className="py-2 pr-3">{formatDateTime(l.created_at)}</td><td className="py-2 pr-3">{l.actor_email || 'system'}</td><td className="py-2 pr-3">{l.action_type}</td><td className="py-2 pr-3">{l.entity_type} #{l.entity_id || '—'}</td><td className="py-2">{typeof l.details === 'string' ? l.details : JSON.stringify(l.details || {})}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'reports' && (
            <>
              <div className="mb-5 flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">📊</span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Reports</h2>
                  <p className="text-sm text-gray-500">Product usage · X-report · Z-report · Sales by item</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6 bg-slate-50 border border-slate-200 rounded-xl p-1.5" role="tablist" aria-label="Report types">
                {[
                  { key: 'productUsage', label: '📉 Product Usage' },
                  { key: 'xReport',      label: '⏰ X-Report' },
                  { key: 'zReport',      label: '🔒 Z-Report' },
                  { key: 'salesReport',  label: '💵 Sales Report' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={reportTab === key}
                    aria-controls="report-panel"
                    onClick={() => handleReportTabChange(key)}
                    className={`min-h-[38px] px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                      reportTab === key
                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow'
                        : 'text-blue-700 hover:bg-sky-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div id="report-panel" role="tabpanel" className="bg-white border border-blue-100 rounded-xl p-6 shadow-sm">
                {feedback && (
                  <p className={`mb-4 font-medium ${feedback.includes('No') ? 'text-amber-700' : 'text-blue-800'}`}>
                    {feedback}
                  </p>
                )}

                {reportTab === 'productUsage' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Product Usage</h3>
                    <p className="text-gray-500 mb-4">
                      Inventory consumed by sold products over the selected date range.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div>
                        <label htmlFor="pu-from" className="block text-sm font-semibold text-gray-700 mb-1">From</label>
                        <input
                          id="pu-from"
                          type="date"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="pu-to" className="block text-sm font-semibold text-gray-700 mb-1">To</label>
                        <input
                          id="pu-to"
                          type="date"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={openProductUsage}
                        className="mt-1 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-600 transition"
                      >
                        Open Product Usage Graph
                      </button>
                    </div>
                  </>
                )}

                {reportTab === 'xReport' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">X-Report (Hourly Sales)</h3>
                    <p className="text-gray-500 mb-5">
                      View today’s sales by hour in a bar chart. (Uses the current day in Project 3’s schema.)
                    </p>
                    <button
                      type="button"
                      onClick={openXReport}
                      className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-600 transition"
                    >
                      Open X-Report Chart
                    </button>
                  </>
                )}

                {reportTab === 'zReport' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Z-Report (End of Day)</h3>
                    <p className="text-gray-500 mb-5">
                      Close the business day and get a full summary. Enter your signature before running.
                    </p>
                    <p className="text-amber-700 text-sm mb-4">
                      Running Z-report closes the current business window. After that, X/Z totals can show $0.00 until new orders are placed.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div className="w-full sm:w-[280px]">
                        <label htmlFor="z-signature" className="block text-sm font-semibold text-gray-700 mb-1">Signature</label>
                        <input
                          id="z-signature"
                          type="text"
                          value={signature}
                          onChange={(e) => setSignature(e.target.value)}
                          placeholder="Your name or initials"
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={runZReport}
                        className="mt-1 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-600 transition"
                      >
                        Run Z-Report
                      </button>
                    </div>
                  </>
                )}

                {reportTab === 'salesReport' && (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">Sales by Item</h3>
                    <p className="text-gray-500 mb-4">
                      View revenue and quantity sold per menu item for any date range.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                      <div>
                        <label htmlFor="sr-from" className="block text-sm font-semibold text-gray-700 mb-1">From</label>
                        <input
                          id="sr-from"
                          type="date"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="sr-to" className="block text-sm font-semibold text-gray-700 mb-1">To</label>
                        <input
                          id="sr-to"
                          type="date"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={openSalesByItem}
                        className="mt-1 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-600 transition"
                      >
                        Open Sales Report
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <Modal
        open={modal.open}
        title={modal.title}
        onClose={() => setModal((m) => ({ ...m, open: false, loading: false, error: null, data: null }))}
      >
        {modal.loading && <p className="text-gray-600">Loading…</p>}
        {!modal.loading && modal.error && <p className="text-red-600">{modal.error}</p>}
        {!modal.loading && !modal.error && modal.kind === 'productUsage' && (
          <>
            {(!modal.data?.points || modal.data.points.length === 0) ? (
              <p className="text-gray-600">No usage data found for the selected date range.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-700 font-medium">Units consumed from inventory (via `ProductInventory` + `TransactionItem`).</p>
                <LineChartCategory
                  data={(modal.data.points || []).map((p) => ({ label: p.itemName, value: p.usedQuantity }))}
                />
              </div>
            )}
          </>
        )}

        {!modal.loading && !modal.error && modal.kind === 'xReport' && (
          <>
            <div className="space-y-2 mb-4">
              <p className="text-gray-800 font-medium">{modal.data?.summary}</p>
              <p className="text-gray-600">{modal.data?.paymentMethodSummary}</p>
            </div>
            {(!modal.data?.hours || modal.data.hours.length === 0) ? (
              <p className="text-gray-600">No hourly sales data yet.</p>
            ) : (
              (() => {
                const allHours = (modal.data.hours || []).map((h) => ({ label: h.hourBucket, value: h.salesAmount }));
                const nonZeroHours = allHours.filter((h) => Number(h.value) > 0);
                const chartData = nonZeroHours.length > 0 ? nonZeroHours : allHours;
                return <VerticalBarChart data={chartData} valueFormatter={formatCurrency} />;
              })()
            )}
          </>
        )}

        {!modal.loading && !modal.error && modal.kind === 'salesReport' && (
          <>
            {(!modal.data?.items || modal.data.items.length === 0) ? (
              <p className="text-gray-600">No sales found for the selected range.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-800 font-medium">Revenue by item (sorted by revenue).</p>
                <HorizontalBarChart
                  data={(modal.data.items || []).slice(0, 12).map((it) => ({ label: it.itemName, value: it.revenue }))}
                  valueFormatter={formatCurrency}
                  height={320}
                />
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-700">
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2 pr-3 text-right">Qty Sold</th>
                        <th className="py-2 pr-3 text-right">Avg Unit Price</th>
                        <th className="py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(modal.data.items || []).slice(0, 20).map((it, idx) => (
                        <tr key={`${it.itemName}-${idx}`} className="border-b border-gray-100 text-gray-800">
                          <td className="py-2 pr-3">{it.itemName || 'Unnamed item'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{Number(it.quantitySold || 0)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(it.averageUnitPrice || 0)}</td>
                          <td className="py-2 text-right tabular-nums">{formatCurrency(it.revenue || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!modal.loading && !modal.error && modal.kind === 'zReport' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-4">
                <p className="text-gray-800 font-bold text-lg">End of day summary</p>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {[
                      ['Business day start', modal.data?.startAt],
                      ['Business day end', modal.data?.endAt],
                      ['Total sales', modal.data?.salesTotal != null ? formatCurrency(modal.data.salesTotal) : '—'],
                      ['Tax', modal.data?.taxAmount != null ? formatCurrency(modal.data.taxAmount) : '—'],
                      ['Sales count', modal.data?.salesCount != null ? String(modal.data.salesCount) : '—'],
                      ['Total cash', modal.data?.totalCash != null ? formatCurrency(modal.data.totalCash) : '—'],
                      ['Discounts', modal.data?.discounts != null ? formatCurrency(modal.data.discounts) : '$0.00'],
                      ['Voids', modal.data?.voids != null ? String(modal.data.voids) : '0'],
                      ['Service charges', modal.data?.serviceCharges != null ? formatCurrency(modal.data.serviceCharges) : '$0.00'],
                      ['Top item', modal.data?.topItem || 'N/A'],
                      ['Employee signature', modal.data?.employeeSignature || 'Manager'],
                    ].map(([metric, value]) => (
                      <tr key={metric} className="border-b border-stone-100">
                        <td className="py-2 pr-4 text-sm font-semibold text-gray-700">{metric}</td>
                        <td className="py-2 text-sm text-gray-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3">
                <p className="text-gray-800 font-bold">Payment methods</p>
                <DonutChart
                  data={(modal.data?.paymentMethods || []).map((pm) => ({
                    name: pm.methodName,
                    value: pm.totalAmount,
                  }))}
                />
                <VerticalBarChart
                  data={[
                    { label: 'Sales', value: Number(modal.data?.salesTotal || 0) },
                    { label: 'Tax', value: Number(modal.data?.taxAmount || 0) },
                    { label: 'Cash', value: Number(modal.data?.totalCash || 0) },
                  ]}
                  valueFormatter={formatCurrency}
                  height={240}
                />
                <p className="text-xs text-gray-500">Payment methods are inferred for legacy rows when explicit payment data is missing.</p>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
