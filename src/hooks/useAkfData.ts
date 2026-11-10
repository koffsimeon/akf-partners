import { useState, useEffect, useCallback } from 'react';
import {
  AuditLog,
  Client,
  DataSourceMode,
  DiagnosticResult,
  Order,
  Partner,
  Payment,
  Product,
  SyncState,
  SystemConfig,
  WaveConfig,
} from '../types';
import { INITIAL_CONFIG } from '../engine/akfEngine';

export interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

/**
 * Analyse sécurisée des réponses API pour éviter les plantages non-JSON (HTML 404/500)
 */
async function parseApiResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Point d'accès API introuvable (404). Vérifiez la configuration du serveur backend.");
      }
      throw new Error(`Erreur serveur (${res.status}) : ${text.slice(0, 100) || res.statusText}`);
    }
    throw new Error(`Format de réponse invalide reçu du serveur : ${text.slice(0, 80)}`);
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Erreur requête (${res.status})`);
  }

  return data;
}

export function useAkfData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<SystemConfig>(INITIAL_CONFIG);
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'SYNCHRONISE',
    lastSync: new Date().toISOString(),
    pendingCount: 0,
    errorCount: 0,
    errors: [],
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('SHEETS_LIVE');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const fetchSafeArray = async <T,>(url: string): Promise<T[]> => {
        try {
          const r = await fetch(url);
          if (!r.ok) return [];
          const text = await r.text();
          const data = text ? JSON.parse(text) : [];
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      };

      const [
        partnersRes,
        clientsRes,
        ordersRes,
        paymentsRes,
        productsRes,
        configRes,
        syncRes,
        logsRes,
        sheetsStatusRes,
      ] = await Promise.all([
        fetchSafeArray<Partner>('/api/partners'),
        fetchSafeArray<Client>('/api/clients'),
        fetchSafeArray<Order>('/api/orders'),
        fetchSafeArray<Payment>('/api/payments'),
        fetchSafeArray<Product>('/api/products'),
        fetch('/api/config').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/sync-state').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetchSafeArray<AuditLog>('/api/logs'),
        fetch('/api/sheets/status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      setPartners(partnersRes);
      setClients(clientsRes);
      setOrders(ordersRes);
      setPayments(paymentsRes);
      setProducts(productsRes);
      if (configRes && typeof configRes === 'object' && !configRes.error) {
        setConfig(configRes);
      }
      if (syncRes && typeof syncRes === 'object' && !syncRes.error) {
        setSyncState(syncRes);
      }
      setAuditLogs(logsRes);
      if (sheetsStatusRes && sheetsStatusRes.mode) {
        setDataSourceMode(sheetsStatusRes.mode);
      }
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setError('Impossible de joindre le serveur AKF. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronisation
  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await parseApiResponse(res);
      setSyncState(data.syncState);
      showToast('Synchronisation avec la base effectuée.');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erreur synchronisation', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Recalcul Global
  const handleRecalculate = async () => {
    try {
      const res = await fetch('/api/recalculate', { method: 'POST' });
      const data = await parseApiResponse(res);
      await fetchData();
      showToast(`Recalcul terminé : ${data.itemsCorrected} éléments ajustés.`);
      return data;
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du recalcul', 'error');
      throw err;
    }
  };

  // Actualisation ciblée des journaux d'audit
  const handleRefreshLogs = useCallback(async () => {
    try {
      const logsRes = await fetch('/api/logs').then((r) => (r.ok ? r.json() : []));
      setAuditLogs(Array.isArray(logsRes) ? logsRes : []);
    } catch (err) {
      console.error('Échec de rafraîchissement des journaux d’audit:', err);
    }
  }, []);

  // Diagnostic
  const handleRunDiagnostic = async (): Promise<DiagnosticResult> => {
    const res = await fetch('/api/diagnostic');
    return parseApiResponse<DiagnosticResult>(res);
  };

  // Partenaires
  const handleCreatePartner = async (formData: { fullName: string; phone: string; whatsapp?: string }) => {
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await parseApiResponse(res);
      showToast(`Partenaire ${data.code} créé avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleUpdatePartner = async (id: string, updates: Partial<Partner>) => {
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await parseApiResponse(res);
      showToast(`Partenaire ${data.code} mis à jour avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Clients
  const handleCreateClient = async (formData: {
    fullName: string;
    phone: string;
    whatsapp?: string;
    partnerId?: string;
  }) => {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await parseApiResponse(res);
      showToast(`Client ${data.id} créé avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleUpdateClient = async (clientId: string, updates: Partial<Client>) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Client ${clientId} mis à jour avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Client ${clientId} supprimé avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Commandes
  const handleCreateOrder = async (formData: {
    clientId: string;
    productId: string;
    quantity: number;
    unitPrice?: number;
    date?: string;
  }) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await parseApiResponse(res);
      showToast(`Commande ${data.id} enregistrée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Commande ${orderId} supprimée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, orderStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus }),
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Statut de la commande ${orderId} mis à jour : ${orderStatus}`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePromotePartner = async (partnerId: string) => {
    try {
      const res = await fetch(`/api/partners/${partnerId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Promotion confirmée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Paiements
  const handleCreatePayment = async (formData: {
    partnerId: string;
    amount: number;
    date?: string;
    paymentMethod: any;
    reference?: string;
    note?: string;
  }) => {
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await parseApiResponse(res);
      showToast(`Paiement ${data.id} de ${data.amount.toLocaleString()} FCFA confirmé !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Paiement ${paymentId} annulé.`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Produits
  const handleSaveProduct = async (productData: Product) => {
    try {
      const isEdit = Boolean(productData.id);
      const url = isEdit ? `/api/products/${productData.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Produit « ${data.product?.name || ''} » enregistré avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });
      const data = await parseApiResponse(res);
      showToast(data.message || 'Produit retiré du catalogue avec succès.');
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Vagues
  const handleSaveWave = async (waveData: WaveConfig) => {
    try {
      const res = await fetch('/api/waves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waveData),
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Vague « ${waveData.wave} » configurée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const handleActivateWave = async (waveName: string) => {
    try {
      const res = await fetch(`/api/waves/${encodeURIComponent(waveName)}/activate`, {
        method: 'POST',
      });
      const data = await parseApiResponse(res);
      showToast(data.message || `Vague ${waveName} activée avec succès !`);
      await fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  return {
    loading,
    error,
    toast,
    showToast,
    partners,
    clients,
    orders,
    payments,
    products,
    config,
    syncState,
    auditLogs,
    isSyncing,
    dataSourceMode,
    fetchData,
    handleSyncNow,
    handleRecalculate,
    handleRefreshLogs,
    handleRunDiagnostic,
    handleCreatePartner,
    handleUpdatePartner,
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient,
    handleCreateOrder,
    handleDeleteOrder,
    handleUpdateOrderStatus,
    handlePromotePartner,
    handleCreatePayment,
    handleDeletePayment,
    handleSaveProduct,
    handleDeleteProduct,
    handleSaveWave,
    handleActivateWave,
  };
}
