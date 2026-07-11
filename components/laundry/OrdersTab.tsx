import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  Trash2, 
  MapPin, 
  DollarSign, 
  Clock, 
  CheckCircle,
  FileText,
  User,
  ShoppingBag
} from 'lucide-react';
import { LaundryOrder, LaundryOrderItem, LaundryService, LaundryItem, LaundryPricing } from './types';

interface OrdersTabProps {
  orders: LaundryOrder[];
  items: LaundryItem[];
  services: LaundryService[];
  pricing: LaundryPricing[];
  customers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  salesJournals: { id: string; name: string; code: string }[];
  onCreateOrder: (order: any, items: any[]) => Promise<void>;
  onUpdateStatus: (orderId: string, fromStatus: string, toStatus: string, notes?: string) => Promise<void>;
  onGenerateInvoice: (orderId: string, journalId: string) => Promise<void>;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  items,
  services,
  pricing,
  customers,
  locations,
  salesJournals,
  onCreateOrder,
  onUpdateStatus,
  onGenerateInvoice
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selected Order details
  const [selectedOrder, setSelectedOrder] = useState<LaundryOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<LaundryOrderItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // New Order Dialog
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [customer_id, setCustomerId] = useState('');
  const [branch_id, setBranchId] = useState('');
  const [channel, setChannel] = useState('Walk-in');
  const [priority, setPriority] = useState<'Standard' | 'Express' | 'Urgent'>('Standard');
  const [due_date, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [orderLines, setOrderLines] = useState<{ item_id: string; service_id: string; quantity: number; unit_price: number }[]>([
    { item_id: '', service_id: '', quantity: 1, unit_price: 0 }
  ]);

  // Invoice Dialog
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState('');

  const handleSelectOrder = async (order: LaundryOrder) => {
    setSelectedOrder(order);
    setIsLoadingItems(true);
    try {
      const { getOrderItems } = await import('./services');
      const data = await getOrderItems(order.id);
      setSelectedOrderItems(data);
    } catch (err: any) {
      alert('Error fetching items: ' + err.message);
    }
    setIsLoadingItems(false);
  };

  const handlePricingLookup = (itemId: string, serviceId: string): number => {
    const rate = pricing.find(p => p.item_id === itemId && p.service_id === serviceId);
    if (!rate) return 0;
    return priority === 'Express' || priority === 'Urgent' ? Number(rate.express_price) : Number(rate.unit_price);
  };

  const handleLineChange = (index: number, key: string, val: any) => {
    const updated = [...orderLines];
    updated[index] = { ...updated[index], [key]: val };
    
    // Auto-update price if item or service changed
    if (key === 'item_id' || key === 'service_id') {
      const itemId = key === 'item_id' ? val : updated[index].item_id;
      const serviceId = key === 'service_id' ? val : updated[index].service_id;
      if (itemId && serviceId) {
        updated[index].unit_price = handlePricingLookup(itemId, serviceId);
      }
    }
    setOrderLines(updated);
  };

  const handleAddLine = () => {
    setOrderLines([...orderLines, { item_id: '', service_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer_id) {
      alert('Please select a customer.');
      return;
    }
    
    // Calculate total amount
    const total = orderLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);

    try {
      await onCreateOrder({
        customer_id,
        branch_id: branch_id || null,
        channel,
        priority,
        due_date: due_date || null,
        notes,
        total_amount: total,
        status: priority === 'Standard' ? 'Order' : 'Pickup' // Express/Urgent orders typically start with Pickup request
      }, orderLines);
      
      setIsNewOpen(false);
      // Reset form
      setCustomerId('');
      setBranchId('');
      setChannel('Walk-in');
      setPriority('Standard');
      setDueDate('');
      setNotes('');
      setOrderLines([{ item_id: '', service_id: '', quantity: 1, unit_price: 0 }]);
    } catch (err: any) {
      alert('Error creating order: ' + err.message);
    }
  };

  const handleStatusTransition = async (nextStatus: LaundryOrder['status']) => {
    if (!selectedOrder) return;
    try {
      await onUpdateStatus(selectedOrder.id, selectedOrder.status, nextStatus, `Updated to ${nextStatus}`);
      setSelectedOrder({ ...selectedOrder, status: nextStatus });
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleGenerateInvoiceClick = () => {
    if (salesJournals.length > 0) {
      setSelectedJournalId(salesJournals[0].id);
    }
    setIsInvoiceOpen(true);
  };

  const handleConfirmInvoice = async () => {
    if (!selectedOrder || !selectedJournalId) return;
    try {
      await onGenerateInvoice(selectedOrder.id, selectedJournalId);
      setIsInvoiceOpen(false);
      setSelectedOrder({ ...selectedOrder, status: 'Invoice' });
      alert('Accounting Invoice provisioned successfully!');
    } catch (err: any) {
      alert('Error provisioning invoice: ' + err.message);
    }
  };

  // Filter logic
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = channelFilter ? o.channel === channelFilter : true;
    const matchesStatus = statusFilter ? o.status === statusFilter : true;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-3 flex-1 max-w-2xl">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by order no. or customer..."
              className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white shadow-sm"
            />
          </div>
          
          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="px-4 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none text-slate-500 shadow-sm"
          >
            <option value="">All Channels</option>
            <option value="Walk-in">Walk-in</option>
            <option value="Corporate">Corporate</option>
            <option value="Online">Online</option>
            <option value="WhatsApp">WhatsApp</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none text-slate-500 shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="Order">Order Intake</option>
            <option value="Pickup">Pickup Assigned</option>
            <option value="Branch Receive">Branch Receive</option>
            <option value="Sorting">Sorting & Tagging</option>
            <option value="Washing">Washing</option>
            <option value="Ironing">Ironing</option>
            <option value="Storage">Storage</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <button
          onClick={() => setIsNewOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 whitespace-nowrap self-stretch md:self-auto"
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Order List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Order No</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Due Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                {filteredOrders.map(order => {
                  const statusColors = {
                    Order: 'bg-blue-50 text-blue-600 dark:bg-blue-950/20',
                    Pickup: 'bg-sky-50 text-sky-600 dark:bg-sky-950/20',
                    Washing: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20',
                    Completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20',
                    Invoice: 'bg-purple-50 text-purple-600 dark:bg-purple-950/20'
                  };
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => handleSelectOrder(order)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : ''}`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{order.order_number}</td>
                      <td className="px-6 py-4">{order.customer_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusColors[order.status] || 'bg-slate-100 text-slate-500 dark:bg-zinc-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{order.due_date || 'N/A'}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">QAR {Number(order.total_amount).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Details panel */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm h-fit space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-500" /> Order Details
          </h3>

          {selectedOrder ? (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="space-y-2 border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Order Number</span>
                  <span className="font-bold text-slate-800 dark:text-white">{selectedOrder.order_number}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Channel</span>
                  <span className="font-bold text-slate-600 dark:text-slate-300">{selectedOrder.channel}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Priority</span>
                  <span className={`font-bold ${selectedOrder.priority === 'Standard' ? 'text-slate-500' : 'text-amber-500'}`}>{selectedOrder.priority}</span>
                </div>
                {selectedOrder.notes && (
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100/50 dark:border-zinc-800/50">
                    <span className="font-bold block mb-0.5 text-slate-500 dark:text-slate-400">Notes:</span>
                    {selectedOrder.notes}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Garments Log</span>
                {isLoadingItems ? (
                  <div className="text-center text-slate-400 text-xs py-4">Loading items...</div>
                ) : (
                  <div className="space-y-2">
                    {selectedOrderItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <div>
                          <span>{item.item_name}</span>
                          <span className="block text-[9px] text-slate-400 font-medium">{item.service_name} • Qty: {item.quantity}</span>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-white">QAR {Number(item.total_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Flows */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operational Action Flow</span>
                
                {selectedOrder.status === 'Order' && (
                  <button
                    onClick={() => handleStatusTransition('Pickup')}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-95"
                  >
                    Request Pickup Driver
                  </button>
                )}

                {selectedOrder.status === 'Branch Receive' && (
                  <button
                    onClick={() => handleStatusTransition('Sorting')}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-95"
                  >
                    Start Sorting &amp; Tagging
                  </button>
                )}

                {selectedOrder.status === 'Sorting' && (
                  <button
                    onClick={() => handleStatusTransition('Production Batch')}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-95"
                  >
                    Assign to Production Batch
                  </button>
                )}

                {selectedOrder.status === 'Storage' && (
                  <button
                    onClick={() => handleStatusTransition('Delivery Assignment')}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-95"
                  >
                    Assign Delivery Dispatcher
                  </button>
                )}

                {selectedOrder.status === 'Packing' && (
                  <button
                    onClick={() => handleStatusTransition('Storage')}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-95"
                  >
                    Mark Ready (Move to Storage)
                  </button>
                )}

                {/* Billing Integration Button */}
                {selectedOrder.status === 'Completed' && !selectedOrder.accounting_invoice_id && (
                  <button
                    onClick={handleGenerateInvoiceClick}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <FileText className="w-4 h-4" /> Generate Accounting Invoice
                  </button>
                )}

                {selectedOrder.accounting_invoice_id && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-xs font-bold rounded-2xl text-center border border-emerald-100/50 dark:border-emerald-900/30">
                    Billed under Invoice Move ID: {selectedOrder.accounting_invoice_id.substring(0,8)}...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-6 text-center">
              Please choose an order from the list to view garments details and progress workflows.
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal Dialog */}
      {isNewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh] animate-slide-up">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">Create Laundry Order</h3>
            
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select CRM Customer</label>
                  <select
                    required
                    value={customer_id}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="">-- Choose customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Branch</label>
                  <select
                    value={branch_id}
                    onChange={e => setBranchId(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="">-- Choose branch --</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channel</label>
                  <select
                    value={channel}
                    onChange={e => setChannel(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Online">Online</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Phone">Phone</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={priority}
                    onChange={e => {
                      setPriority(e.target.value as any);
                      // Update pricing on index change
                      const updated = orderLines.map(l => {
                        if (l.item_id && l.service_id) {
                          const rate = pricing.find(p => p.item_id === l.item_id && p.service_id === l.service_id);
                          const price = e.target.value === 'Express' || e.target.value === 'Urgent' 
                            ? Number(rate?.express_price || 0) 
                            : Number(rate?.unit_price || 0);
                          return { ...l, unit_price: price };
                        }
                        return l;
                      });
                      setOrderLines(updated);
                    }}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Express">Express</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    value={due_date}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Order Lines */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    + Add Item
                  </button>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderLines.map((line, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Garment Type</label>
                        <select
                          required
                          value={line.item_id}
                          onChange={e => handleLineChange(idx, 'item_id', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50"
                        >
                          <option value="">Select garment</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Cleaning Service</label>
                        <select
                          required
                          value={line.service_id}
                          onChange={e => handleLineChange(idx, 'service_id', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50"
                        >
                          <option value="">Select service</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-16 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Qty</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={line.quantity}
                          onChange={e => handleLineChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-center"
                        />
                      </div>

                      <div className="w-24 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Price (QAR)</label>
                        <input
                          type="text"
                          readOnly
                          value={Number(line.unit_price * line.quantity).toFixed(2)}
                          className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-100 bg-slate-100 text-center text-slate-600"
                        />
                      </div>

                      {orderLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all mb-[1px]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order Instructions</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Special instructions for delicate handling, stains, etc."
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white h-16"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Create Order &amp; Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoicing Modal Dialog */}
      {isInvoiceOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-sm p-6 overflow-y-auto max-h-[90vh] animate-scale-in">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">Provision Accounting Invoice</h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed mb-4">
              This will automatically provision a Customer Partner inside Double-Entry Accounting and post a draft invoice for review.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Sales Journal</label>
                <select
                  required
                  value={selectedJournalId}
                  onChange={e => setSelectedJournalId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                >
                  {salesJournals.map(journal => (
                    <option key={journal.id} value={journal.id}>{journal.name} ({journal.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsInvoiceOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmInvoice}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1"
                >
                  Confirm &amp; Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
