// components/laundry/EmployeePortalTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Wifi, 
  Battery, 
  User, 
  MapPin, 
  Clipboard, 
  Cpu, 
  Truck, 
  Plus, 
  Minus, 
  Camera, 
  CheckCircle, 
  ArrowLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getMobileDriverJobs, 
  updateMobileJobStatus, 
  addGPSCoordinate, 
  getLaundryVehicles, 
  getLaundryBatches,
  updateBatchStage,
  getInventoryItems,
  getWarehouseBins,
  consumeSupply,
  getLaundryClientEmployees
} from './services';
import { LaundryOrder, LaundryBatch, LaundryMachine, LaundryOrderItem, LaundryService, LaundryItem, LaundryPricing } from './types';

interface EmployeePortalTabProps {
  orders: LaundryOrder[];
  batches: LaundryBatch[];
  machines: LaundryMachine[];
  employees: { id: string; name: string; role?: string }[];
  customers: { id: string; name: string }[];
  services: LaundryService[];
  items: LaundryItem[];
  locations: { id: string; name: string }[];
  pricing: LaundryPricing[];
  onCreateOrder: (order: any, items: any[]) => Promise<void>;
  onUpdateStatus: (orderId: string, fromStatus: string, toStatus: string, notes?: string) => Promise<void>;
  onUpdateBatchStage: (batchId: string, stage: LaundryBatch['stage'], status: LaundryBatch['status'], machineId?: string) => Promise<void>;
  onCompleteJob: (jobId: string, type: 'pickup' | 'delivery') => Promise<void>;
}

