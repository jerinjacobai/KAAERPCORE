import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Tag, 
  Layers, 
  Cpu, 
  DollarSign, 
  Briefcase,
  Percent,
  Wrench,
  Clock,
  User,
  Users,
  UserCheck,
  Sparkles,
  RefreshCw,
  Car,
  UserCog
} from 'lucide-react';
import { LaundryService, LaundryItem, LaundryPricing, LaundryMachine, LaundryCustomer, LaundryClientEmployee } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getCorporateContracts, 
  saveCorporateContract, 
  getMaintenanceLogs, 
  createMaintenanceLog,
  getLaundryCustomers,
  saveLaundryCustomer,
  deleteLaundryCustomer,
  getLaundryClientEmployees,
  saveLaundryClientEmployee,
  deleteLaundryClientEmployee,
  seedLaundryDemoData,
  getLaundryVehicles,
  saveLaundryVehicle,
  deleteLaundryVehicle,
  saveMasterEmployee,
  deleteMasterEmployee
} from './services';

interface MastersTabProps {
  services: LaundryService[];
  items: LaundryItem[];
  machines: LaundryMachine[];
  pricing: LaundryPricing[];
  customers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onSaveService: (service: Partial<LaundryService>) => Promise<void>;
  onSaveItem: (item: Partial<LaundryItem>) => Promise<void>;
  onSaveMachine: (machine: Partial<LaundryMachine>) => Promise<void>;
  onSavePricing: (pricing: Partial<LaundryPricing>) => Promise<void>;
  onRefreshAllMasters?: () => void;
}

