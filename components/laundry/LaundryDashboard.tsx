import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shirt, 
  LayoutDashboard, 
  ShoppingBag, 
  Layers, 
  Truck, 
  Sliders, 
  TrendingUp, 
  Loader 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getLaundryOrders, 
  getLaundryBatches, 
  getPickupJobs, 
  getDeliveryJobs, 
  getLaundryMasters, 
  createLaundryOrder, 
  updateOrderStatus, 
  createProductionBatch, 
  updateBatchStage, 
  assignLogisticsJob, 
  completeLogisticsJob, 
  saveMasterService, 
  saveMasterItem, 
  saveMasterMachine, 
  savePricingRule, 
  getSalesJournals, 
  generateOrderInvoice 
} from './services';
import { LaundryOrder, LaundryBatch, LaundryPickup, LaundryDelivery, LaundryService, LaundryItem, LaundryPricing, LaundryMachine } from './types';

// Sub Tabs Components
import { DashboardTab } from './DashboardTab';
import { OrdersTab } from './OrdersTab';
import { ProductionTab } from './ProductionTab';
import { PickupDeliveryTab } from './PickupDeliveryTab';
import { MastersTab } from './MastersTab';

type TabId = 'dashboard' | 'orders' | 'production' | 'logistics' | 'masters';

