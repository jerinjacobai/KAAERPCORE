export interface LaundryService {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  code: string;
  description?: string;
  category: string;
  status: string;
}

export interface LaundryItem {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  code: string;
  category: string;
  status: string;
}

export interface LaundryPricing {
  id: string;
  created_at: string;
  company_id: string;
  item_id: string;
  service_id: string;
  unit_price: number;
  express_price: number;
  status: string;
  branch_id?: string;
  // Joined fields
  item?: LaundryItem;
  service?: LaundryService;
}

export interface LaundryCustomer {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  mobile?: string;
  email?: string;
  type: 'Individual' | 'Corporate' | 'Hotels' | 'Hospitals' | 'Factories' | 'Restaurants' | 'Uniform Contracts';
  status: string;
}

export interface LaundryClientEmployee {
  id: string;
  created_at: string;
  company_id: string;
  client_customer_id: string;
  name: string;
  employee_no: string;
  mobile?: string;
  room_no?: string;
  building_no?: string;
  status: string;
  // Joined field
  client_customer_name?: string;
}

export interface LaundryCustomerProfile {
  id: string;
  created_at: string;
  company_id: string;
  customer_id: string;
  laundry_customer_type: 'Individual' | 'Corporate' | 'Hotels' | 'Hospitals' | 'Factories' | 'Restaurants' | 'Uniform Contracts';
  special_instructions?: string;
  discount_percentage: number;
  is_contract_billing: boolean;
  status: string;
}

export interface LaundryMachine {
  id: string;
  created_at: string;
  company_id: string;
  name: string;
  code: string;
  type: 'Washer' | 'Dryer' | 'Steam Press' | 'Boiler' | 'Folder' | 'Packaging';
  capacity?: string;
  utilization: number;
  status: 'Idle' | 'Running' | 'Maintenance' | 'Breakdown';
  branch_id?: string;
}

export interface LaundryOrder {
  id: string;
  created_at: string;
  company_id: string;
  branch_id?: string;
  customer_id: string;
  order_number: string;
  channel: string;
  status: 'Order' | 'Pickup' | 'Branch Receive' | 'Sorting' | 'Tagging' | 'Production Batch' | 'Washing' | 'Drying' | 'Ironing' | 'Quality' | 'Packing' | 'Storage' | 'Delivery Assignment' | 'Delivery' | 'Invoice' | 'Completed' | 'Cancelled';
  priority: 'Standard' | 'Express' | 'Urgent';
  due_date?: string;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_status: 'Unpaid' | 'Partially Paid' | 'Paid';
  accounting_invoice_id?: string;
  created_by?: string;
  notes?: string;
  // Paper Slip Metadata
  receipt_no?: string;
  client_employee_name?: string;
  client_employee_no?: string;
  room_no?: string;
  building_no?: string;
  client_mobile?: string;
  // Joined fields
  customer_name?: string;
  branch_name?: string;
  items_count?: number;
}

export interface LaundryOrderItem {
  id: string;
  created_at: string;
  company_id: string;
  order_id: string;
  item_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'Pending' | 'Processing' | 'QC Passed' | 'QC Failed' | 'Rewash' | 'Completed';
  barcode?: string;
  notes?: string;
  // Paper Slip Column Counts
  qty_issued: number;
  qty_recv: number;
  qty_ret: number;
  qty_ack: number;
  // Joined fields
  item_name?: string;
  service_name?: string;
}

export interface LaundryPickup {
  id: string;
  created_at: string;
  company_id: string;
  order_id: string;
  driver_id?: string;
  vehicle_details?: string;
  status: 'Assigned' | 'Transit' | 'Completed' | 'Failed';
  pickup_date?: string;
  route_details?: string;
  notes?: string;
  // Joined
  order_number?: string;
  driver_name?: string;
}

export interface LaundryDelivery {
  id: string;
  created_at: string;
  company_id: string;
  order_id: string;
  driver_id?: string;
  vehicle_details?: string;
  status: 'Assigned' | 'Transit' | 'Completed' | 'Failed';
  delivery_date?: string;
  route_details?: string;
  notes?: string;
  // Joined
  order_number?: string;
  driver_name?: string;
}

export interface LaundryBatch {
  id: string;
  created_at: string;
  company_id: string;
  batch_number: string;
  stage: 'Sorting' | 'Tagging' | 'Washing' | 'Drying' | 'Ironing' | 'QC' | 'Packing';
  status: 'Active' | 'In Progress' | 'Completed' | 'Cancelled';
  machine_id?: string;
  operator_id?: string;
  started_at?: string;
  completed_at?: string;
  // Joined
  machine_name?: string;
  operator_name?: string;
  items_count?: number;
}
