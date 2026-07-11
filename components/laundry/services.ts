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
  LaundryMachine
} from './types';

// ==============================================================================
// ORDERS & ITEMS
// ==============================================================================

export const getLaundryOrders = async (companyId: string): Promise<LaundryOrder[]> => {
  const { data, error } = await supabase
    .from('laundry_orders')
    .select(`
      *,
      crm_customers:customer_id(name),
      locations:branch_id(name)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((d: any) => ({
    ...d,
    customer_name: d.crm_customers?.name || 'Unknown',
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
    supabase.from('crm_customers').select('id, name, customer_type').eq('company_id', companyId).order('name'),
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
    customers: custRes.data || [],
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