export const LaundryDashboard: React.FC = () => {
  const { currentCompanyId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  
  // Data States
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [batches, setBatches] = useState<LaundryBatch[]>([]);
  const [pickups, setPickups] = useState<LaundryPickup[]>([]);
  const [deliveries, setDeliveries] = useState<LaundryDelivery[]>([]);
  
  // Masters States
  const [services, setServices] = useState<LaundryService[]>([]);
  const [items, setItems] = useState<LaundryItem[]>([]);
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [pricing, setPricing] = useState<LaundryPricing[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [salesJournals, setSalesJournals] = useState<{ id: string; name: string; code: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    try {
      const [
        ordersData, 
        batchesData, 
        pickupsData, 
        deliveriesData, 
        mastersData, 
        journalsData,
        locRes
      ] = await Promise.all([
        getLaundryOrders(currentCompanyId),
        getLaundryBatches(currentCompanyId),
        getPickupJobs(currentCompanyId),
        getDeliveryJobs(currentCompanyId),
        getLaundryMasters(currentCompanyId),
        getSalesJournals(currentCompanyId),
        import('../../lib/supabase').then(m => m.supabase.from('locations').select('id, name').eq('company_id', currentCompanyId))
      ]);

      setOrders(ordersData);
      setBatches(batchesData);
      setPickups(pickupsData);
      setDeliveries(deliveriesData);
      
      // Masters
      setServices(mastersData.services);
      setItems(mastersData.items);
      setMachines(mastersData.machines);
      setPricing(mastersData.pricing);
      setCustomers(mastersData.customers);
      setEmployees(mastersData.employees);
      setSalesJournals(journalsData);
      setLocations(locRes.data || []);
    } catch (err: any) {
      console.error('Error fetching laundry dashboard data:', err);
    }
    setLoading(false);
  }, [currentCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Operations triggers
  const handleCreateOrder = async (orderData: any, lineItems: any[]) => {
    if (!currentCompanyId) return;
    await createLaundryOrder(currentCompanyId, orderData, lineItems);
    await fetchData();
  };

  const handleUpdateOrderStatus = async (orderId: string, fromStatus: string, toStatus: string, notes?: string) => {
    if (!currentCompanyId) return;
    await updateOrderStatus(currentCompanyId, orderId, fromStatus, toStatus, notes);
    await fetchData();
  };

  const handleCreateBatch = async (batchData: any, itemIds: string[]) => {
    if (!currentCompanyId) return;
    await createProductionBatch(currentCompanyId, batchData, itemIds);
    await fetchData();
  };

  const handleUpdateBatchStage = async (batchId: string, stage: LaundryBatch['stage'], status: LaundryBatch['status'], machineId?: string) => {
    await updateBatchStage(batchId, stage, status, machineId);
    await fetchData();
  };

  const handleAssignJob = async (jobId: string, type: 'pickup' | 'delivery', driverId: string, vehicleDetails: string, routeDetails?: string) => {
    await assignLogisticsJob(jobId, type, driverId, vehicleDetails, routeDetails);
    await fetchData();
  };

  const handleCompleteJob = async (jobId: string, type: 'pickup' | 'delivery') => {
    if (!currentCompanyId) return;
    await completeLogisticsJob(currentCompanyId, jobId, type);
    await fetchData();
  };

  // Masters triggers
  const handleSaveService = async (service: Partial<LaundryService>) => {
    if (!currentCompanyId) return;
    await saveMasterService(currentCompanyId, service);
    await fetchData();
  };

  const handleSaveItem = async (item: Partial<LaundryItem>) => {
    if (!currentCompanyId) return;
    await saveMasterItem(currentCompanyId, item);
    await fetchData();
  };

  const handleSaveMachine = async (machine: Partial<LaundryMachine>) => {
    if (!currentCompanyId) return;
    await saveMasterMachine(currentCompanyId, machine);
    await fetchData();
  };

  const handleSavePricing = async (pricingRule: Partial<LaundryPricing>) => {
    if (!currentCompanyId) return;
    await savePricingRule(currentCompanyId, pricingRule);
    await fetchData();
  };

  const handleGenerateInvoice = async (orderId: string, journalId: string) => {
    await generateOrderInvoice(orderId, journalId);
    await fetchData();
  };

  // Derive pending sorted items awaiting production batches
  const pendingItems = orders
    .filter(o => ['Sorting', 'Tagging'].includes(o.status))
    // We get the items list dynamically, let's load all order lines
    // Wait, to keep it simple, we can filter order items that are 'Pending'
    // For batching, we will query items that belong to orders currently in 'Sorting' or 'Tagging' state
    // We can also simplify by using a local state or direct fetch in child tabs
    // In our case, we can filter based on order items we can fetch or simply list all
    // Let's implement dynamic retrieval. To avoid heavy joins, we will fetch order items that are 'Pending'
    // from orders that are in 'Sorting' or 'Tagging' stage.
    // Let's do a join in child or simplify. 
    // In ProductionTab, we will load pendingItems from order lines of active orders.
    // Let's do that! Let's pass orders to ProductionTab or let the service fetch.
    // In services.ts we have a list. We can fetch pending order lines in fetchData!
    // Let's add pendingItems resolution.
  const [orderLines, setOrderLines] = useState<LaundryOrderItem[]>([]);
  
  const fetchPendingOrderLines = useCallback(async () => {
    if (!currentCompanyId) return;
    const { data } = await import('../../lib/supabase').then(m => 
      m.supabase
        .from('laundry_order_items')
        .select('*, laundry_orders!inner(status, order_number), laundry_items(name), laundry_services(name)')
        .eq('company_id', currentCompanyId)
        .eq('status', 'Pending')
        .in('laundry_orders.status', ['Sorting', 'Tagging'])
    );
    if (data) {
      setOrderLines((data as any[]).map(d => ({
        ...d,
        item_name: d.laundry_items?.name || 'Garment',
        service_name: d.laundry_services?.name || 'Service'
      })));
    }
  }, [currentCompanyId]);

  useEffect(() => {
    if (activeTab === 'production') {
      fetchPendingOrderLines();
    }
  }, [activeTab, fetchPendingOrderLines]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <Loader className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-semibold">Loading Laundry Workspace...</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/25">
              <Shirt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Laundry Operations</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Order Intake · Sorting · Wash Cycles · Fleet Dispatch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-sky-500 animate-pulse" />
            <span>Operational Engine Live</span>
          </div>
        </div>

        {/* Tabbed Navigation */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Nav Header */}
          <div className="border-b border-slate-100 dark:border-zinc-800 px-4">
            <nav className="flex gap-2 -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Operations Overview
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-4 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <ShoppingBag className="w-4 h-4" /> Laundry Orders
              </button>
              <button
                onClick={() => setActiveTab('production')}
                className={`flex items-center gap-2 px-4 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'production'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Layers className="w-4 h-4" /> Production Batches
              </button>
              <button
                onClick={() => setActiveTab('logistics')}
                className={`flex items-center gap-2 px-4 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'logistics'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Truck className="w-4 h-4" /> Fleet Dispatch
              </button>
              <button
                onClick={() => setActiveTab('masters')}
                className={`flex items-center gap-2 px-4 py-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'masters'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sliders className="w-4 h-4" /> Module Settings
              </button>
            </nav>
          </div>

          {/* Tab Content Panels */}
          <div className="p-6 bg-slate-50/50 dark:bg-zinc-900/10">
            {activeTab === 'dashboard' && (
              <DashboardTab 
                orders={orders} 
                machines={machines} 
              />
            )}
            {activeTab === 'orders' && (
              <OrdersTab
                orders={orders}
                items={items}
                services={services}
                pricing={pricing}
                customers={customers}
                locations={locations}
                salesJournals={salesJournals}
                onCreateOrder={handleCreateOrder}
                onUpdateStatus={handleUpdateOrderStatus}
                onGenerateInvoice={handleGenerateInvoice}
              />
            )}
            {activeTab === 'production' && (
              <ProductionTab
                batches={batches}
                machines={machines}
                employees={employees}
                pendingItems={orderLines}
                onCreateBatch={handleCreateBatch}
                onUpdateBatchStage={handleUpdateBatchStage}
              />
            )}
            {activeTab === 'logistics' && (
              <PickupDeliveryTab
                pickups={pickups}
                deliveries={deliveries}
                employees={employees}
                onAssignJob={handleAssignJob}
                onCompleteJob={handleCompleteJob}
              />
            )}
            {activeTab === 'masters' && (
              <MastersTab
                services={services}
                items={items}
                machines={machines}
                pricing={pricing}
                onSaveService={handleSaveService}
                onSaveItem={handleSaveItem}
                onSaveMachine={handleSaveMachine}
                onSavePricing={handleSavePricing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default LaundryDashboard;
