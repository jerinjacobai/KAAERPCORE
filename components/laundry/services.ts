import { supabase } from '../../lib/supabase';
import { 
  LaundryOrder, 
  LaundryOrderItem, 
  LaundryBatch, 
  LaundryPickup, 
  LaundryDelivery,
  LaundryService,
  LaundryItem,
  LaundryPricing,
  LaundryMachine,
  LaundryCustomer,
  LaundryClientEmployee
} from './types';

// ==============================================================================
// ORDERS & ITEMS
// ==============================================================================

export const getLaundryOrders = async (companyId: string): Promise<LaundryOrder[]> => {
  const { data, error } = await supabase
    .from('laundry_orders')
    .select(`
      *,
      laundry_customers:customer_id(name),
      locations:branch_id(name)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((d: any) => ({
    ...d,
    customer_name: d.laundry_customers?.name || 'Unknown',
    branch_name: d.locations?.name || 'Main Branch'
  }));
};

export const getOrderItems = async (orderId: string): Promise<LaundryOrderItem[]> => {
  const { data, error } = await supabase
    .from('laundry_order_items')
    .select(`
      *,
      laundry_items:item_id(name),
      laundry_services:service_id(name)
    `)
    .eq('order_id', orderId);

  if (error) throw error;

  return (data || []).map((d: any) => ({
    ...d,
    item_name: d.laundry_items?.name || 'Item',
    service_name: d.laundry_services?.name || 'Service'
  }));
};

export const createLaundryOrder = async (
  companyId: string,
  order: Omit<LaundryOrder, 'id' | 'created_at' | 'company_id' | 'order_number'>,
  items: Omit<LaundryOrderItem, 'id' | 'created_at' | 'company_id' | 'order_id' | 'total_price'>[]
): Promise<LaundryOrder> => {
  // 1. Generate Order Number
  const rand = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `LND-${new Date().getFullYear().toString().substr(-2)}${rand}`;

  // 2. Insert Order Header
  const { data: orderData, error: orderErr } = await supabase
    .from('laundry_orders')
    .insert({
      ...order,
      company_id: companyId,
      order_number: orderNumber,
      status: order.status || 'Order'
    })
    .select()
    .single();

  if (orderErr) throw orderErr;

  // 3. Insert Items
  const itemsToInsert = items.map(item => ({
    ...item,
    company_id: companyId,
    order_id: orderData.id,
    total_price: item.quantity * item.unit_price,
    status: 'Pending'
  }));

  const { error: itemsErr } = await supabase
    .from('laundry_order_items')
    .insert(itemsToInsert);

  if (itemsErr) {
    // Attempt rollback of header
    await supabase.from('laundry_orders').delete().eq('id', orderData.id);
    throw itemsErr;
  }

  // 4. Record status history
  await logOrderStatus(companyId, orderData.id, null, orderData.status, 'Order created');

  // 5. If pickup is needed, automatically create a pickup request
  if (order.status === 'Pickup') {
    await supabase.from('laundry_pickups').insert({
      company_id: companyId,
      order_id: orderData.id,
      status: 'Assigned',
      pickup_date: new Date().toISOString().split('T')[0]
    });
  }

  return orderData;
};

export const updateOrderStatus = async (
  companyId: string,
  orderId: string,
  fromStatus: string,
  toStatus: string,
  notes?: string
): Promise<void> => {
  const { error } = await supabase
    .from('laundry_orders')
    .update({ status: toStatus })
    .eq('id', orderId);

  if (error) throw error;

  await logOrderStatus(companyId, orderId, fromStatus, toStatus, notes);

  // Auto create delivery request when status changes to Delivery Assignment
  if (toStatus === 'Delivery Assignment') {
    const { data: check } = await supabase
      .from('laundry_deliveries')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!check) {
      await supabase.from('laundry_deliveries').insert({
        company_id: companyId,
        order_id: orderId,
        status: 'Assigned',
        delivery_date: new Date().toISOString().split('T')[0]
      });
    }
  }
};

const logOrderStatus = async (
  companyId: string,
  orderId: string,
  fromStatus: string | null,
  toStatus: string,
  notes?: string
): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  await supabase
    .from('laundry_status_history')
    .insert({
      company_id: companyId,
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      performed_by: userData.user?.id || null,
      notes: notes || ''
    });
};


// ==============================================================================
// PRODUCTION BATCHES
// ==============================================================================

export const getLaundryBatches = async (companyId: string): Promise<LaundryBatch[]> => {
  const { data, error } = await supabase
    .from('laundry_batches')
    .select(`
      *,
      laundry_machines:machine_id(name),
      employees:operator_id(name),
      laundry_batch_items(count)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((d: any) => ({
    ...d,
    machine_name: d.laundry_machines?.name || 'N/A',
    operator_name: d.employees?.name || 'N/A',
    items_count: d.laundry_batch_items?.[0]?.count || 0
  }));
};

export const createProductionBatch = async (
  companyId: string,
  batch: Omit<LaundryBatch, 'id' | 'created_at' | 'company_id' | 'batch_number' | 'status'>,
  orderItemIds: string[]
): Promise<LaundryBatch> => {
  const rand = Math.floor(100 + Math.random() * 900);
  const batchNo = `BAT-${new Date().getMonth() + 1}${rand}`;

  // 1. Create batch header
  const { data: batchData, error: batchErr } = await supabase
    .from('laundry_batches')
    .insert({
      ...batch,
      company_id: companyId,
      batch_number: batchNo,
      status: 'Active',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (batchErr) throw batchErr;

  // 2. Associate items
  const mappings = orderItemIds.map(id => ({
    company_id: companyId,
    batch_id: batchData.id,
    order_item_id: id
  }));

  const { error: mapErr } = await supabase
    .from('laundry_batch_items')
    .insert(mappings);

  if (mapErr) {
    await supabase.from('laundry_batches').delete().eq('id', batchData.id);
    throw mapErr;
  }

  // 3. Update status of items to Processing
  await supabase
    .from('laundry_order_items')
    .update({ status: 'Processing' })
    .in('id', orderItemIds);

  return batchData;
};

export const updateBatchStage = async (
  batchId: string,
  stage: LaundryBatch['stage'],
  status: LaundryBatch['status'],
  machineId?: string
): Promise<void> => {
  const updates: any = { stage, status };
  if (status === 'Completed') {
    updates.completed_at = new Date().toISOString();
  }
  if (machineId) {
    updates.machine_id = machineId;
  }

  const { error } = await supabase
    .from('laundry_batches')
    .update(updates)
    .eq('id', batchId);

  if (error) throw error;

  // If completed, update mapped order items
  if (status === 'Completed') {
    // 1. Fetch batch items
    const { data: mapped } = await supabase
      .from('laundry_batch_items')
      .select('order_item_id')
      .eq('batch_id', batchId);

    if (mapped && mapped.length > 0) {
      const ids = mapped.map((m: any) => m.order_item_id);
      
      // Update item status based on batch stage completed
      const finalStatus = stage === 'QC' ? 'QC Passed' : (stage === 'Packing' ? 'Completed' : 'Processing');
      await supabase
        .from('laundry_order_items')
        .update({ status: finalStatus })
        .in('id', ids);

      // If batch stage is QC, log default QC trace
      if (stage === 'QC') {
        const qcLogs = ids.map(id => ({
          order_item_id: id,
          check_status: 'Passed',
          comments: 'Auto-approved on batch completion'
        }));
        await supabase.from('laundry_quality_logs').insert(qcLogs);
      }
    }
  }
};


// ==============================================================================
// FLEET LOGISTICS
// ==============================================================================

export const getPickupJobs = async (companyId: string): Promise<LaundryPickup[]> => {
  const { data, error } = await supabase
    .from('laundry_pickups')
    .select(`
      *,
      laundry_orders:order_id(order_number),
      employees:driver_id(name)
    `)
    .eq('company_id', companyId);

  if (error) throw error;

  return (data || []).map((d: any) => ({
    ...d,
    order_number: d.laundry_orders?.order_number || 'Unknown',
    driver_name: d.employees?.name || 'Unassigned'
  }));
};

export const getDeliveryJobs = async (companyId: string): Promise<LaundryDelivery[]> => {
  const { data, error } = await supabase
    .from('laundry_deliveries')
    .select(`
      *,
      laundry_orders:order_id(order_number),
      employees:driver_id(name)
    `)
    .eq('company_id', companyId);

  if (error) throw error;

  return (data || []).map((d: any) => ({
    ...d,
    order_number: d.laundry_orders?.order_number || 'Unknown',
    driver_name: d.employees?.name || 'Unassigned'
  }));
};

export const assignLogisticsJob = async (
  jobId: string,
  type: 'pickup' | 'delivery',
  driverId: string,
  vehicleDetails: string,
  routeDetails?: string
): Promise<void> => {
  const table = type === 'pickup' ? 'laundry_pickups' : 'laundry_deliveries';
  
  const { error } = await supabase
    .from(table)
    .update({
      driver_id: driverId,
      vehicle_details: vehicleDetails,
      route_details: routeDetails || '',
      status: 'Transit'
    })
    .eq('id', jobId);

  if (error) throw error;

  // Also update Order status accordingly
  const { data: job } = await supabase.from(table).select('order_id').eq('id', jobId).single();
  if (job) {
    const nextStatus = type === 'pickup' ? 'Pickup' : 'Delivery';
    await supabase.from('laundry_orders').update({ status: nextStatus }).eq('id', job.order_id);
  }
};

export const completeLogisticsJob = async (
  companyId: string,
  jobId: string,
  type: 'pickup' | 'delivery'
): Promise<void> => {
  const table = type === 'pickup' ? 'laundry_pickups' : 'laundry_deliveries';

  const { error } = await supabase
    .from(table)
    .update({ status: 'Completed' })
    .eq('id', jobId);

  if (error) throw error;

  // Advance Order Status
  const { data: job } = await supabase.from(table).select('order_id').eq('id', jobId).single();
  if (job) {
    const nextStatus = type === 'pickup' ? 'Branch Receive' : 'Completed';
    await updateOrderStatus(companyId, job.order_id, type === 'pickup' ? 'Pickup' : 'Delivery', nextStatus, `${type} completed by fleet`);
  }
};


// ==============================================================================
// MASTERS MANAGEMENT
// ==============================================================================

export const getLaundryMasters = async (companyId: string) => {
  const [srvRes, itemRes, machRes, pricingRes, custRes, empRes] = await Promise.all([
    supabase.from('laundry_services').select('*').eq('company_id', companyId).order('name'),
    supabase.from('laundry_items').select('*').eq('company_id', companyId).order('name'),
    supabase.from('laundry_machines').select('*').eq('company_id', companyId).order('name'),
    supabase.from('laundry_pricing').select(`*, laundry_items(name), laundry_services(name)`).eq('company_id', companyId),
    supabase.from('laundry_customers').select('id, name, type').eq('company_id', companyId).order('name'),
    supabase.from('employees').select('id, name, role').eq('company_id', companyId).order('name')
  ]);

  if (srvRes.error) throw srvRes.error;
  if (itemRes.error) throw itemRes.error;
  if (machRes.error) throw machRes.error;
  if (pricingRes.error) throw pricingRes.error;

  return {
    services: srvRes.data || [],
    items: itemRes.data || [],
    machines: machRes.data || [],
    pricing: (pricingRes.data || []).map((p: any) => ({
      ...p,
      item_name: p.laundry_items?.name || 'Unknown Item',
      service_name: p.laundry_services?.name || 'Unknown Service'
    })),
    customers: (custRes.data || []).map((c: any) => ({ id: c.id, name: c.name, customer_type: c.type })),
    employees: empRes.data || []
  };
};

export const saveMasterService = async (companyId: string, service: Partial<LaundryService>): Promise<void> => {
  if (service.id) {
    const { error } = await supabase.from('laundry_services').update(service).eq('id', service.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('laundry_services').insert({ ...service, company_id: companyId });
    if (error) throw error;
  }
};

export const saveMasterItem = async (companyId: string, item: Partial<LaundryItem>): Promise<void> => {
  if (item.id) {
    const { error } = await supabase.from('laundry_items').update(item).eq('id', item.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('laundry_items').insert({ ...item, company_id: companyId });
    if (error) throw error;
  }
};

export const saveMasterMachine = async (companyId: string, machine: Partial<LaundryMachine>): Promise<void> => {
  if (machine.id) {
    const { error } = await supabase.from('laundry_machines').update(machine).eq('id', machine.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('laundry_machines').insert({ ...machine, company_id: companyId });
    if (error) throw error;
  }
};

export const savePricingRule = async (companyId: string, pricing: Partial<LaundryPricing>): Promise<void> => {
  if (pricing.id) {
    const { error } = await supabase.from('laundry_pricing').update(pricing).eq('id', pricing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('laundry_pricing').insert({ ...pricing, company_id: companyId });
    if (error) throw error;
  }
};


// ==============================================================================
// ACCOUNTING INTEGRATION
// ==============================================================================

export const getSalesJournals = async (companyId: string) => {
  const { data, error } = await supabase
    .from('journals')
    .select('id, name, code')
    .eq('company_id', companyId)
    .eq('type', 'Sale');

  if (error) throw error;
  return data || [];
};

export const generateOrderInvoice = async (orderId: string, journalId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('rpc_create_laundry_invoice', {
    p_order_id: orderId,
    p_journal_id: journalId
  });

  if (error) throw error;
  return data as string; // Returns the invoice entry UUID
};

// ==============================================================================
// INVENTORY CONSUMPTION INTEGRATION
// ==============================================================================

export const getInventoryItems = async (companyId: string) => {
  const { data, error } = await supabase
    .from('item_master')
    .select('id, code, name, uom')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw error;
  return data || [];
};

export const getWarehouseBins = async (companyId: string) => {
  const { data, error } = await supabase
    .from('warehouse_bins')
    .select('id, name')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw error;
  return data || [];
};

export const consumeSupply = async (
  companyId: string,
  itemId: string,
  quantity: number,
  binId: string,
  reference: string
): Promise<void> => {
  const { error } = await supabase.rpc('rpc_process_stock_movement', {
    p_company_id: companyId,
    p_item_id: itemId,
    p_movement_type: 'OUT',
    p_from_bin_id: binId,
    p_to_bin_id: null,
    p_qty: quantity,
    p_ref_type: 'Laundry Batch Consumption',
    p_ref_id: null, // No specific uuid, or we pass null
    p_unit_cost: 0
  });

  if (error) throw error;
};

// ==============================================================================
// PHASE 2 EXTENSIONS SERVICES
// ==============================================================================

export const getCustomerWallet = async (companyId: string, customerId: string) => {
  const { data, error } = await supabase
    .from('laundry_wallets')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const adjustWalletBalance = async (
  companyId: string,
  customerId: string,
  amount: number,
  type: 'Deposit' | 'Deduction' | 'Refund' | 'LoyaltyCredit',
  description: string
): Promise<void> => {
  // First, find or create the wallet
  let { data: wallet, error: getErr } = await supabase
    .from('laundry_wallets')
    .select('id, balance')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (getErr) throw getErr;

  let walletId = wallet?.id;

  if (!wallet) {
    const { data: newWallet, error: createErr } = await supabase
      .from('laundry_wallets')
      .insert({
        company_id: companyId,
        customer_id: customerId,
        balance: 0.00,
        loyalty_points: 0
      })
      .select('id, balance')
      .single();

    if (createErr) throw createErr;
    wallet = newWallet;
    walletId = newWallet.id;
  }

  const currentBalance = Number(wallet.balance);
  const newBalance = type === 'Deduction' ? currentBalance - amount : currentBalance + amount;

  // Insert Transaction
  const { error: txErr } = await supabase
    .from('laundry_wallet_transactions')
    .insert({
      company_id: companyId,
      wallet_id: walletId,
      amount,
      transaction_type: type,
      description
    });

  if (txErr) throw txErr;

  // Update Wallet Balance
  const { error: updateErr } = await supabase
    .from('laundry_wallets')
    .update({ balance: newBalance })
    .eq('id', walletId);

  if (updateErr) throw updateErr;
};

export const getCorporateContracts = async (companyId: string) => {
  const { data, error } = await supabase
    .from('laundry_contracts')
    .select('*, customer:laundry_customers(name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    customer_name: d.customer?.name || 'Unknown'
  }));
};

export const saveCorporateContract = async (companyId: string, contract: any) => {
  if (contract.id) {
    const { error } = await supabase
      .from('laundry_contracts')
      .update(contract)
      .eq('id', contract.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('laundry_contracts')
      .insert({ ...contract, company_id: companyId });
    if (error) throw error;
  }
};

export const getMaintenanceLogs = async (companyId: string, machineId: string) => {
  const { data, error } = await supabase
    .from('laundry_maintenance')
    .select('*')
    .eq('company_id', companyId)
    .eq('machine_id', machineId)
    .order('performed_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createMaintenanceLog = async (companyId: string, log: any) => {
  const { error } = await supabase
    .from('laundry_maintenance')
    .insert({ ...log, company_id: companyId });

  if (error) throw error;

  // If a breakdown or AMC is scheduled, update the machine status
  if (log.type === 'Breakdown' || log.type === 'AMC') {
    const nextStatus = log.type === 'Breakdown' ? 'Breakdown' : 'Maintenance';
    await supabase
      .from('laundry_machines')
      .update({ status: nextStatus })
      .eq('id', log.machine_id);
  } else if (log.type === 'Preventive' || log.type === 'AMC') {
    // Rerun check to see if we set back to Idle
    await supabase
      .from('laundry_machines')
      .update({ status: 'Idle' })
      .eq('id', log.machine_id);
  }
};

export const getDriverShifts = async (companyId: string) => {
  const { data, error } = await supabase
    .from('laundry_driver_shifts')
    .select('*, driver:employees(name)')
    .eq('company_id', companyId)
    .order('shift_date', { ascending: false });

  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    driver_name: d.driver?.name || 'Driver'
  }));
};

export const saveDriverShift = async (companyId: string, shift: any) => {
  if (shift.id) {
    const { error } = await supabase
      .from('laundry_driver_shifts')
      .update(shift)
      .eq('id', shift.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('laundry_driver_shifts')
      .insert({ ...shift, company_id: companyId });
    if (error) throw error;
  }
};

// ==============================================================================
// PHASE 3 EXTENSIONS SERVICES
// ==============================================================================

export const getLaundryVehicles = async (companyId: string) => {
  const { data, error } = await supabase
    .from('laundry_vehicles')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const saveLaundryVehicle = async (companyId: string, vehicle: any) => {
  if (vehicle.id) {
    const { error } = await supabase
      .from('laundry_vehicles')
      .update(vehicle)
      .eq('id', vehicle.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('laundry_vehicles')
      .insert({ ...vehicle, company_id: companyId });
    if (error) throw error;
  }
};

export const getFuelLogs = async (companyId: string, vehicleId: string) => {
  const { data, error } = await supabase
    .from('laundry_fuel_logs')
    .select('*')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const addFuelLog = async (companyId: string, log: any) => {
  const { error } = await supabase
    .from('laundry_fuel_logs')
    .insert({ ...log, company_id: companyId });

  if (error) throw error;

  // Also update vehicle current_mileage to the odometer reading of the fuel log
  const { error: vehErr } = await supabase
    .from('laundry_vehicles')
    .update({ current_mileage: log.odometer })
    .eq('id', log.vehicle_id);

  if (vehErr) throw vehErr;
};

export const getGPSHistory = async (companyId: string, jobId: string, jobType: string) => {
  const { data, error } = await supabase
    .from('laundry_gps_history')
    .select('*')
    .eq('company_id', companyId)
    .eq('job_id', jobId)
    .eq('job_type', jobType)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const addGPSCoordinate = async (companyId: string, coordinate: any) => {
  const { error } = await supabase
    .from('laundry_gps_history')
    .insert({ ...coordinate, company_id: companyId });

  if (error) throw error;
};

export const getLaundryFeedback = async (companyId: string) => {
  const { data, error } = await supabase
    .from('laundry_feedback')
    .select('*, customer:laundry_customers(name), order:laundry_orders(order_number)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    customer_name: d.customer?.name || 'Unknown',
    order_number: d.order?.order_number || 'Unknown'
  }));
};

export const saveLaundryFeedback = async (companyId: string, feedback: any) => {
  const { error } = await supabase
    .from('laundry_feedback')
    .insert({ ...feedback, company_id: companyId });

  if (error) throw error;
};

// ==============================================================================
// MOBILE PORTAL API MOCKUPS
// ==============================================================================

export const getMobileDriverJobs = async (companyId: string, driverId: string) => {
  // Fetch pickups
  const { data: pickups, error: pickErr } = await supabase
    .from('laundry_pickups')
    .select('*, customer:laundry_customers(name, phone:mobile)')
    .eq('company_id', companyId)
    .eq('driver_id', driverId)
    .neq('status', 'Completed');

  if (pickErr) throw pickErr;

  // Fetch deliveries
  const { data: deliveries, error: delErr } = await supabase
    .from('laundry_deliveries')
    .select('*, order:laundry_orders(order_number, total_amount), customer:laundry_customers(name, phone:mobile)')
    .eq('company_id', companyId)
    .eq('driver_id', driverId)
    .neq('status', 'Completed');

  if (delErr) throw delErr;

  return {
    pickups: (pickups || []).map(p => ({
      id: p.id,
      type: 'pickup',
      status: p.status,
      date: p.pickup_date,
      customer_name: p.customer?.name || 'Unknown',
      phone: p.customer?.phone || '',
      address: p.route_details || ''
    })),
    deliveries: (deliveries || []).map(d => ({
      id: d.id,
      type: 'delivery',
      status: d.status,
      date: d.delivery_date,
      order_number: d.order?.order_number || 'Unknown',
      amount: d.order?.total_amount || 0,
      customer_name: d.customer?.name || 'Unknown',
      phone: d.customer?.phone || '',
      address: d.route_details || ''
    }))
  };
};

export const updateMobileJobStatus = async (
  companyId: string,
  jobId: string,
  jobType: 'pickup' | 'delivery',
  status: string
) => {
  if (jobType === 'pickup') {
    const { error } = await supabase
      .from('laundry_pickups')
      .update({ status })
      .eq('id', jobId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('laundry_deliveries')
      .update({ status })
      .eq('id', jobId);
    if (error) throw error;
  }
};

export const getCustomerMobileOrders = async (companyId: string, customerId: string) => {
  const { data, error } = await supabase
    .from('laundry_orders')
    .select('*')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// ==============================================================================
// STANDALONE MASTERS (CUSTOMERS & CLIENT EMPLOYEES)
// ==============================================================================

export const getLaundryCustomers = async (companyId: string): Promise<LaundryCustomer[]> => {
  const { data, error } = await supabase
    .from('laundry_customers')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const saveLaundryCustomer = async (companyId: string, customer: any): Promise<void> => {
  if (customer.id) {
    const { error } = await supabase
      .from('laundry_customers')
      .update(customer)
      .eq('id', customer.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('laundry_customers')
      .insert({ ...customer, company_id: companyId });
    if (error) throw error;
  }
};

export const deleteLaundryCustomer = async (companyId: string, id: string): Promise<void> => {
  const { error } = await supabase
    .from('laundry_customers')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const getLaundryClientEmployees = async (companyId: string): Promise<LaundryClientEmployee[]> => {
  const { data, error } = await supabase
    .from('laundry_client_employees')
    .select('*, customer:laundry_customers(name)')
    .eq('company_id', companyId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    client_customer_name: d.customer?.name || 'Unknown'
  }));
};

export const saveLaundryClientEmployee = async (companyId: string, employee: any): Promise<void> => {
  if (employee.id) {
    const { error } = await supabase
      .from('laundry_client_employees')
      .update(employee)
      .eq('id', employee.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('laundry_client_employees')
      .insert({ ...employee, company_id: companyId });
    if (error) throw error;
  }
};

export const deleteLaundryClientEmployee = async (companyId: string, id: string): Promise<void> => {
  const { error } = await supabase
    .from('laundry_client_employees')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const seedLaundryDemoData = async (companyId: string): Promise<void> => {
  // 1. Seed standard customers
  const demoCustomers = [
    { name: 'QDS Corporates', type: 'Corporate', mobile: '+974 5550 1234', email: 'intake@qds.qa', status: 'Active' },
    { name: 'Sheraton Doha', type: 'Hotels', mobile: '+974 4485 4444', email: 'laundry@sheraton.com', status: 'Active' },
    { name: 'Qatar Airways staff', type: 'Corporate', mobile: '+974 4449 6000', email: 'crewlaundry@qatarairways.com.qa', status: 'Active' },
    { name: 'Jacob Individial', type: 'Individual', mobile: '+974 7777 8888', email: 'jacob@dream11.com', status: 'Active' }
  ];

  for (const cust of demoCustomers) {
    const { data } = await supabase
      .from('laundry_customers')
      .select('id')
      .eq('company_id', companyId)
      .eq('name', cust.name)
      .maybeSingle();

    if (!data) {
      await supabase
        .from('laundry_customers')
        .insert({ ...cust, company_id: companyId });
    }
  }

  // Fetch QDS and QA customer IDs
  const { data: qdsCust } = await supabase
    .from('laundry_customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', 'QDS Corporates')
    .single();

  const { data: qaCust } = await supabase
    .from('laundry_customers')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', 'Qatar Airways staff')
    .single();

  // 2. Seed client employees
  if (qdsCust) {
    const qdsEmployees = [
      { name: 'Thennarasu', employee_no: '24535', mobile: '+974 5551 2345', room_no: '17', building_no: '120', client_customer_id: qdsCust.id },
      { name: 'Jerin Jacob', employee_no: '24670', mobile: '+974 5557 8901', room_no: '22', building_no: '120', client_customer_id: qdsCust.id }
    ];

    for (const emp of qdsEmployees) {
      const { data } = await supabase
        .from('laundry_client_employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('client_customer_id', qdsCust.id)
        .eq('employee_no', emp.employee_no)
        .maybeSingle();

      if (!data) {
        await supabase
          .from('laundry_client_employees')
          .insert({ ...emp, company_id: companyId });
      }
    }
  }

  if (qaCust) {
    const qaEmployees = [
      { name: 'Jacob Mathew', employee_no: '10892', mobile: '+974 5554 3210', room_no: '104', building_no: '4', client_customer_id: qaCust.id },
      { name: 'Nidhin Joseph', employee_no: '10905', mobile: '+974 5558 8776', room_no: '202', building_no: '6', client_customer_id: qaCust.id }
    ];

    for (const emp of qaEmployees) {
      const { data } = await supabase
        .from('laundry_client_employees')
        .select('id')
        .eq('company_id', companyId)
        .eq('client_customer_id', qaCust.id)
        .eq('employee_no', emp.employee_no)
        .maybeSingle();

      if (!data) {
        await supabase
          .from('laundry_client_employees')
          .insert({ ...emp, company_id: companyId });
      }
    }
  }
};


export const saveMasterEmployee = async (companyId: string, employee: any) => {
  if (employee.id) {
    const { error } = await supabase.from('employees').update(employee).eq('id', employee.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('employees').insert({ ...employee, company_id: companyId });
    if (error) throw error;
  }
};

export const deleteMasterEmployee = async (companyId: string, employeeId: string) => {
  const { error } = await supabase.from('employees').delete().eq('id', employeeId);
  if (error) throw error;
};

export const deleteLaundryVehicle = async (companyId: string, id: string) => {
  const { error } = await supabase.from('laundry_vehicles').delete().eq('id', id);
  if (error) throw error;
};


