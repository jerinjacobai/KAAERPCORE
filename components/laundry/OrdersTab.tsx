import React, { useState, useEffect } from 'react';
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
  ShoppingBag,
  Wallet,
  QrCode,
  Percent,
  Send,
  Star,
  Printer
} from 'lucide-react';
import { LaundryOrder, LaundryOrderItem, LaundryService, LaundryItem, LaundryPricing, LaundryClientEmployee } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  getCustomerWallet, 
  adjustWalletBalance, 
  getCorporateContracts, 
  getOrderItems, 
  saveLaundryFeedback,
  getLaundryClientEmployees
} from './services';


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
  const { currentCompanyId } = useAuth();
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

  // Digitized Paper Form grid states
  const [isPaperMode, setIsPaperMode] = useState(false);
  const [receiptNo, setReceiptNo] = useState('');
  const [clientEmployees, setClientEmployees] = useState<LaundryClientEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [clientEmpName, setClientEmpName] = useState('');
  const [clientEmpNo, setClientEmpNo] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [buildingNo, setBuildingNo] = useState('');
  const [clientMobile, setClientMobile] = useState('');
  const [staffEmployees, setStaffEmployees] = useState<{ id: string, name: string, role: string }[]>([]);
  const [staffEmployeeName, setStaffEmployeeName] = useState('');

  const initialPaperGrid = [
    { name: 'Shirt', code: 'SHIRT', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Pant', code: 'PANT', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'T-shirt', code: 'TSHIRT', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Coverall', code: 'COVERALL', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Bedsheet', code: 'BEDSHEET', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Pillow Cover', code: 'PILLOW_COVER', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Short Pant', code: 'SHORT_PANT', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Towel', code: 'TOWEL', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Lungi', code: 'LUNGI', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Kurta', code: 'KURTA', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Blanket', code: 'BLANKET', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' },
    { name: 'Others', code: 'OTHERS', qty_issued: 0, qty_recv: 0, qty_ret: 0, qty_ack: 0, note: '' }
  ];
  const [paperGrid, setPaperGrid] = useState(initialPaperGrid);

  // Invoice Dialog
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState('');

  // Phase 2 States
  const [wallet, setWallet] = useState<{ balance: number; loyalty_points: number } | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [activeContract, setActiveContract] = useState<any | null>(null);
  const [useWalletPayment, setUseWalletPayment] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
  const [barcodeOrder, setBarcodeOrder] = useState<LaundryOrder | null>(null);
  const [barcodeLines, setBarcodeLines] = useState<LaundryOrderItem[]>([]);
  const [notifications, setNotifications] = useState<{ type: string; message: string; date: string }[]>([]);

  // Phase 3 Feedback States
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<LaundryOrder | null>(null);
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // Phase 2 Hooks & Methods
  useEffect(() => {
    const fetchContracts = async () => {
      if (!currentCompanyId) return;
      try {
        const data = await getCorporateContracts(currentCompanyId);
        setContracts(data);
      } catch (err) {
        console.error('Error fetching corporate contracts:', err);
      }
    };
    fetchContracts();
  }, [currentCompanyId]);

  useEffect(() => {
    const fetchWalletAndContract = async () => {
      if (!currentCompanyId || !customer_id) {
        setWallet(null);
        setActiveContract(null);
        return;
      }
      try {
        const wData = await getCustomerWallet(currentCompanyId, customer_id);
        setWallet(wData);

        // Find active contract
        const activeC = contracts.find(c => c.customer_id === customer_id && c.status === 'Active');
        setActiveContract(activeC || null);
      } catch (err) {
        console.error('Error fetching customer wallet:', err);
      }
    };
    fetchWalletAndContract();
  }, [customer_id, currentCompanyId, contracts]);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!currentCompanyId || !customer_id) {
        setClientEmployees([]);
        return;
      }
      try {
        const data = await getLaundryClientEmployees(currentCompanyId);
        const filtered = data.filter(e => e.client_customer_id === customer_id);
        setClientEmployees(filtered);
      } catch (err) {
        console.error('Error fetching client employees:', err);
      }
    };
    fetchEmployees();
  }, [customer_id, currentCompanyId, isNewOpen]);

  useEffect(() => {
    const fetchStaffList = async () => {
      if (!currentCompanyId) return;
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('company_id', currentCompanyId)
          .order('name');
        if (error) throw error;
        setStaffEmployees(data || []);
      } catch (err) {
        console.error('Error fetching staff list:', err);
      }
    };
    if (isNewOpen) {
      fetchStaffList();
    }
  }, [currentCompanyId, isNewOpen]);

  const addMockNotification = (type: string, message: string) => {
    const newLog = {
      type,
      message,
      date: new Date().toLocaleTimeString()
    };
    setNotifications(prev => [newLog, ...prev]);
  };

  const handleSelectOrder = async (order: LaundryOrder) => {
    setSelectedOrder(order);
    setIsLoadingItems(true);
    try {
      const data = await getOrderItems(order.id);
      setSelectedOrderItems(data);
    } catch (err: any) {
      alert('Error fetching items: ' + err.message);
    }
    setIsLoadingItems(false);
  };

  const handlePricingLookup = (itemId: string, serviceId: string): number => {
    const rate = pricing.find(p => p.item_id === itemId && p.service_id === serviceId && (p as any).branch_id?.toString() === branch_id)
      || pricing.find(p => p.item_id === itemId && p.service_id === serviceId && !(p as any).branch_id);
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

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) {
      setClientEmpName('');
      setClientEmpNo('');
      setRoomNo('');
      setBuildingNo('');
      setClientMobile('');
      return;
    }
    const emp = clientEmployees.find(e => e.id === empId);
    if (emp) {
      setClientEmpName(emp.name || '');
      setClientEmpNo(emp.employee_no || '');
      setRoomNo(emp.room_no || '');
      setBuildingNo(emp.building_no || '');
      setClientMobile(emp.mobile || '');
    }
  };

  const handlePaperGridChange = (index: number, field: 'qty_issued' | 'qty_recv' | 'qty_ret' | 'qty_ack' | 'note', val: any) => {
    const updated = [...paperGrid];
    updated[index] = { ...updated[index], [field]: val };
    setPaperGrid(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer_id) {
      alert('Please select a customer.');
      return;
    }

    let finalOrderLines: any[] = [];
    let subtotal = 0;

    if (isPaperMode) {
      // Find default service (Wash & Iron / first available)
      const defaultService = services.find(s => s.code === 'WSH-IRN') || services[0];
      if (!defaultService) {
        alert('No services registered. Please configure services first.');
        return;
      }

      // Filter grid rows with items issued > 0
      const activeRows = paperGrid.filter(row => Number(row.qty_issued) > 0);
      if (activeRows.length === 0) {
        alert('Please enter quantity issued for at least one garment row.');
        return;
      }

      for (const row of activeRows) {
        const matchingItem = items.find(i => i.code === row.code) || items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
        if (!matchingItem) continue;

        const price = handlePricingLookup(matchingItem.id, defaultService.id);
        const lineTotal = Number(row.qty_issued) * price;
        subtotal += lineTotal;

        finalOrderLines.push({
          item_id: matchingItem.id,
          service_id: defaultService.id,
          quantity: Number(row.qty_issued),
          unit_price: price,
          qty_issued: Number(row.qty_issued),
          qty_recv: Number(row.qty_recv),
          qty_ret: Number(row.qty_ret),
          qty_ack: Number(row.qty_ack),
          notes: row.note || ''
        });
      }
    } else {
      subtotal = orderLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);
      finalOrderLines = orderLines.map(l => ({
        item_id: l.item_id,
        service_id: l.service_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        qty_issued: l.quantity,
        qty_recv: 0,
        qty_ret: 0,
        qty_ack: 0,
        notes: ''
      }));
    }
    
    const discount = activeContract ? (subtotal * Number(activeContract.discount_percentage)) / 100 : 0;
    const total = subtotal - discount;

    try {
      if (useWalletPayment) {
        if (!wallet || Number(wallet.balance) < total) {
          alert('Insufficient wallet balance to cover this order.');
          return;
        }
        if (currentCompanyId) {
          await adjustWalletBalance(currentCompanyId, customer_id, total, 'Deduction', `Paid for Laundry Order`);
        }
      }

      const orderPayload: any = {
        customer_id,
        branch_id: branch_id || null,
        channel,
        priority,
        due_date: due_date || null,
        notes,
        total_amount: total,
        status: priority === 'Standard' ? 'Order' : 'Pickup'
      };

      if (isPaperMode) {
        orderPayload.receipt_no = receiptNo || null;
        orderPayload.client_employee_name = clientEmpName || null;
        orderPayload.client_employee_no = clientEmpNo || null;
        orderPayload.room_no = roomNo || null;
        orderPayload.building_no = buildingNo || null;
        orderPayload.client_mobile = clientMobile || null;
        orderPayload.staff_employee_name = staffEmployeeName || null;
      }

      await onCreateOrder(orderPayload, finalOrderLines);
      
      const customerName = customers.find(c => c.id === customer_id)?.name || 'Customer';
      addMockNotification('SMS / WhatsApp Alert', `Order intake confirmed for ${customerName}. Total: QAR ${total.toFixed(2)}.`);

      setIsNewOpen(false);
      // Reset form
      setCustomerId('');
      setBranchId('');
      setChannel('Walk-in');
      setPriority('Standard');
      setDueDate('');
      setNotes('');
      setUseWalletPayment(false);
      setOrderLines([{ item_id: '', service_id: '', quantity: 1, unit_price: 0 }]);
      setIsPaperMode(false);
      setReceiptNo('');
      setSelectedEmployeeId('');
      setClientEmpName('');
      setClientEmpNo('');
      setRoomNo('');
      setBuildingNo('');
      setClientMobile('');
      setStaffEmployeeName('');
      setPaperGrid(initialPaperGrid);
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

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !reviewOrder) return;
    setSavingReview(true);
    try {
      await saveLaundryFeedback(currentCompanyId, {
        order_id: reviewOrder.id,
        customer_id: reviewOrder.customer_id,
        rating,
        comments,
        status: 'Pending Review'
      });
      setIsReviewOpen(false);
      setReviewOrder(null);
      setRating(5);
      setComments('');
      alert('Feedback logged successfully! Thank you for the rating.');
    } catch (err: any) {
      alert('Error saving feedback: ' + err.message);
    }
    setSavingReview(false);
  };

  const handleGenerateInvoiceClick = () => {
    if (salesJournals.length > 0) {
      setSelectedJournalId(salesJournals[0].id);
    }
    setIsInvoiceOpen(true);
  };

  const handlePrintReceipt = (order: LaundryOrder, lines: LaundryOrderItem[]) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups to print the receipt.');
      return;
    }
    
    const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString();
    
    const html = `
      <html>
        <head>
          <title>Laundry Receipt #${order.receipt_no || order.order_number}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000;
              padding: 20px;
              max-width: 380px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .header h2 {
              margin: 0 0 5px 0;
               font-size: 16px;
              text-transform: uppercase;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              margin: 4px 0;
            }
            .meta-label {
              font-weight: bold;
            }
            .grid-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              border-bottom: 2px dashed #000;
            }
            .grid-table th, .grid-table td {
              padding: 6px 4px;
              text-align: left;
            }
            .grid-table th {
              border-bottom: 1px dashed #000;
              font-size: 10px;
            }
            .text-center {
              text-align: center;
            }
            .text-right {
              text-align: right;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              border-top: 1px dashed #000;
              padding-top: 10px;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>LAUNDRY SERVICE SLIP</h2>
            <div>KAA ERP Laundry System</div>
            <div style="margin-top: 5px; font-weight: bold;">RECEIPT NO: ${order.receipt_no || 'N/A'}</div>
          </div>
          
          <div class="meta-row">
            <span class="meta-label">Order Ref:</span>
            <span>${order.order_number}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Date:</span>
            <span>${dateStr}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Client Company:</span>
            <span>${order.customer_name}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Tenant Name:</span>
            <span>${order.client_employee_name || 'N/A'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Tenant Employee No:</span>
            <span>${order.client_employee_no || 'N/A'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Bldg / Room:</span>
            <span>Bldg ${order.building_no || 'N/A'} / Room ${order.room_no || 'N/A'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Mobile:</span>
            <span>${order.client_mobile || 'N/A'}</span>
          </div>
          ${order.staff_employee_name ? `
          <div class="meta-row">
            <span class="meta-label">Served By (Staff):</span>
            <span>${order.staff_employee_name}</span>
          </div>
          ` : ''}
          
          <table class="grid-table">
            <thead>
              <tr>
                <th>GARMENT</th>
                <th class="text-center">ISD</th>
                <th class="text-center">RCV</th>
                <th class="text-center">RET</th>
                <th class="text-center">ACK</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(l => `
                <tr>
                  <td style="font-weight: bold;">${l.item_name}</td>
                  <td class="text-center">${l.qty_issued || 0}</td>
                  <td class="text-center">${l.qty_recv || 0}</td>
                  <td class="text-center">${l.qty_ret || 0}</td>
                  <td class="text-center">${l.qty_ack || 0}</td>
                </tr>
                ${l.notes ? `<tr><td colspan="5" style="font-size: 9px; color: #555; padding-bottom: 6px; padding-left: 10px;">* Note: ${l.notes}</td></tr>` : ''}
              `).join('')}
            </tbody>
          </table>
          
          <div class="meta-row" style="margin-top: 10px; font-weight: bold; font-size: 13px;">
            <span>TOTAL AMOUNT:</span>
            <span>QAR ${Number(order.total_amount).toFixed(2)}</span>
          </div>
          
          <div class="footer">
            <p>Keep this slip inside the laundry bag.</p>
            <p>Thank you for using KAA ERP Laundry Services</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintBarcodeClick = () => {
    if (!selectedOrder) return;
    setBarcodeOrder(selectedOrder);
    setBarcodeLines(selectedOrderItems);
    setIsBarcodeOpen(true);
    addMockNotification('System Alert', `Simulated printing of barcode labels triggered for ${selectedOrder.order_number}`);
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
                {selectedOrder.receipt_no && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Paper Receipt No</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-sm animate-pulse">
                      #{selectedOrder.receipt_no}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Client Company</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedOrder.customer_name}</span>
                </div>
                {selectedOrder.client_employee_name && (
                  <>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Tenant (Employee)</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {selectedOrder.client_employee_name} ({selectedOrder.client_employee_no || 'N/A'})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Bldg / Room No</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        Bldg {selectedOrder.building_no || 'N/A'} / Room {selectedOrder.room_no || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Mobile No</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.client_mobile || 'N/A'}</span>
                    </div>
                  </>
                )}
                {selectedOrder.staff_employee_name && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Served By Staff</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {selectedOrder.staff_employee_name}
                    </span>
                  </div>
                )}
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Garments Log</span>
                {isLoadingItems ? (
                  <div className="text-center text-slate-400 text-xs py-4">Loading items...</div>
                ) : (
                  <div className="space-y-2">
                    {selectedOrder.receipt_no ? (
                      /* Paper Slip grid format */
                      <div className="border border-slate-100 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm bg-slate-50/50 dark:bg-zinc-900/30">
                        <table className="w-full text-left border-collapse text-[10px] font-semibold">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-slate-500 text-[9px] uppercase font-bold">
                              <th className="px-3 py-2">Garment</th>
                              <th className="px-1.5 py-2 text-center">ISD</th>
                              <th className="px-1.5 py-2 text-center">RCV</th>
                              <th className="px-1.5 py-2 text-center">RET</th>
                              <th className="px-1.5 py-2 text-center">ACK</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50 text-slate-700 dark:text-slate-300">
                            {selectedOrderItems.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                                <td className="px-3 py-1.5 font-bold">
                                  {item.item_name}
                                  {item.notes && (
                                    <span className="block text-[8px] text-slate-400 font-medium font-normal italic">
                                      Note: {item.notes}
                                    </span>
                                  )}
                                </td>
                                <td className="px-1.5 py-1.5 text-center font-bold text-indigo-500">{item.qty_issued || 0}</td>
                                <td className="px-1.5 py-1.5 text-center font-bold text-slate-600">{item.qty_recv || 0}</td>
                                <td className="px-1.5 py-1.5 text-center font-bold text-emerald-600">{item.qty_ret || 0}</td>
                                <td className="px-1.5 py-1.5 text-center font-bold text-amber-600">{item.qty_ack || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Standard listing */
                      selectedOrderItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <div>
                            <span>{item.item_name}</span>
                            <span className="block text-[9px] text-slate-400 font-medium">{item.service_name} • Qty: {item.quantity}</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-white">QAR {Number(item.total_price).toFixed(2)}</span>
                        </div>
                      ))
                    )}
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
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrintBarcodeClick}
                      className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-1 active:scale-95"
                    >
                      <QrCode className="w-4 h-4" /> Tag Barcodes
                    </button>
                    <button
                      onClick={() => handleStatusTransition('Production Batch')}
                      className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md active:scale-95"
                    >
                      Move to Batch
                    </button>
                  </div>
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

                {selectedOrder.status === 'Completed' && (
                  <button
                    onClick={() => {
                      setReviewOrder(selectedOrder);
                      setIsReviewOpen(true);
                      setRating(5);
                      setComments('');
                    }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 mt-2"
                  >
                    <Star className="w-4 h-4 fill-white" /> Log Customer Review
                  </button>
                )}

                {selectedOrder.accounting_invoice_id && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 text-xs font-bold rounded-2xl text-center border border-emerald-100/50 dark:border-emerald-900/30">
                    Billed under Invoice Move ID: {selectedOrder.accounting_invoice_id.substring(0,8)}...
                  </div>
                )}

                {/* Print Receipt Button */}
                {selectedOrder.receipt_no && (
                  <button
                    onClick={() => handlePrintReceipt(selectedOrder, selectedOrderItems)}
                    className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 mt-2"
                  >
                    <Printer className="w-4 h-4" /> Print Bag Tag (Service Slip)
                  </button>
                )}
              </div>

              {/* Mock Alerts Log */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Send className="w-3 h-3 text-indigo-500" /> WhatsApp / SMS Dispatch Log
                </span>
                
                {notifications.length === 0 ? (
                  <div className="text-[10px] text-slate-400 font-medium py-2">No alerts dispatched yet for this session.</div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {notifications.map((notif, i) => (
                      <div key={i} className="text-[9px] bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/50 p-2 rounded-xl">
                        <div className="flex justify-between font-bold text-indigo-500 mb-0.5">
                          <span>{notif.type}</span>
                          <span className="text-slate-400 font-medium">{notif.date}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-semibold">{notif.message}</p>
                      </div>
                    ))}
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
          <div className={`bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full p-6 overflow-y-auto max-h-[90vh] animate-slide-up transition-all duration-300 ${isPaperMode ? 'max-w-4xl' : 'max-w-2xl'}`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Create Laundry Order</h3>
              
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1 bg-indigo-50/50 dark:bg-zinc-900/30 rounded-xl border border-indigo-100/50 dark:border-zinc-800/80 hover:bg-indigo-50 transition-all select-none">
                <input
                  type="checkbox"
                  checked={isPaperMode}
                  onChange={e => setIsPaperMode(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Paper Slip Mode</span>
              </label>
            </div>
            
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Client Company</label>
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
                  {customer_id && (
                    <div className="mt-1.5 flex gap-2 flex-wrap">
                      {wallet && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
                          <Wallet className="w-3 h-3" /> Bal: QAR {Number(wallet.balance).toFixed(2)} ({wallet.loyalty_points} pts)
                        </span>
                      )}
                      {activeContract && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <Percent className="w-3 h-3" /> Contract: {activeContract.discount_percentage}% Off
                        </span>
                      )}
                    </div>
                  )}
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

              {isPaperMode ? (
                /* Digitized Paper slip inputs */
                <div className="space-y-4 bg-slate-50/50 dark:bg-zinc-900/20 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                    <FileText className="w-3.5 h-3.5" /> Paper Slip Header Information
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Serial Receipt No.</label>
                      <input
                        type="text"
                        required
                        value={receiptNo}
                        onChange={e => setReceiptNo(e.target.value)}
                        placeholder="e.g. 6255"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Select Registered Tenant</label>
                      <select
                        value={selectedEmployeeId}
                        onChange={e => handleEmployeeSelect(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Manual Entry / Select --</option>
                        {clientEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_no})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Tenant Name</label>
                      <input
                        type="text"
                        required
                        value={clientEmpName}
                        onChange={e => setClientEmpName(e.target.value)}
                        placeholder="e.g. Thennarasu"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Employee No.</label>
                      <input
                        type="text"
                        required
                        value={clientEmpNo}
                        onChange={e => setClientEmpNo(e.target.value)}
                        placeholder="e.g. 24535"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Building No.</label>
                      <input
                        type="text"
                        value={buildingNo}
                        onChange={e => setBuildingNo(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Room / Flat No.</label>
                      <input
                        type="text"
                        value={roomNo}
                        onChange={e => setRoomNo(e.target.value)}
                        placeholder="e.g. 17"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Mobile Number</label>
                      <input
                        type="text"
                        value={clientMobile}
                        onChange={e => setClientMobile(e.target.value)}
                        placeholder="e.g. +974 5551 2345"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Served By (Company Laundry Staff)</label>
                    <select
                      value={staffEmployeeName}
                      onChange={e => setStaffEmployeeName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose Staff Member --</option>
                      {staffEmployees.map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name} ({emp.role || 'Operator'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">
                      Garment Count Registry Grid (12 Standard Items)
                    </div>
                    
                    <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-zinc-950">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                            <th className="px-4 py-2 w-1/4">Garment</th>
                            <th className="px-2 py-2 text-center w-16">ISSUED</th>
                            <th className="px-2 py-2 text-center w-16">RECV.</th>
                            <th className="px-2 py-2 text-center w-16">RET.</th>
                            <th className="px-2 py-2 text-center w-16">ACK.</th>
                            <th className="px-4 py-2">Note / Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-700 dark:text-slate-300">
                          {paperGrid.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                              <td className="px-4 py-1.5 font-bold text-slate-900 dark:text-white">{row.name}</td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.qty_issued || ''}
                                  onChange={e => handlePaperGridChange(index, 'qty_issued', Number(e.target.value))}
                                  placeholder="-"
                                  className="w-12 px-1 py-1 rounded border border-slate-200 bg-slate-50 text-center font-bold text-slate-800 focus:bg-indigo-50/50 focus:border-indigo-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.qty_recv || ''}
                                  onChange={e => handlePaperGridChange(index, 'qty_recv', Number(e.target.value))}
                                  placeholder="-"
                                  className="w-12 px-1 py-1 rounded border border-slate-200 bg-slate-50 text-center font-bold text-slate-800 focus:bg-indigo-50/50 focus:border-indigo-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.qty_ret || ''}
                                  onChange={e => handlePaperGridChange(index, 'qty_ret', Number(e.target.value))}
                                  placeholder="-"
                                  className="w-12 px-1 py-1 rounded border border-slate-200 bg-slate-50 text-center font-bold text-slate-800 focus:bg-indigo-50/50 focus:border-indigo-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.qty_ack || ''}
                                  onChange={e => handlePaperGridChange(index, 'qty_ack', Number(e.target.value))}
                                  placeholder="-"
                                  className="w-12 px-1 py-1 rounded border border-slate-200 bg-slate-50 text-center font-bold text-slate-800 focus:bg-indigo-50/50 focus:border-indigo-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-1.5">
                                <input
                                  type="text"
                                  value={row.note}
                                  onChange={e => handlePaperGridChange(index, 'note', e.target.value)}
                                  placeholder="Stains, tears, special care instructions..."
                                  className="w-full px-2 py-1 rounded border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 focus:bg-indigo-50/50 focus:border-indigo-500 focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Order items builder */
                <>
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
                          const updated = orderLines.map(l => {
                            if (l.item_id && l.service_id) {
                              const price = handlePricingLookup(l.item_id, l.service_id);
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
                </>
              )}

              {wallet && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                  <input
                    type="checkbox"
                    id="pay-wallet"
                    checked={useWalletPayment}
                    onChange={e => setUseWalletPayment(e.target.checked)}
                    className="rounded text-indigo-500 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="pay-wallet" className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer">
                    <Wallet className="w-3.5 h-3.5 text-indigo-500" /> Pay using Wallet Balance (Available: QAR {Number(wallet.balance).toFixed(2)})
                  </label>
                </div>
              )}

              {/* Total Summary */}
              <div className="p-4 bg-indigo-50/20 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800/80 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>
                    QAR {
                      isPaperMode ? 
                      paperGrid.reduce((sum, row) => {
                        const matchingItem = items.find(i => i.code === row.code) || items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
                        const price = matchingItem ? handlePricingLookup(matchingItem.id, (services.find(s => s.code === 'WSH-IRN') || services[0])?.id || '') : 0;
                        return sum + (Number(row.qty_issued) * price);
                      }, 0).toFixed(2)
                      : orderLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0).toFixed(2)
                    }
                  </span>
                </div>
                {activeContract && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Corporate Contract ({activeContract.discount_percentage}%)</span>
                    <span>
                      - QAR {
                        ((isPaperMode ? 
                          paperGrid.reduce((sum, row) => {
                            const matchingItem = items.find(i => i.code === row.code) || items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
                            const price = matchingItem ? handlePricingLookup(matchingItem.id, (services.find(s => s.code === 'WSH-IRN') || services[0])?.id || '') : 0;
                            return sum + (Number(row.qty_issued) * price);
                          }, 0)
                          : orderLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0)
                        ) * Number(activeContract.discount_percentage) / 100).toFixed(2)
                      }
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-white pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                  <span>Total Net Amount</span>
                  <span>
                    QAR {
                      ((isPaperMode ? 
                        paperGrid.reduce((sum, row) => {
                          const matchingItem = items.find(i => i.code === row.code) || items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
                          const price = matchingItem ? handlePricingLookup(matchingItem.id, (services.find(s => s.code === 'WSH-IRN') || services[0])?.id || '') : 0;
                          return sum + (Number(row.qty_issued) * price);
                        }, 0)
                        : orderLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0)
                      ) * (1 - (activeContract ? Number(activeContract.discount_percentage) / 100 : 0))).toFixed(2)
                    }
                  </span>
                </div>
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

      {/* Barcode / QR Code Print Dialog */}
      {isBarcodeOpen && barcodeOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh] animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-500" /> Print Garment Barcode Tags
              </h3>
              <button 
                onClick={() => setIsBarcodeOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Close
              </button>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed mb-4">
              These barcode labels are attached to each garment basket/hangtag during sorting for active tracking in wash cycles.
            </p>

            <div className="grid grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-1 mb-4">
              {barcodeLines.map((line, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 flex flex-col items-center justify-center text-center space-y-2">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase">{line.service_name || 'Service'}</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{line.item_name || 'Garment'}</span>
                  
                  {/* Mock Barcode Stripes */}
                  <div className="w-full h-8 bg-white dark:bg-zinc-950 rounded flex items-center justify-around px-2 border border-slate-200/50 dark:border-zinc-800/50 overflow-hidden py-1">
                    {[...Array(24)].map((_, i) => (
                      <div 
                        key={i} 
                        className="h-full bg-slate-800 dark:bg-slate-300"
                        style={{ width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2)}px` }}
                      />
                    ))}
                  </div>

                  <span className="font-mono text-[9px] font-bold tracking-widest text-slate-500">
                    *{barcodeOrder.order_number}-{idx + 1}*
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  alert('Garment Tag Print job sent to TSP-100 thermal printer!');
                  setIsBarcodeOpen(false);
                }}
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                Send to Printer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Review Modal Dialog */}
      {isReviewOpen && reviewOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh] animate-scale-in text-slate-800 dark:text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> Log Customer Feedback
            </h3>
            <span className="text-[10px] font-bold text-slate-500 block mb-4">Order: {reviewOrder.order_number}</span>
            
            <form onSubmit={handleSaveReview} className="space-y-4">
              <div className="space-y-2 text-center py-2 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Rating</span>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none transition-all active:scale-90"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          star <= rating 
                            ? 'text-amber-500 fill-amber-500' 
                            : 'text-slate-200 dark:text-zinc-800'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 block">
                  {rating === 5 ? 'Excellent!' : 
                   rating === 4 ? 'Good Quality' :
                   rating === 3 ? 'Average' :
                   rating === 2 ? 'Needs Improvement' : 'Unsatisfactory'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comments / Suggestions</label>
                <textarea
                  required
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Tell us what the customer liked or any issues reported..."
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white h-24"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReview}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  {savingReview ? 'Saving...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