export const EmployeePortalTab: React.FC<EmployeePortalTabProps> = ({
  orders,
  batches,
  machines,
  employees,
  customers,
  services,
  items,
  locations,
  pricing,
  onCreateOrder,
  onUpdateStatus,
  onUpdateBatchStage,
  onCompleteJob
}) => {
  const { currentCompanyId } = useAuth();
  
  // App States
  const [currentScreen, setCurrentScreen] = useState<'login' | 'clerk' | 'washer' | 'driver'>('login');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'clerk' | 'washer' | 'driver'>('clerk');
  const [timeStr, setTimeStr] = useState('');

  // 1. Clerk Screen States
  const [slipNo, setSlipNo] = useState('6255');
  const [clerkEmpName, setClerkEmpName] = useState('');
  const [clerkEmpNo, setClerkEmpNo] = useState('');
  const [clerkCompany, setClerkCompany] = useState('');
  const [clerkBldgNo, setClerkBldgNo] = useState('');
  const [clerkRoomNo, setClerkRoomNo] = useState('');
  const [clerkMobile, setClerkMobile] = useState('');
  const [clerkDueDate, setClerkDueDate] = useState('');
  const [clerkNotes, setClerkNotes] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [submittingIntake, setSubmittingIntake] = useState(false);

  // Client employees state for portal
  const [clientEmployees, setClientEmployees] = useState<LaundryClientEmployee[]>([]);
  const [selectedPortalEmployeeId, setSelectedPortalEmployeeId] = useState('');

  useEffect(() => {
    if (currentCompanyId) {
      getLaundryClientEmployees(currentCompanyId).then(setClientEmployees).catch(console.error);
    }
  }, [currentCompanyId, currentScreen]);

  // 2. Hub Wash Operator States
  const [operatorBatches, setOperatorBatches] = useState<LaundryBatch[]>([]);
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [scannedLogs, setScannedLogs] = useState<string[]>([]);
  const [selectedOpBatch, setSelectedOpBatch] = useState<LaundryBatch | null>(null);
  
  // Inventory Consumption inside Portal
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<any[]>([]);
  const [consumeItemId, setConsumeItemId] = useState('');
  const [consumeBinId, setConsumeBinId] = useState('');
  const [consumeQty, setConsumeQty] = useState('');
  const [isConsuming, setIsConsuming] = useState(false);

  // 3. Driver States
  const [driverPickups, setDriverPickups] = useState<any[]>([]);
  const [driverDeliveries, setDriverDeliveries] = useState<any[]>([]);
  const [loadingDriverJobs, setLoadingDriverJobs] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isGpsSimulating, setIsGpsSimulating] = useState(false);
  
  // Signature Drawing Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Clock tick
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Operator Batches
  const fetchOperatorBatches = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getLaundryBatches(currentCompanyId);
      setOperatorBatches(data);
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  // Load Inventory Data
  const loadInventory = async () => {
    if (!currentCompanyId) return;
    try {
      const [itemsRes, binsRes] = await Promise.all([
        getInventoryItems(currentCompanyId),
        getWarehouseBins(currentCompanyId)
      ]);
      setInventoryItems(itemsRes);
      setWarehouseBins(binsRes);
    } catch (err) {
      console.error('Error fetching inventory for portal:', err);
    }
  };

  // Fetch Driver Jobs
  const fetchDriverJobs = async () => {
    if (!currentCompanyId || !selectedEmployeeId) return;
    setLoadingDriverJobs(true);
    try {
      const data = await getMobileDriverJobs(currentCompanyId, selectedEmployeeId);
      setDriverPickups(data.pickups);
      setDriverDeliveries(data.deliveries);
    } catch (err) {
      console.error('Error fetching driver jobs:', err);
    }
    setLoadingDriverJobs(false);
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || !selectedEmployeeId) {
      alert('Please select both Branch and Employee Profile');
      return;
    }
    
    if (selectedRole === 'clerk') {
      setCurrentScreen('clerk');
      // Initialize items quantities
      const initial: Record<string, number> = {};
      items.forEach(it => { initial[it.id] = 0; });
      setItemQuantities(initial);
      
      // Auto-set mock slip number
      setSlipNo(Math.floor(Math.random() * 8000 + 1000).toString());
    } else if (selectedRole === 'washer') {
      setCurrentScreen('washer');
      fetchOperatorBatches();
      loadInventory();
    } else if (selectedRole === 'driver') {
      setCurrentScreen('driver');
      fetchDriverJobs();
    }
  };

  const handlePortalEmployeeSelect = (empId: string) => {
    setSelectedPortalEmployeeId(empId);
    if (!empId) {
      setClerkEmpName('');
      setClerkEmpNo('');
      setClerkBldgNo('');
      setClerkRoomNo('');
      setClerkMobile('');
      setClerkCompany('');
      return;
    }
    const emp = clientEmployees.find(e => e.id === empId);
    if (emp) {
      setClerkEmpName(emp.name || '');
      setClerkEmpNo(emp.employee_no || '');
      setClerkBldgNo(emp.building_no || '');
      setClerkRoomNo(emp.room_no || '');
      setClerkMobile(emp.mobile || '');
      setClerkCompany(emp.client_customer_name || '');
    }
  };

  // Intake Submit Handler
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !clerkEmpName || !clerkEmpNo || !clerkCompany) {
      alert('Please fill out Employee Name, Employee No and Corporate Company Name.');
      return;
    }

    // Verify there is at least one garment count
    const totalPieces = Object.values(itemQuantities).reduce((a, b) => a + b, 0);
    if (totalPieces === 0) {
      alert('Intake receipt must contain at least one item.');
      return;
    }

    setSubmittingIntake(true);
    try {
      // 1. Resolve or create customer matching corporate company name
      let customerId = customers[0]?.id;
      const matchedCust = customers.find(c => c.name.toLowerCase().includes(clerkCompany.toLowerCase()));
      if (matchedCust) {
        customerId = matchedCust.id;
      }

      // 2. Prepare Order Lines
      const orderLines = Object.entries(itemQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const serviceId = services[0]?.id || '';
          const rate = pricing.find(p => p.item_id === itemId && p.service_id === serviceId);
          return {
            item_id: itemId,
            service_id: serviceId,
            quantity: qty,
            unit_price: Number(rate?.unit_price || 0),
            qty_issued: qty,
            qty_recv: 0,
            qty_ret: 0,
            qty_ack: 0,
            notes: ''
          };
        });

      // 3. Calculate totals
      const subtotal = orderLines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);

      // 4. Create Order with decoupled paper slip parameters
      await onCreateOrder({
        customer_id: customerId,
        branch_id: selectedBranchId || null,
        channel: 'Corporate',
        priority: 'Standard',
        due_date: clerkDueDate || null,
        notes: clerkNotes,
        total_amount: subtotal,
        status: 'Branch Receive',
        receipt_no: slipNo,
        client_employee_name: clerkEmpName,
        client_employee_no: clerkEmpNo,
        room_no: clerkRoomNo,
        building_no: clerkBldgNo,
        client_mobile: clerkMobile
      }, orderLines);

      alert(`Intake Receipt #${slipNo} successfully saved to database! Total: ${totalPieces} items.`);
      
      // Reset Counter clerk form
      setClerkEmpName('');
      setClerkEmpNo('');
      setClerkCompany('');
      setClerkBldgNo('');
      setClerkRoomNo('');
      setClerkMobile('');
      setClerkNotes('');
      setClerkDueDate('');
      setSelectedPortalEmployeeId('');
      const resetQty: Record<string, number> = {};
      items.forEach(it => { resetQty[it.id] = 0; });
      setItemQuantities(resetQty);
      setSlipNo(Math.floor(Math.random() * 8000 + 1000).toString());

    } catch (err: any) {
      alert('Error submitting intake: ' + err.message);
    }
    setSubmittingIntake(false);
  };

  // Stepper increment helper
  const adjustQty = (itemId: string, diff: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + diff)
    }));
  };

  // Barcode scanning simulator
  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;
    const query = barcodeQuery.trim().toUpperCase();
    setBarcodeQuery('');

    // Try to find a batch matching
    const matched = operatorBatches.find(b => b.batch_number.toUpperCase() === query);
    if (matched) {
      setSelectedOpBatch(matched);
      setScannedLogs(prev => [`[INFO] Barcode tag ${query} scanned: Batch found.`, ...prev]);
    } else {
      setScannedLogs(prev => [`[WARN] Barcode tag ${query} not recognized.`, ...prev]);
      alert('Unrecognised barcode code format.');
    }
  };

  // Advance stage from operator terminal
  const handleOperatorAdvanceStage = async (stage: LaundryBatch['stage'], status: LaundryBatch['status']) => {
    if (!selectedOpBatch) return;
    try {
      await onUpdateBatchStage(selectedOpBatch.id, stage, status);
      setScannedLogs(prev => [`[SUCCESS] Batch ${selectedOpBatch.batch_number} advanced to ${stage} (${status}).`, ...prev]);
      
      // Refresh batch details
      await fetchOperatorBatches();
      setSelectedOpBatch(prev => prev ? { ...prev, stage, status } : null);
    } catch (err: any) {
      alert('Error updating batch stage: ' + err.message);
    }
  };

  // Log inventory consumption inside portal
  const handlePortalConsumeStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !consumeItemId || !consumeBinId || !consumeQty) return;
    const qty = parseFloat(consumeQty);
    if (isNaN(qty) || qty <= 0) return;

    setIsConsuming(true);
    try {
      await consumeSupply(currentCompanyId, consumeItemId, qty, consumeBinId, 'Portal Operational Wash Log');
      setScannedLogs(prev => [`[STOCK] Consumed ${qty} units of soap/supplies.`, ...prev]);
      setConsumeQty('');
      alert('Wash supplies consumption logged successfully!');
    } catch (err: any) {
      alert('Error consuming supplies: ' + err.message);
    }
    setIsConsuming(false);
  };

  // Driver action triggers
  const handleDriverJobStatus = async (job: any, nextStatus: string) => {
    if (!currentCompanyId) return;
    try {
      await updateMobileJobStatus(currentCompanyId, job.id, job.type, nextStatus);
      await fetchDriverJobs();
      alert(`Job ${job.type} status updated to: ${nextStatus}`);
      if (activeJob?.id === job.id) {
        setActiveJob(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err: any) {
      alert('Error updating job status: ' + err.message);
    }
  };

  // GPS location simulator for driver
  const handleDriverGpsSimulate = async () => {
    if (!currentCompanyId || !activeJob) return;
    setIsGpsSimulating(true);
    try {
      // Simulate slightly updated coordinates on Doha streets
      const randomLat = 25.2854 + (Math.random() - 0.5) * 0.02;
      const randomLng = 51.5310 + (Math.random() - 0.5) * 0.02;
      
      await addGPSCoordinate(currentCompanyId, {
        job_id: activeJob.id,
        job_type: activeJob.type,
        latitude: randomLat,
        longitude: randomLng,
        speed: 48.50
      });
      alert(`Mock GPS location ping saved to database: ${randomLat.toFixed(5)}, ${randomLng.toFixed(5)}`);
    } catch (err: any) {
      alert('Error uploading GPS coordinates: ' + err.message);
    }
    setIsGpsSimulating(false);
  };

  // Signature Canvas Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    
    // Resolve coordinates
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    if (!activeJob) return;
    try {
      // Complete job inside portal
      await onCompleteJob(activeJob.id, activeJob.type);
      setIsSignatureOpen(false);
      setActiveJob(null);
      await fetchDriverJobs();
      alert('Signature captured! Route job marked as successfully Completed.');
    } catch (err: any) {
      alert('Error saving signature: ' + err.message);
    }
  };

  useEffect(() => {
    if (isSignatureOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
      }
    }
  }, [isSignatureOpen]);

  // Log out helper
  const handleLogout = () => {
    setCurrentScreen('login');
    setSelectedEmployeeId('');
    setSelectedBranchId('');
    setSelectedOpBatch(null);
    setActiveJob(null);
  };

  return (
    <div className="flex flex-col lg:flex-row justify-center items-center gap-8 py-4">
      {/* 1. Portal Explanatory Card */}
      <div className="lg:max-w-md space-y-4">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-2xl w-fit">
          <Smartphone className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Branch Employee Mobile Portal</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          This portal simulates the responsive handheld view that branch employees, driver logisticians, and plant washers use on their smartphones to submit entries.
        </p>
        <div className="p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-[11px] text-amber-700 dark:text-amber-400 space-y-1.5">
          <span className="font-bold uppercase tracking-wider block">Intake Slip Simulation</span>
          <p>
            You can replicate paper order tickets (like the Thennarasu QDS receipt) directly in the **Counter Clerk** screen, incrementing Bedsheets or Blankets with quick stepper buttons.
          </p>
        </div>
      </div>

      {/* 2. Mobile Device Frame Wrapper */}
      <div className="relative w-[340px] h-[670px] bg-slate-900 rounded-[50px] border-[12px] border-slate-950 shadow-2xl overflow-hidden flex flex-col select-none ring-8 ring-indigo-500/10">
        
        {/* Device Speaker Notch */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center">
          <div className="w-12 h-1 bg-zinc-800 rounded-full mb-1" />
        </div>

        {/* Mobile Status Bar */}
        <div className="bg-slate-900 text-white h-7 px-6 pt-1 flex justify-between items-center text-[10px] font-bold font-mono tracking-tighter select-none z-40 shrink-0">
          <span>{timeStr || '16:55'}</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Device Display Screen Content */}
        <div className="flex-1 bg-slate-50 dark:bg-zinc-950 overflow-y-auto relative flex flex-col text-slate-800 dark:text-zinc-100">
          
          {/* A. Login Screen */}
          {currentScreen === 'login' && (
            <div className="flex-grow flex flex-col justify-between p-6">
              <div className="space-y-6 pt-6">
                <div className="text-center space-y-2">
                  <div className="inline-block p-4 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-3xl text-white shadow-md">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">KAA Laundry Mobile</h3>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold">BRANCH STAFF PORTAL</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  {/* Select Branch */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Branch Outlet</label>
                    <select
                      required
                      value={selectedBranchId}
                      onChange={e => setSelectedBranchId(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white"
                    >
                      <option value="">-- Select Branch --</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Employee Profile */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Employee Profile</label>
                    <select
                      required
                      value={selectedEmployeeId}
                      onChange={e => setSelectedEmployeeId(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white"
                    >
                      <option value="">-- Choose Profile --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role/Workspace Selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">Select Workspace</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'clerk', label: 'Counter', icon: Clipboard },
                        { id: 'washer', label: 'Washing', icon: Cpu },
                        { id: 'driver', label: 'Driver', icon: Truck }
                      ].map(roleOpt => {
                        const Icon = roleOpt.icon;
                        const isSel = selectedRole === roleOpt.id;
                        return (
                          <div 
                            key={roleOpt.id}
                            onClick={() => setSelectedRole(roleOpt.id as any)}
                            className={`p-2.5 rounded-xl border cursor-pointer text-center flex flex-col items-center gap-1.5 transition-all ${
                              isSel 
                                ? 'border-indigo-500 bg-indigo-50/20 text-indigo-500 font-bold' 
                                : 'border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-[9px] block uppercase font-bold">{roleOpt.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 mt-4"
                  >
                    Enter Workspace
                  </button>
                </form>
              </div>
              <div className="text-center text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-6">
                Powered by KAA ERP Core
              </div>
            </div>
          )}

          {/* B. Branch Counter Clerk Screen (Intake Receipt Digitiser) */}
          {currentScreen === 'clerk' && (
            <div className="flex-grow flex flex-col justify-between">
              {/* Clerk Header */}
              <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleLogout}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Intake Desk</span>
                    <span className="text-xs font-bold block">Slip No: #{slipNo}</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 bg-slate-800 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

               {/* Clerk Scrollable Form */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-4 rounded-3xl shadow-sm space-y-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Linen Issue Ticket Details</span>
                  
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Select Pre-Registered Tenant</label>
                    <select
                      value={selectedPortalEmployeeId}
                      onChange={e => handlePortalEmployeeSelect(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                    >
                      <option value="">-- Manual Entry / Custom --</option>
                      {clientEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_no})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Employee Name</label>
                      <input
                        type="text"
                        required
                        value={clerkEmpName}
                        onChange={e => setClerkEmpName(e.target.value)}
                        placeholder="e.g. Thennarasu"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Employee No.</label>
                      <input
                        type="text"
                        required
                        value={clerkEmpNo}
                        onChange={e => setClerkEmpNo(e.target.value)}
                        placeholder="e.g. 24535"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                      />
                    </div>
                  </div>
 
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Company Name</label>
                    <select
                      value={clerkCompany}
                      onChange={e => setClerkCompany(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                    >
                      <option value="">-- Choose Company --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
 
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Building No.</label>
                      <input
                        type="text"
                        value={clerkBldgNo}
                        onChange={e => setClerkBldgNo(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Room No.</label>
                      <input
                        type="text"
                        value={clerkRoomNo}
                        onChange={e => setClerkRoomNo(e.target.value)}
                        placeholder="e.g. 17"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Mobile Number</label>
                      <input
                        type="text"
                        value={clerkMobile}
                        onChange={e => setClerkMobile(e.target.value)}
                        placeholder="e.g. +974 5551 2345"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Return Schedule Date</label>
                      <input
                        type="date"
                        value={clerkDueDate}
                        onChange={e => setClerkDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-850 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Stepper Counters for Laundry Items */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-4 rounded-3xl shadow-sm space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Garment quantities</span>
                    {/* Circle Count indicator matching the blue circle in the photo */}
                    <div className="w-6 h-6 border-2 border-indigo-500 text-indigo-500 font-extrabold rounded-full flex items-center justify-center text-[10px] animate-pulse">
                      {Object.values(itemQuantities).reduce((a, b) => a + b, 0)}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {items.map(item => {
                      const qty = itemQuantities[item.id] || 0;
                      return (
                        <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-800/40">
                          <div>
                            <span className="text-[11px] font-bold text-slate-800 dark:text-white block">{item.name}</span>
                            <span className="text-[8px] text-slate-400 font-semibold">{item.code}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 p-1 rounded-lg border border-slate-200/40">
                            <button
                              type="button"
                              onClick={() => adjustQty(item.id, -1)}
                              className="w-6 h-6 bg-white dark:bg-zinc-800 border border-slate-200/60 rounded-md flex items-center justify-center hover:bg-slate-100 text-slate-500 active:scale-90"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-slate-850 dark:text-white">{qty}</span>
                            <button
                              type="button"
                              onClick={() => adjustQty(item.id, 1)}
                              className="w-6 h-6 bg-white dark:bg-zinc-800 border border-slate-200/60 rounded-md flex items-center justify-center hover:bg-slate-100 text-slate-500 active:scale-90"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase">Clerk Notes / Remarks</label>
                  <textarea
                    value={clerkNotes}
                    onChange={e => setClerkNotes(e.target.value)}
                    placeholder="Enter any specific washing instructions or tags..."
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white h-12"
                  />
                </div>
              </div>

              {/* Clerk Submit Button */}
              <div className="p-4 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 shrink-0">
                <button
                  onClick={handleIntakeSubmit}
                  disabled={submittingIntake}
                  className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95"
                >
                  {submittingIntake ? 'Registering intake...' : 'Confirm Linen Intake'}
                </button>
              </div>
            </div>
          )}

          {/* C. Washing Hub Operator Screen (Washes, Batches & Soap stocks) */}
          {currentScreen === 'washer' && (
            <div className="flex-grow flex flex-col justify-between">
              {/* Washer Header */}
              <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleLogout}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Washing Operations</span>
                    <span className="text-xs font-bold block">Operator Hub</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 bg-slate-800 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Washer View Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Barcode Search / Scan Simulator */}
                <div className="bg-slate-900 text-zinc-300 p-4 rounded-3xl border border-zinc-800 shadow-inner space-y-3">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 block tracking-wider">Barcode Scanner</span>
                  <form onSubmit={handleBarcodeSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={barcodeQuery}
                      onChange={e => setBarcodeQuery(e.target.value)}
                      placeholder="Enter tag (e.g. BAT-001)..."
                      className="flex-1 px-3 py-2 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-850 text-zinc-200 placeholder-zinc-700"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg"
                    >
                      Scan
                    </button>
                  </form>
                  
                  {/* Mock camera scanning frame */}
                  <div className="relative h-20 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-x-0 h-0.5 bg-red-500 top-1/2 -translate-y-1/2 animate-bounce" />
                    <Camera className="w-8 h-8 text-zinc-800" />
                    <span className="absolute bottom-2 text-[8px] font-mono text-zinc-600 uppercase tracking-widest">ALIGNED SCANNER CAMERA</span>
                  </div>
                </div>

                {/* Selected Batch Details */}
                {selectedOpBatch ? (
                  <div className="bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 p-4 rounded-3xl shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-wider block">Active Batch Target</span>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">{selectedOpBatch.batch_number}</h4>
                      </div>
                      <span className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                        {selectedOpBatch.stage}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 font-semibold border-t border-slate-50 dark:border-zinc-800/60 pt-2.5">
                      <div>Operator: {selectedOpBatch.operator_name || 'Unassigned'}</div>
                      <div>Garments: {selectedOpBatch.items_count} items</div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-zinc-800/60">
                      {selectedOpBatch.status === 'Active' && (
                        <button
                          type="button"
                          onClick={() => handleOperatorAdvanceStage(selectedOpBatch.stage, 'In Progress')}
                          className="w-full py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl"
                        >
                          Start Cycle Process
                        </button>
                      )}
                      {selectedOpBatch.status === 'In Progress' && (
                        <button
                          type="button"
                          onClick={() => {
                            let next: LaundryBatch['stage'] = 'Washing';
                            if (selectedOpBatch.stage === 'Washing') next = 'Drying';
                            else if (selectedOpBatch.stage === 'Drying') next = 'Ironing';
                            else if (selectedOpBatch.stage === 'Ironing') next = 'QC';
                            else if (selectedOpBatch.stage === 'QC') next = 'Packing';
                            handleOperatorAdvanceStage(next, 'Completed');
                          }}
                          className="w-full py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl"
                        >
                          Finish stage and advance
                        </button>
                      )}
                      {selectedOpBatch.status === 'Completed' && (
                        <span className="w-full py-2 text-center text-xs font-bold text-emerald-500 block">Cycle Finished successfully</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-4 rounded-3xl shadow-sm text-center text-slate-400 text-[10px] font-semibold py-8 leading-relaxed">
                    Scan batch barcode or enter tag above to manage wash, dry, iron and packing stages.
                  </div>
                )}

                {/* Stock consumption inside Portal */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-4 rounded-3xl shadow-sm space-y-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500 block tracking-wider">Log SOAP / Detergent use</span>
                  
                  <form onSubmit={handlePortalConsumeStock} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase">Soap / Chemical</label>
                      <select
                        required
                        value={consumeItemId}
                        onChange={e => setConsumeItemId(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-800 dark:text-white"
                      >
                        <option value="">-- Choose item --</option>
                        {inventoryItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase">Source Bin</label>
                        <select
                          required
                          value={consumeBinId}
                          onChange={e => setConsumeBinId(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-800 dark:text-white"
                        >
                          <option value="">-- Select Bin --</option>
                          {warehouseBins.map(bin => (
                            <option key={bin.id} value={bin.id}>{bin.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase">Quantity (Litres/Pcs)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={consumeQty}
                          onChange={e => setConsumeQty(e.target.value)}
                          placeholder="e.g. 1.50"
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isConsuming}
                      className="w-full py-2.5 bg-indigo-500 text-white text-xs font-bold rounded-xl"
                    >
                      {isConsuming ? 'Logging stock...' : 'Deduct Stock Inventory'}
                    </button>
                  </form>
                </div>

                {/* Console logs */}
                <div className="bg-zinc-950 text-zinc-300 p-4 rounded-3xl font-mono text-[8px] border border-zinc-800 space-y-1.5">
                  <span className="text-zinc-650 font-bold block mb-1">OPERATOR LOG READOUT</span>
                  {scannedLogs.length === 0 ? (
                    <div className="text-zinc-700 italic">No events logged in current session.</div>
                  ) : (
                    scannedLogs.map((log, idx) => (
                      <div key={idx} className="truncate border-b border-zinc-900 pb-0.5">{log}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* D. Logistics Driver Portal Screen */}
          {currentScreen === 'driver' && (
            <div className="flex-grow flex flex-col justify-between">
              {/* Driver Header */}
              <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleLogout}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Logistic Driver Portal</span>
                    <span className="text-xs font-bold block">Assigned Routes</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 bg-slate-800 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Driver Scrollable View */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4">
                
                {/* Active Dispatches List */}
                {!activeJob ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Awaiting Dispatches</span>
                      <button 
                        onClick={fetchDriverJobs}
                        className="text-[9px] bg-slate-100 dark:bg-zinc-800 text-slate-600 px-2 py-0.5 rounded-full font-bold hover:bg-slate-200"
                      >
                        Refresh Jobs
                      </button>
                    </div>

                    {loadingDriverJobs ? (
                      <div className="text-center text-xs text-slate-400 py-8">Loading dispatches...</div>
                    ) : driverPickups.length === 0 && driverDeliveries.length === 0 ? (
                      <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-8 rounded-3xl text-center text-slate-400 text-xs font-semibold py-12">
                        No active pickups or deliveries assigned to your driver profile.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Pickups */}
                        {driverPickups.map(p => (
                          <div 
                            key={p.id}
                            onClick={() => setActiveJob(p)}
                            className="bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all flex justify-between items-center"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase">Pickup</span>
                                <span className="text-[9px] bg-slate-150 text-slate-600 px-2 py-0.5 rounded-full font-bold">{p.status}</span>
                              </div>
                              <span className="text-xs font-extrabold text-slate-800 dark:text-white block">{p.customer_name}</span>
                              <span className="text-[9px] text-slate-400 block">{p.address}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-350" />
                          </div>
                        ))}

                        {/* Deliveries */}
                        {driverDeliveries.map(d => (
                          <div 
                            key={d.id}
                            onClick={() => setActiveJob(d)}
                            className="bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all flex justify-between items-center"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">Delivery</span>
                                <span className="text-[9px] bg-slate-150 text-slate-600 px-2 py-0.5 rounded-full font-bold">{d.status}</span>
                              </div>
                              <span className="text-xs font-extrabold text-slate-800 dark:text-white block">{d.customer_name}</span>
                              <span className="text-[9px] text-slate-400 block">{d.address} • Order {d.order_number}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-350" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Active Single Job View */
                  <div className="space-y-4">
                    <button 
                      onClick={() => setActiveJob(null)}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-500"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Dispatch list
                    </button>

                    <div className="bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800 rounded-3xl shadow-sm space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">{activeJob.type}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{activeJob.date}</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] uppercase font-bold text-slate-400">Customer name</span>
                        <span className="text-xs font-extrabold text-slate-850 dark:text-white block">{activeJob.customer_name}</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] uppercase font-bold text-slate-400">Address / Location</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-350 block leading-relaxed">{activeJob.address}</span>
                      </div>

                      {activeJob.phone && (
                        <div className="space-y-0.5">
                          <span className="text-[8px] uppercase font-bold text-slate-400">Phone Contact</span>
                          <span className="text-xs font-mono font-bold block">{activeJob.phone}</span>
                        </div>
                      )}

                      {activeJob.amount && (
                        <div className="space-y-0.5">
                          <span className="text-[8px] uppercase font-bold text-slate-400">Collect Amount</span>
                          <span className="text-xs font-mono text-emerald-500 font-extrabold block">QAR {activeJob.amount}</span>
                        </div>
                      )}
                    </div>

                    {/* Operational Triggers */}
                    <div className="space-y-2">
                      {activeJob.status === 'Assigned' && (
                        <button
                          type="button"
                          onClick={() => handleDriverJobStatus(activeJob, 'Transit')}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-1"
                        >
                          Start Route (Transit)
                        </button>
                      )}
                      
                      {activeJob.status === 'Transit' && (
                        <div className="space-y-2">
                          {/* Live GPS Coordinates update trigger */}
                          <button
                            type="button"
                            onClick={handleDriverGpsSimulate}
                            disabled={isGpsSimulating}
                            className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5"
                          >
                            <MapPin className="w-4 h-4" /> {isGpsSimulating ? 'Sending GPS...' : 'Log GPS Coordinate'}
                          </button>
                          
                          {/* Complete dispatch and sign */}
                          <button
                            type="button"
                            onClick={() => setIsSignatureOpen(true)}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-1"
                          >
                            <Edit2 className="w-4 h-4" /> Complete &amp; Sign Off
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* E. Handheld Signature Modal */}
          {isSignatureOpen && activeJob && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end">
              <div className="bg-white dark:bg-zinc-900 rounded-t-[30px] p-6 space-y-4 text-slate-800 dark:text-zinc-100 animate-slide-up">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Customer Signature Capture</h4>
                  <button 
                    onClick={() => setIsSignatureOpen(false)}
                    className="text-[10px] text-slate-400 font-bold"
                  >
                    Cancel
                  </button>
                </div>
                
                <p className="text-[9px] text-slate-400 leading-relaxed">
                  Ask customer **{activeJob.customer_name}** to draw their signature signature sign-off in the frame below:
                </p>

                {/* Draw Canvas */}
                <div className="relative border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-zinc-950 h-36">
                  <canvas
                    ref={canvasRef}
                    width={290}
                    height={144}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair w-full h-full"
                  />
                  <div className="absolute bottom-2 left-2 pointer-events-none text-[8px] font-mono text-slate-400 bg-white/60 dark:bg-zinc-900/60 px-1 py-0.5 rounded">
                    DRAW WITH FINGER OR MOUSE
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-xl"
                  >
                    Clear Screen
                  </button>
                  <button
                    type="button"
                    onClick={saveSignature}
                    className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl"
                  >
                    Confirm Delivery
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Device Home Button gesture bar */}
        <div className="bg-slate-900 h-5 flex items-center justify-center shrink-0">
          <div className="w-32 h-1 bg-zinc-700 rounded-full" />
        </div>

      </div>
    </div>
  );
};