export const MastersTab: React.FC<MastersTabProps> = ({
  services,
  items,
  machines,
  pricing,
  customers,
  locations,
  onSaveService,
  onSaveItem,
  onSaveMachine,
  onSavePricing,
  onRefreshAllMasters
}) => {
  const [subTab, setSubTab] = useState<'services' | 'items' | 'pricing' | 'machines' | 'customers' | 'employees' | 'contracts' | 'maintenance' | 'vehicles' | 'staff'>('services');
  
  // Dialog States
  const [isOpen, setIsOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<Partial<LaundryService>>({ name: '', code: '', description: '', category: 'Standard' });
  const [itemForm, setItemForm] = useState<Partial<LaundryItem>>({ name: '', code: '', category: 'Apparel' });
  const [machineForm, setMachineForm] = useState<Partial<LaundryMachine> & { branch_id?: string }>({ name: '', code: '', type: 'Washer', capacity: '', status: 'Idle', branch_id: '' });
  const [pricingForm, setPricingForm] = useState<Partial<LaundryPricing> & { branch_id?: string }>({ item_id: '', service_id: '', unit_price: 0, express_price: 0, branch_id: '' });

  // Standalone Masters States
  const { currentCompanyId } = useAuth();
  const [localCustomers, setLocalCustomers] = useState<LaundryCustomer[]>([]);
  const [clientEmployees, setClientEmployees] = useState<LaundryClientEmployee[]>([]);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Vehicles & Staff Masters States
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // Forms
  const [customerForm, setCustomerForm] = useState<Partial<LaundryCustomer>>({
    name: '',
    mobile: '',
    email: '',
    type: 'Individual',
    status: 'Active'
  });

  const [employeeForm, setEmployeeForm] = useState<Partial<LaundryClientEmployee>>({
    client_customer_id: '',
    name: '',
    employee_no: '',
    mobile: '',
    room_no: '',
    building_no: '',
    status: 'Active'
  });

  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    license_plate: '',
    type: 'Van',
    status: 'Active',
    capacity: '1.5 Tons',
    current_mileage: 0
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'Driver'
  });

  // Phase 2 Masters States
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractForm, setContractForm] = useState({
    customer_id: '',
    contract_number: '',
    sla_days: 2,
    discount_percentage: 0,
    monthly_limit: 0,
    start_date: '',
    end_date: '',
    status: 'Active'
  });

  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'Preventive',
    technician_name: '',
    cost: 0,
    description: ''
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const fetchLocalCustomers = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getLaundryCustomers(currentCompanyId);
      setLocalCustomers(data);
    } catch (err) {
      console.error('Error fetching local customers:', err);
    }
  };

  const fetchClientEmployees = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getLaundryClientEmployees(currentCompanyId);
      setClientEmployees(data);
    } catch (err) {
      console.error('Error fetching client employees:', err);
    }
  };

  const fetchVehicles = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getLaundryVehicles(currentCompanyId);
      setVehiclesList(data);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    }
  };

  const fetchStaff = async () => {
    if (!currentCompanyId) return;
    try {
      const { data, error } = await import('../../lib/supabase').then(m =>
        m.supabase.from('employees').select('id, name, role').eq('company_id', currentCompanyId).order('name')
      );
      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  };

  const fetchContracts = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getCorporateContracts(currentCompanyId);
      setContracts(data);
    } catch (err) {
      console.error('Error fetching contracts:', err);
    }
  };

  const fetchMaintenance = async () => {
    if (!currentCompanyId || !selectedMachineId) {
      setMaintenanceLogs([]);
      return;
    }
    try {
      const data = await getMaintenanceLogs(currentCompanyId, selectedMachineId);
      setMaintenanceLogs(data);
    } catch (err) {
      console.error('Error fetching maintenance logs:', err);
    }
  };

  const handleSeedDemoData = async () => {
    if (!currentCompanyId) return;
    setSeedingDemo(true);
    try {
      await seedLaundryDemoData(currentCompanyId);
      await Promise.all([
        fetchLocalCustomers(),
        fetchClientEmployees(),
        fetchContracts(),
        fetchVehicles(),
        fetchStaff()
      ]);
      if (onRefreshAllMasters) {
        onRefreshAllMasters();
      }
      alert('Demo data (QDS, Sheraton, Thennarasu, Jacob, Nidhin, vehicles, etc.) loaded successfully!');
    } catch (err: any) {
      alert('Error loading demo data: ' + err.message);
    } finally {
      setSeedingDemo(false);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchLocalCustomers();
    fetchClientEmployees();
    fetchVehicles();
    fetchStaff();
  }, [currentCompanyId]);

  useEffect(() => {
    fetchMaintenance();
  }, [selectedMachineId]);

  const handleOpenDialog = () => {
    setIsOpen(true);
  };

  const handleCloseDialog = () => {
    setIsOpen(false);
    // Reset forms
    setServiceForm({ name: '', code: '', description: '', category: 'Standard' });
    setItemForm({ name: '', code: '', category: 'Apparel' });
    setMachineForm({ name: '', code: '', type: 'Washer', capacity: '', status: 'Idle' });
    setPricingForm({ item_id: '', service_id: '', unit_price: 0, express_price: 0 });
    setCustomerForm({ name: '', mobile: '', email: '', type: 'Individual', status: 'Active' });
    setEmployeeForm({ client_customer_id: '', name: '', employee_no: '', mobile: '', room_no: '', building_no: '', status: 'Active' });
    setVehicleForm({
      name: '',
      license_plate: '',
      type: 'Van',
      status: 'Active',
      capacity: '1.5 Tons',
      current_mileage: 0
    });
    setStaffForm({
      name: '',
      role: 'Driver'
    });
    setContractForm({
      customer_id: '',
      contract_number: '',
      sla_days: 2,
      discount_percentage: 0,
      monthly_limit: 0,
      start_date: '',
      end_date: '',
      status: 'Active'
    });
    setMaintenanceForm({
      type: 'Preventive',
      technician_name: '',
      cost: 0,
      description: ''
    });
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!currentCompanyId || !confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteLaundryCustomer(currentCompanyId, id);
      await fetchLocalCustomers();
      if (onRefreshAllMasters) onRefreshAllMasters();
    } catch (err: any) {
      alert('Error deleting customer: ' + err.message);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!currentCompanyId || !confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteLaundryClientEmployee(currentCompanyId, id);
      await fetchClientEmployees();
    } catch (err: any) {
      alert('Error deleting employee: ' + err.message);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!currentCompanyId || !confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await deleteLaundryVehicle(currentCompanyId, id);
      await fetchVehicles();
    } catch (err: any) {
      alert('Error deleting vehicle: ' + err.message);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!currentCompanyId || !confirm('Are you sure you want to delete this staff employee?')) return;
    try {
      await deleteMasterEmployee(currentCompanyId, id);
      await fetchStaff();
      if (onRefreshAllMasters) onRefreshAllMasters();
    } catch (err: any) {
      alert('Error deleting staff: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (subTab === 'services') {
        await onSaveService(serviceForm);
      } else if (subTab === 'items') {
        await onSaveItem(itemForm);
      } else if (subTab === 'machines') {
        await onSaveMachine(machineForm);
      } else if (subTab === 'pricing') {
        await onSavePricing(pricingForm);
      } else if (subTab === 'customers') {
        if (!currentCompanyId) return;
        await saveLaundryCustomer(currentCompanyId, customerForm);
        await fetchLocalCustomers();
        if (onRefreshAllMasters) onRefreshAllMasters();
      } else if (subTab === 'employees') {
        if (!currentCompanyId) return;
        await saveLaundryClientEmployee(currentCompanyId, employeeForm);
        await fetchClientEmployees();
      } else if (subTab === 'contracts') {
        if (!currentCompanyId) return;
        await saveCorporateContract(currentCompanyId, contractForm);
        await fetchContracts();
      } else if (subTab === 'vehicles') {
        if (!currentCompanyId) return;
        await saveLaundryVehicle(currentCompanyId, vehicleForm);
        await fetchVehicles();
      } else if (subTab === 'staff') {
        if (!currentCompanyId) return;
        await saveMasterEmployee(currentCompanyId, staffForm);
        await fetchStaff();
        if (onRefreshAllMasters) onRefreshAllMasters();
      } else if (subTab === 'maintenance') {
        if (!currentCompanyId || !selectedMachineId) return;
        await createMaintenanceLog(currentCompanyId, {
          ...maintenanceForm,
          machine_id: selectedMachineId
        });
        await fetchMaintenance();
      }
      handleCloseDialog();
    } catch (err: any) {
      alert('Error saving record: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex flex-wrap justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3 gap-4">
        <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl">
          <button
            onClick={() => setSubTab('services')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'services' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Layers className="w-4 h-4" /> Services
          </button>
          <button
            onClick={() => setSubTab('items')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'items' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Tag className="w-4 h-4" /> Garments
          </button>
          <button
            onClick={() => setSubTab('pricing')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'pricing' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <DollarSign className="w-4 h-4" /> Pricing Grid
          </button>
          <button
            onClick={() => setSubTab('machines')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'machines' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Cpu className="w-4 h-4" /> Machinery
          </button>
          <button
            onClick={() => setSubTab('customers')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'customers' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="w-4 h-4" /> Customers
          </button>
          <button
            onClick={() => setSubTab('employees')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'employees' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <UserCheck className="w-4 h-4" /> Corporate Tenants
          </button>
          <button
            onClick={() => setSubTab('vehicles')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'vehicles' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Car className="w-4 h-4" /> Vehicles
          </button>
          <button
            onClick={() => setSubTab('staff')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'staff' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <UserCog className="w-4 h-4" /> Laundry Staff
          </button>
          <button
            onClick={() => setSubTab('contracts')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'contracts' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Percent className="w-4 h-4" /> SLA Contracts
          </button>
          <button
            onClick={() => setSubTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${subTab === 'maintenance' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Wrench className="w-4 h-4" /> Maintenance Logs
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSeedDemoData}
            disabled={seedingDemo}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {seedingDemo ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" /> Load Demo Data
              </>
            )}
          </button>

          {subTab !== 'maintenance' && (
            <button
              onClick={handleOpenDialog}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add {subTab === 'contracts' ? 'Contract' : subTab === 'employees' ? 'Tenant' : subTab === 'customers' ? 'Customer' : subTab === 'vehicles' ? 'Vehicle' : subTab === 'staff' ? 'Staff' : 'Master'}
            </button>
          )}
        </div>
      </div>

      {/* Lists */}
      <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {subTab === 'services' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Service Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Service Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {services.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{s.code}</td>
                  <td className="px-6 py-4">{s.name}</td>
                  <td className="px-6 py-4">{s.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${s.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {subTab === 'items' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Garment Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Garment Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {items.map(i => (
                <tr key={i.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{i.code}</td>
                  <td className="px-6 py-4">{i.name}</td>
                  <td className="px-6 py-4">{i.category}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${i.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-slate-100 text-slate-500'}`}>{i.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {subTab === 'pricing' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Garment</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Service</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Unit Price</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Express Charges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {pricing.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{p.item?.name || 'Garment'}</td>
                  <td className="px-6 py-4 font-semibold text-indigo-500">{p.service?.name || 'Service'}</td>
                  <td className="px-6 py-4">QAR {Number(p.unit_price).toFixed(2)}</td>
                  <td className="px-6 py-4 text-amber-500">QAR {Number(p.express_price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {subTab === 'machines' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Machine Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Capacity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {machines.map(m => {
                const statusColors = {
                  Idle: 'bg-sky-50 text-sky-600 dark:bg-sky-950/20',
                  Running: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20',
                  Maintenance: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20',
                  Breakdown: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                };
                return (
                  <tr key={m.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{m.code}</td>
                    <td className="px-6 py-4">{m.name}</td>
                    <td className="px-6 py-4">{m.type}</td>
                    <td className="px-6 py-4">{m.capacity || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusColors[m.status] || 'bg-slate-100 text-slate-500'}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {subTab === 'customers' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Customer Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Mobile</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {localCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No customers registered yet. Click 'Load Demo Data' or 'Add Customer'.</td>
                </tr>
              ) : (
                localCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20">{c.type}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold">{c.mobile || 'N/A'}</td>
                    <td className="px-6 py-4">{c.email || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteCustomer(c.id)}
                        className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {subTab === 'employees' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Tenant Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Employee #</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Company (Customer)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Bldg / Room No</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Mobile</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {clientEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No corporate tenants registered. Click 'Load Demo Data' or 'Add Tenant'.</td>
                </tr>
              ) : (
                clientEmployees.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{e.name}</td>
                    <td className="px-6 py-4 font-bold text-slate-500">{e.employee_no}</td>
                    <td className="px-6 py-4 text-indigo-500 font-semibold">{e.client_customer_name}</td>
                    <td className="px-6 py-4">Bldg {e.building_no || 'N/A'} / Room {e.room_no || 'N/A'}</td>
                    <td className="px-6 py-4 font-semibold">{e.mobile || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteEmployee(e.id)}
                        className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {subTab === 'vehicles' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Vehicle Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">License Plate</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Capacity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Mileage</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {vehiclesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">No vehicles registered yet. Click 'Load Demo Data' or 'Add Vehicle'.</td>
                </tr>
              ) : (
                vehiclesList.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{v.name}</td>
                    <td className="px-6 py-4 font-mono font-bold text-indigo-500">{v.license_plate}</td>
                    <td className="px-6 py-4">{v.type}</td>
                    <td className="px-6 py-4 font-semibold">{v.capacity || 'N/A'}</td>
                    <td className="px-6 py-4 font-semibold">{Number(v.current_mileage || 0).toLocaleString()} km</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${v.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteVehicle(v.id)}
                        className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {subTab === 'staff' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Employee Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Laundry Role</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">No staff registered yet. Click 'Load Demo Data' or 'Add Staff'.</td>
                </tr>
              ) : (
                staffList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{s.name}</td>
                    <td className="px-6 py-4 font-semibold text-indigo-500">{s.role || 'Operator'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteStaff(s.id)}
                        className="text-rose-500 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) }

        {subTab === 'contracts' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-800">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Contract #</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">CRM Customer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">SLA Days</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Discount %</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Monthly Limit</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No active corporate contracts found.</td>
                </tr>
              ) : (
                contracts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{c.contract_number}</td>
                    <td className="px-6 py-4">{c.customer_name}</td>
                    <td className="px-6 py-4">{c.sla_days} Days</td>
                    <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">{c.discount_percentage}%</td>
                    <td className="px-6 py-4 font-semibold">QAR {Number(c.monthly_limit).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {subTab === 'maintenance' && (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-zinc-800 min-h-[300px]">
            {/* Machine Picker */}
            <div className="p-4 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Choose Machine</span>
              <div className="space-y-1">
                {machines.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMachineId(m.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between text-xs font-semibold ${selectedMachineId === m.id ? 'bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400' : 'border-transparent hover:bg-slate-50 text-slate-700 dark:text-slate-300'}`}
                  >
                    <span>{m.name} ({m.code})</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{m.status}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Logs List & Log Form */}
            <div className="md:col-span-2 p-6 space-y-6">
              {selectedMachineId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Past logs list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-4 h-4 text-indigo-500" /> Servicing History
                    </h4>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {maintenanceLogs.length === 0 ? (
                        <div className="text-[10px] text-slate-400 py-6 text-center">No maintenance events logged for this machine.</div>
                      ) : (
                        maintenanceLogs.map((log, idx) => (
                          <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/60 rounded-2xl text-[10px] space-y-1">
                            <div className="flex justify-between items-center font-bold text-slate-800 dark:text-white">
                              <span className="text-indigo-500">{log.type}</span>
                              <span>QAR {Number(log.cost).toFixed(2)}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">{log.description}</p>
                            <div className="flex justify-between text-[9px] text-slate-400 font-medium pt-1">
                              <span>Tech: {log.technician_name || 'N/A'}</span>
                              <span>{log.performed_at}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add log form */}
                  <div className="space-y-3 bg-slate-50/50 dark:bg-zinc-900/30 p-4 rounded-3xl border border-slate-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1">
                      <Wrench className="w-4 h-4 text-indigo-500" /> Log Maintenance Event
                    </h4>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!currentCompanyId || !selectedMachineId) return;
                        setSavingMaintenance(true);
                        try {
                          await createMaintenanceLog(currentCompanyId, {
                            machine_id: selectedMachineId,
                            type: maintenanceForm.type,
                            technician_name: maintenanceForm.technician_name,
                            cost: maintenanceForm.cost,
                            description: maintenanceForm.description
                          });
                          setMaintenanceForm({ type: 'Preventive', technician_name: '', cost: 0, description: '' });
                          await fetchMaintenance();
                          alert('Maintenance event saved successfully!');
                        } catch (err: any) {
                          alert('Error saving maintenance event: ' + err.message);
                        }
                        setSavingMaintenance(false);
                      }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Service Type</label>
                          <select
                            value={maintenanceForm.type}
                            onChange={e => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white"
                          >
                            <option value="Preventive">Preventive</option>
                            <option value="AMC">AMC Schedule</option>
                            <option value="Corrective">Corrective</option>
                            <option value="Breakdown">Breakdown Event</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Cost (QAR)</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={maintenanceForm.cost}
                            onChange={e => setMaintenanceForm({ ...maintenanceForm, cost: Number(e.target.value) })}
                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Technician Name</label>
                        <input
                          type="text"
                          required
                          value={maintenanceForm.technician_name}
                          onChange={e => setMaintenanceForm({ ...maintenanceForm, technician_name: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Work Summary</label>
                        <textarea
                          required
                          value={maintenanceForm.description}
                          onChange={e => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                          placeholder="e.g. Cleared soap valve clog and replaced worn out hose belt..."
                          className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white h-16"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingMaintenance}
                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                      >
                        {savingMaintenance ? 'Saving Event...' : 'Submit Log'}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-12 text-center">
                  Please choose a machine from the left panel to review performance diagnostics, run logs, and write corrective AMC workorders.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh] animate-slide-up">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">
              Add New {subTab.charAt(0).toUpperCase() + subTab.slice(1, -1)}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {subTab === 'services' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Code</label>
                    <input
                      type="text"
                      required
                      value={serviceForm.code}
                      onChange={e => setServiceForm({ ...serviceForm, code: e.target.value })}
                      placeholder="e.g. WSH-FLD"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Name</label>
                    <input
                      type="text"
                      required
                      value={serviceForm.name}
                      onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                      placeholder="e.g. Wash & Fold"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                    <select
                      value={serviceForm.category}
                      onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                      <option value="Specialty">Specialty</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                    <textarea
                      value={serviceForm.description}
                      onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                      placeholder="Description of operations..."
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white h-20"
                    />
                  </div>
                </>
              )}

              {subTab === 'items' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Garment Code</label>
                    <input
                      type="text"
                      required
                      value={itemForm.code}
                      onChange={e => setItemForm({ ...itemForm, code: e.target.value })}
                      placeholder="e.g. SHIRT"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Garment Name</label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                      placeholder="e.g. Linen Shirt"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                    <select
                      value={itemForm.category}
                      onChange={e => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="Apparel">Apparel</option>
                      <option value="Linen">Linen</option>
                      <option value="Uniform">Uniform</option>
                      <option value="Curtain">Curtain</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </>
              )}

              {subTab === 'machines' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine Code</label>
                    <input
                      type="text"
                      required
                      value={machineForm.code}
                      onChange={e => setMachineForm({ ...machineForm, code: e.target.value })}
                      placeholder="e.g. DRY-20K-02"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine Name</label>
                    <input
                      type="text"
                      required
                      value={machineForm.name}
                      onChange={e => setMachineForm({ ...machineForm, name: e.target.value })}
                      placeholder="e.g. Dryer Station B"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                    <select
                      value={machineForm.type}
                      onChange={e => setMachineForm({ ...machineForm, type: e.target.value as any })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="Washer">Washer</option>
                      <option value="Dryer">Dryer</option>
                      <option value="Steam Press">Steam Press</option>
                      <option value="Boiler">Boiler</option>
                      <option value="Folder">Folder</option>
                      <option value="Packaging">Packaging</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacity</label>
                    <input
                      type="text"
                      value={machineForm.capacity}
                      onChange={e => setMachineForm({ ...machineForm, capacity: e.target.value })}
                      placeholder="e.g. 20kg"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Branch</label>
                    <select
                      value={machineForm.branch_id || ''}
                      onChange={e => setMachineForm({ ...machineForm, branch_id: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">Global / All Branches</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {subTab === 'pricing' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Garment</label>
                    <select
                      required
                      value={pricingForm.item_id}
                      onChange={e => setPricingForm({ ...pricingForm, item_id: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">-- Choose garment --</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Service</label>
                    <select
                      required
                      value={pricingForm.service_id}
                      onChange={e => setPricingForm({ ...pricingForm, service_id: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">-- Choose service --</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Price (QAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={pricingForm.unit_price || ''}
                        onChange={e => setPricingForm({ ...pricingForm, unit_price: Number(e.target.value) })}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Express Charge (QAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={pricingForm.express_price || ''}
                        onChange={e => setPricingForm({ ...pricingForm, express_price: Number(e.target.value) })}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Branch (Optional)</label>
                    <select
                      value={pricingForm.branch_id || ''}
                      onChange={e => setPricingForm({ ...pricingForm, branch_id: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">Global / All Branches</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id.toString()}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {subTab === 'customers' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Name</label>
                    <input
                      type="text"
                      required
                      value={customerForm.name}
                      onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                      placeholder="e.g. QDS Corporates"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Type</label>
                    <select
                      value={customerForm.type}
                      onChange={e => setCustomerForm({ ...customerForm, type: e.target.value as any })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="Individual">Individual</option>
                      <option value="Corporate">Corporate / Contracts</option>
                      <option value="Hotels">Hotels</option>
                      <option value="Hospitals">Hospitals</option>
                      <option value="Factories">Factories</option>
                      <option value="Restaurants">Restaurants</option>
                      <option value="Uniform Contracts">Uniform Contracts</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</label>
                    <input
                      type="text"
                      value={customerForm.mobile}
                      onChange={e => setCustomerForm({ ...customerForm, mobile: e.target.value })}
                      placeholder="e.g. +974 5550 1234"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                      placeholder="e.g. contact@qds.qa"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {subTab === 'employees' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Corporate Customer</label>
                    <select
                      required
                      value={employeeForm.client_customer_id}
                      onChange={e => setEmployeeForm({ ...employeeForm, client_customer_id: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">-- Choose Corporate Company --</option>
                      {localCustomers.filter(c => c.type !== 'Individual').map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenant (Employee) Name</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.name}
                      onChange={e => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                      placeholder="e.g. Thennarasu"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee ID / Code</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.employee_no}
                      onChange={e => setEmployeeForm({ ...employeeForm, employee_no: e.target.value })}
                      placeholder="e.g. 24535"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Building No</label>
                      <input
                        type="text"
                        value={employeeForm.building_no}
                        onChange={e => setEmployeeForm({ ...employeeForm, building_no: e.target.value })}
                        placeholder="e.g. 120"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room No / Flat No</label>
                      <input
                        type="text"
                        value={employeeForm.room_no}
                        onChange={e => setEmployeeForm({ ...employeeForm, room_no: e.target.value })}
                        placeholder="e.g. 17"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</label>
                    <input
                      type="text"
                      value={employeeForm.mobile}
                      onChange={e => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                      placeholder="e.g. +974 5551 2345"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              {subTab === 'vehicles' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Name / Model</label>
                    <input
                      type="text"
                      required
                      value={vehicleForm.name}
                      onChange={e => setVehicleForm({ ...vehicleForm, name: e.target.value })}
                      placeholder="e.g. Delivery Van A (Toyota Townace)"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">License Plate No</label>
                    <input
                      type="text"
                      required
                      value={vehicleForm.license_plate}
                      onChange={e => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })}
                      placeholder="e.g. 5625-LH"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white font-mono font-bold text-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Type</label>
                      <select
                        value={vehicleForm.type}
                        onChange={e => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      >
                        <option value="Van">Van</option>
                        <option value="Truck">Truck</option>
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Electric Trike">Electric Trike</option>
                        <option value="SUV">SUV</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Load Capacity</label>
                      <input
                        type="text"
                        value={vehicleForm.capacity}
                        onChange={e => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                        placeholder="e.g. 1.5 Tons"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Mileage (km)</label>
                      <input
                        type="number"
                        value={vehicleForm.current_mileage || ''}
                        onChange={e => setVehicleForm({ ...vehicleForm, current_mileage: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
                      <select
                        value={vehicleForm.status}
                        onChange={e => setVehicleForm({ ...vehicleForm, status: e.target.value })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      >
                        <option value="Active">Active</option>
                        <option value="Out of Service">Out of Service</option>
                        <option value="Under Repair">Under Repair</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {subTab === 'staff' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Name</label>
                    <input
                      type="text"
                      required
                      value={staffForm.name}
                      onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                      placeholder="e.g. Jacob Mathew"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Laundry Assignment Role</label>
                    <select
                      value={staffForm.role}
                      onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="Driver">Logistics Driver</option>
                      <option value="Counter Clerk">Counter Clerk</option>
                      <option value="Washing Operator">Washing Operator</option>
                      <option value="Quality Assurer">Quality Assurer</option>
                      <option value="Laundry Supervisor">Laundry Supervisor</option>
                    </select>
                  </div>
                </>
              )}

              {subTab === 'contracts' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Corporate Customer</label>
                    <select
                      required
                      value={contractForm.customer_id}
                      onChange={e => setContractForm({ ...contractForm, customer_id: e.target.value })}
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    >
                      <option value="">-- Choose customer --</option>
                      {localCustomers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Reference #</label>
                    <input
                      type="text"
                      required
                      value={contractForm.contract_number}
                      onChange={e => setContractForm({ ...contractForm, contract_number: e.target.value })}
                      placeholder="e.g. CON-HOTEL-2026"
                      className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SLA Days</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={contractForm.sla_days}
                        onChange={e => setContractForm({ ...contractForm, sla_days: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none text-center text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discount %</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={contractForm.discount_percentage}
                        onChange={e => setContractForm({ ...contractForm, discount_percentage: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none text-center text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Cap</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={contractForm.monthly_limit}
                        onChange={e => setContractForm({ ...contractForm, monthly_limit: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none text-center text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
                      <input
                        type="date"
                        required
                        value={contractForm.start_date}
                        onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
                      <input
                        type="date"
                        required
                        value={contractForm.end_date}
                        onChange={e => setContractForm({ ...contractForm, end_date: e.target.value })}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Save Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
