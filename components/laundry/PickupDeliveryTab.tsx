import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  User, 
  Calendar, 
  CheckCircle, 
  Plus, 
  ArrowRight,
  TrendingUp,
  Clock,
  CalendarRange,
  Sliders,
  Fuel,
  Gauge,
  ShieldAlert,
  Navigation,
  Compass
} from 'lucide-react';
import { LaundryPickup, LaundryDelivery } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getDriverShifts, 
  saveDriverShift, 
  getLaundryVehicles, 
  saveLaundryVehicle, 
  getFuelLogs, 
  addFuelLog, 
  addGPSCoordinate 
} from './services';

interface PickupDeliveryTabProps {
  pickups: LaundryPickup[];
  deliveries: LaundryDelivery[];
  employees: { id: string; name: string; role?: string }[];
  onAssignJob: (jobId: string, type: 'pickup' | 'delivery', driverId: string, vehicleDetails: string, routeDetails?: string) => Promise<void>;
  onCompleteJob: (jobId: string, type: 'pickup' | 'delivery') => Promise<void>;
}

export const PickupDeliveryTab: React.FC<PickupDeliveryTabProps> = ({
  pickups,
  deliveries,
  employees,
  onAssignJob,
  onCompleteJob
}) => {
  // Phase 2 Driver Shift States
  const { currentCompanyId } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [rosterDriverId, setRosterDriverId] = useState('');
  const [rosterDate, setRosterDate] = useState('');
  const [rosterShiftType, setRosterShiftType] = useState<'Morning' | 'Afternoon' | 'Night'>('Morning');
  const [savingRoster, setSavingRoster] = useState(false);

  // Phase 3 States
  const [activeTab, setActiveTab] = useState<'pickups' | 'deliveries' | 'vehicles'>('pickups');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [route, setRoute] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  
  // Fuel log states
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [fuelLitres, setFuelLitres] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdo, setFuelOdo] = useState('');
  const [fuelDate, setFuelDate] = useState('');
  const [savingFuel, setSavingFuel] = useState(false);
  
  // New Vehicle form states
  const [vehName, setVehName] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [vehType, setVehType] = useState<'Van' | 'Truck' | 'Motorcycle'>('Van');
  const [vehStatus, setVehStatus] = useState<'Active' | 'Maintenance' | 'Out of Service'>('Active');
  const [vehCapacity, setVehCapacity] = useState('60');
  const [vehExpiry, setVehExpiry] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // GPS Simulation states
  const [gpsJob, setGpsJob] = useState<any | null>(null);
  const [isGpsOpen, setIsGpsOpen] = useState(false);
  const [simCoords, setSimCoords] = useState<{ lat: number; lng: number }>({ lat: 25.2854, lng: 51.5310 });
  const [simSpeed, setSimSpeed] = useState(0);
  const [simDistance, setSimDistance] = useState(0);
  const [simEta, setSimEta] = useState(15);
  const [simProgress, setSimProgress] = useState(0);

  const fetchShifts = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getDriverShifts(currentCompanyId);
      setShifts(data);
    } catch (err) {
      console.error('Error fetching driver shifts:', err);
    }
  };

  const fetchVehicles = async () => {
    if (!currentCompanyId) return;
    setLoadingVehicles(true);
    try {
      const data = await getLaundryVehicles(currentCompanyId);
      setVehicles(data);
    } catch (err) {
      console.error('Error fetching fleet vehicles:', err);
    }
    setLoadingVehicles(false);
  };

  const fetchFuel = async (vehicleId: string) => {
    if (!currentCompanyId) return;
    try {
      const data = await getFuelLogs(currentCompanyId, vehicleId);
      setFuelLogs(data);
    } catch (err) {
      console.error('Error fetching fuel logs:', err);
    }
  };

  useEffect(() => {
    if (currentCompanyId) {
      fetchShifts();
      fetchVehicles();
    }
  }, [currentCompanyId]);

  // GPS Simulation Loop
  useEffect(() => {
    let timer: any;
    if (isGpsOpen && gpsJob) {
      // Start coordinates: Doha Corniche (25.2954, 51.5310)
      // Destination: Al Sadd (25.2854, 51.5010)
      const startLat = 25.2954;
      const startLng = 51.5310;
      const endLat = 25.2854;
      const endLng = 51.5010;

      setSimProgress(0);
      setSimSpeed(55);
      setSimDistance(6.5);
      setSimEta(12);

      timer = setInterval(async () => {
        setSimProgress(prev => {
          const next = prev + 10;
          if (next >= 100) {
            clearInterval(timer);
            setSimSpeed(0);
            setSimDistance(0);
            setSimEta(0);
            // Submit coordinate
            if (currentCompanyId) {
              addGPSCoordinate(currentCompanyId, {
                job_id: gpsJob.id,
                job_type: gpsJob.type,
                latitude: endLat,
                longitude: endLng,
                speed: 0
              }).catch(console.error);
            }
            alert(`Fleet vehicle has arrived at destination for order: ${gpsJob.order_number}!`);
            return 100;
          }

          // Interpolate coordinate
          const fraction = next / 100;
          const currentLat = startLat + (endLat - startLat) * fraction;
          const currentLng = startLng + (endLng - startLng) * fraction;
          setSimCoords({ lat: currentLat, lng: currentLng });

          // Randomize speed
          const randomSpeed = Math.floor(Math.random() * 20) + 45; // 45 to 65
          setSimSpeed(randomSpeed);
          
          // Decrease distance and ETA
          setSimDistance(Number((6.5 * (1 - fraction)).toFixed(2)));
          setSimEta(Math.max(1, Math.round(12 * (1 - fraction))));

          // Persist coordinate
          if (currentCompanyId) {
            addGPSCoordinate(currentCompanyId, {
              job_id: gpsJob.id,
              job_type: gpsJob.type,
              latitude: currentLat,
              longitude: currentLng,
              speed: randomSpeed
            }).catch(console.error);
          }

          return next;
        });
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGpsOpen, gpsJob, currentCompanyId]);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !vehName || !vehPlate) return;
    setSavingVehicle(true);
    try {
      await saveLaundryVehicle(currentCompanyId, {
        name: vehName,
        license_plate: vehPlate,
        type: vehType,
        status: vehStatus,
        current_mileage: 0,
        fuel_capacity: Number(vehCapacity) || 60.0,
        insurance_expiry: vehExpiry || null
      });
      setIsVehicleModalOpen(false);
      setVehName('');
      setVehPlate('');
      setVehExpiry('');
      await fetchVehicles();
      alert('Vehicle registered successfully!');
    } catch (err: any) {
      alert('Error saving vehicle: ' + err.message);
    }
    setSavingVehicle(false);
  };

  const handleSaveFuelLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !selectedVehicle || !fuelLitres || !fuelCost || !fuelOdo) return;
    setSavingFuel(true);
    try {
      await addFuelLog(currentCompanyId, {
        vehicle_id: selectedVehicle.id,
        date: fuelDate || new Date().toISOString().split('T')[0],
        liters: Number(fuelLitres),
        odometer: Number(fuelOdo),
        cost: Number(fuelCost)
      });
      setIsFuelModalOpen(false);
      setFuelLitres('');
      setFuelCost('');
      setFuelOdo('');
      await fetchVehicles();
      await fetchFuel(selectedVehicle.id);
      alert('Fuel transaction logged successfully!');
    } catch (err: any) {
      alert('Error logging fuel: ' + err.message);
    }
    setSavingFuel(false);
  };

  const handleSaveRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !rosterDriverId || !rosterDate) return;
    setSavingRoster(true);
    try {
      await saveDriverShift(currentCompanyId, {
        driver_id: rosterDriverId,
        shift_date: rosterDate,
        shift_type: rosterShiftType,
        status: 'Scheduled'
      });
      setIsRosterOpen(false);
      setRosterDriverId('');
      setRosterDate('');
      await fetchShifts();
      alert('Driver roster scheduled successfully!');
    } catch (err: any) {
      alert('Error scheduling shift: ' + err.message);
    }
    setSavingRoster(false);
  };

  const handleOpenAssign = (id: string) => {
    setSelectedJobId(id);
  };

  const handleCloseAssign = () => {
    setSelectedJobId(null);
    setDriverId('');
    setVehicle('');
    setRoute('');
  };

  const handleSubmitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !driverId || !vehicle) return;
    try {
      await onAssignJob(selectedJobId, activeTab === 'pickups' ? 'pickup' : 'delivery', driverId, vehicle, route);
      handleCloseAssign();
    } catch (err: any) {
      alert('Error assigning driver job: ' + err.message);
    }
  };

  const handleCompleteJob = async (id: string) => {
    if (!confirm('Mark this dispatch route as successfully completed?')) return;
    try {
      await onCompleteJob(id, activeTab === 'pickups' ? 'pickup' : 'delivery');
    } catch (err: any) {
      alert('Error updating job status: ' + err.message);
    }
  };

  const list = activeTab === 'pickups' ? pickups : (activeTab === 'deliveries' ? deliveries : []);

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl w-fit">
        <button
          onClick={() => { setActiveTab('pickups'); handleCloseAssign(); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'pickups' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <MapPin className="w-4 h-4" /> Pickups Intake ({pickups.length})
        </button>
        <button
          onClick={() => { setActiveTab('deliveries'); handleCloseAssign(); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'deliveries' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Truck className="w-4 h-4" /> Deliveries Outbound ({deliveries.length})
        </button>
        <button
          onClick={() => { setActiveTab('vehicles'); handleCloseAssign(); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === 'vehicles' ? 'bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Sliders className="w-4 h-4" /> Fleet &amp; Vehicles ({vehicles.length})
        </button>
      </div>

      {/* Grid of logistics jobs or vehicle list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logistics Jobs List / Vehicles list */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === 'vehicles' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Fleet Registry</h4>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">Manage delivery vans, trucks, mileage logs and fuel fill-up tracking.</p>
                </div>
                <button
                  onClick={() => setIsVehicleModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Vehicle
                </button>
              </div>

              {loadingVehicles ? (
                <div className="text-center text-xs text-slate-400 py-12">Loading vehicles...</div>
              ) : vehicles.length === 0 ? (
                <div className="bg-white dark:bg-zinc-950 p-12 rounded-3xl border border-slate-100 dark:border-zinc-800 text-center text-slate-400 text-xs font-medium">
                  No active fleet vehicles registered.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map(veh => (
                    <div 
                      key={veh.id} 
                      onClick={() => {
                        setSelectedVehicle(veh);
                        fetchFuel(veh.id);
                      }}
                      className={`bg-white dark:bg-zinc-950 p-5 rounded-3xl border shadow-sm cursor-pointer transition-all hover:shadow-md flex flex-col justify-between ${selectedVehicle?.id === veh.id ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-slate-100 dark:border-zinc-800'}`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                              {veh.type}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1">{veh.name}</h4>
                            <span className="font-mono text-[10px] font-bold text-slate-500">{veh.license_plate}</span>
                          </div>
                          <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                            veh.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 
                            veh.status === 'Maintenance' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                          }`}>
                            {veh.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-zinc-800/60">
                          <div className="flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-slate-400" />
                            <span>{veh.current_mileage} km</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Fuel className="w-3.5 h-3.5 text-slate-400" />
                            <span>Cap: {veh.fuel_capacity}L</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-50 dark:border-zinc-800/60">
                        <span className="text-[9px] text-slate-400 font-medium">Ins: {veh.insurance_expiry || 'N/A'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVehicle(veh);
                            setIsFuelModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-lg transition-all"
                        >
                          + Log Fuel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {list.length === 0 ? (
                <div className="bg-white dark:bg-zinc-950 p-12 rounded-3xl border border-slate-100 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 text-xs font-medium">
                  No pending logistics jobs found in this category.
                </div>
              ) : (
                list.map(job => {
                  const statusColors = {
                    Assigned: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
                    Transit: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20',
                    Completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20',
                    Failed: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                  };
                  
                  return (
                    <div key={job.id} className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{job.order_number}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[job.status] || 'bg-slate-100'}`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Scheduled: {job.pickup_date || job.delivery_date || 'Today'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            <span>Driver: {job.driver_name}</span>
                          </div>
                        </div>
                        {job.vehicle_details && (
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            Vehicle: {job.vehicle_details} {job.route_details ? `| Route: ${job.route_details}` : ''}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {job.status === 'Assigned' && (
                          <button
                            onClick={() => handleOpenAssign(job.id)}
                            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95"
                          >
                            Assign Driver <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {job.status === 'Transit' && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setGpsJob({ ...job, type: activeTab === 'pickups' ? 'pickup' : 'delivery' });
                                setIsGpsOpen(true);
                              }}
                              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 active:scale-95 animate-pulse"
                            >
                              <Compass className="w-3.5 h-3.5 text-sky-500" /> Track Live GPS
                            </button>
                            <button
                              onClick={() => handleCompleteJob(job.id)}
                              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Complete Dispatch
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Sidebar Cards Column */}
        <div className="space-y-6">
          {activeTab === 'vehicles' ? (
            /* Vehicle Fuel History Sidebar */
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Fuel className="w-5 h-5 text-indigo-500" /> Fuel &amp; Expenses History
              </h3>
              {selectedVehicle ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs font-semibold space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Selected Fleet</span>
                    <span className="text-slate-800 dark:text-white font-bold text-sm block">{selectedVehicle.name}</span>
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>Total Fuel Cost</span>
                      <span className="font-bold text-slate-800 dark:text-white">QAR {fuelLogs.reduce((sum, log) => sum + Number(log.cost), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total Liters</span>
                      <span className="font-bold text-slate-800 dark:text-white">{fuelLogs.reduce((sum, log) => sum + Number(log.liters), 0).toFixed(2)} L</span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Log Entries</span>
                    {fuelLogs.length === 0 ? (
                      <div className="text-[10px] text-slate-400 font-medium py-3 text-center border border-dashed rounded-2xl">No fuel logs registered for this vehicle.</div>
                    ) : (
                      fuelLogs.map((log, idx) => (
                        <div key={log.id || idx} className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl text-[10px] font-semibold flex justify-between items-center">
                          <div>
                            <span className="text-slate-800 dark:text-white font-bold block">{log.liters} L</span>
                            <span className="text-slate-400 text-[9px] font-medium">{log.date}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-800 dark:text-white font-bold block">QAR {Number(log.cost).toFixed(2)}</span>
                            <span className="text-slate-400 text-[9px] font-medium">Odo: {log.odometer} km</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center">
                  Select a vehicle from the fleet to view its expense logs.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Dispatch Assignment Card */}
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm h-fit space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-500" /> Dispatch Assignment
                </h3>
                
                {selectedJobId ? (
                  <form onSubmit={handleSubmitAssign} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Driver</label>
                      <select
                        required
                        value={driverId}
                        onChange={e => setDriverId(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      >
                        <option value="">-- Choose driver --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.role || 'Staff'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Details</label>
                      <select
                        required
                        value={vehicle}
                        onChange={e => setVehicle(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      >
                        <option value="">-- Select fleet vehicle --</option>
                        {vehicles.map(veh => (
                          <option key={veh.id} value={veh.name + ' Pl. ' + veh.license_plate}>
                            {veh.name} ({veh.license_plate}) - {veh.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Route/Location Description</label>
                      <input
                        type="text"
                        value={route}
                        onChange={e => setRoute(e.target.value)}
                        placeholder="e.g. Al Sadd Ring Road Zone 4"
                        className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleCloseAssign}
                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 text-xs font-bold rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                      >
                        Confirm Job
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-xs text-slate-400 leading-relaxed py-4 text-center">
                    Select a job from the list to assign drivers &amp; vehicles.
                  </div>
                )}
              </div>

              {/* Driver Shift Roster Card */}
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <CalendarRange className="w-5 h-5 text-indigo-500" /> Driver Shift Roster
                  </h3>
                  <button 
                    onClick={() => setIsRosterOpen(!isRosterOpen)}
                    className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-bold hover:bg-indigo-100 transition-all"
                  >
                    {isRosterOpen ? 'View Shifts' : '+ Schedule'}
                  </button>
                </div>

                {isRosterOpen ? (
                  <form onSubmit={handleSaveRoster} className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Driver</label>
                      <select
                        required
                        value={rosterDriverId}
                        onChange={e => setRosterDriverId(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                      >
                        <option value="">-- Select driver --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Shift Date</label>
                        <input
                          type="date"
                          required
                          value={rosterDate}
                          onChange={e => setRosterDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Shift Time</label>
                        <select
                          value={rosterShiftType}
                          onChange={e => setRosterShiftType(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                        >
                          <option value="Morning">Morning</option>
                          <option value="Afternoon">Afternoon</option>
                          <option value="Night">Night</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setIsRosterOpen(false)}
                        className="px-3 py-1.5 bg-slate-50 text-slate-500 text-xs font-bold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingRoster}
                        className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md"
                      >
                        {savingRoster ? 'Scheduling...' : 'Save Shift'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {shifts.length === 0 ? (
                      <div className="text-[10px] text-slate-400 font-medium py-3 text-center">No shifts rostered for this week.</div>
                    ) : (
                      shifts.map((shift, i) => (
                        <div key={i} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/60 rounded-2xl text-[10px] font-semibold">
                          <div className="space-y-0.5">
                            <span className="text-slate-800 dark:text-white font-bold block">{shift.driver_name}</span>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                              <Calendar className="w-3 h-3" />
                              <span>{shift.shift_date}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                              <Clock className="w-2.5 h-2.5" /> {shift.shift_type}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{shift.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Vehicle Creation Dialog */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6 overflow-y-auto animate-scale-in text-slate-800 dark:text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-slate-800 dark:text-white">Register Fleet Vehicle</h3>
            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Vehicle Name</label>
                <input
                  type="text"
                  required
                  value={vehName}
                  onChange={e => setVehName(e.target.value)}
                  placeholder="e.g. Delivery Van B"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">License Plate</label>
                  <input
                    type="text"
                    required
                    value={vehPlate}
                    onChange={e => setVehPlate(e.target.value)}
                    placeholder="e.g. 5042-QA"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Vehicle Type</label>
                  <select
                    value={vehType}
                    onChange={e => setVehType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  >
                    <option value="Van">Van</option>
                    <option value="Truck">Truck</option>
                    <option value="Motorcycle">Motorcycle</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Fuel Capacity (Liters)</label>
                  <input
                    type="number"
                    required
                    value={vehCapacity}
                    onChange={e => setVehCapacity(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Status</label>
                  <select
                    value={vehStatus}
                    onChange={e => setVehStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Out of Service">Out of Service</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Insurance Expiry Date</label>
                <input
                  type="date"
                  value={vehExpiry}
                  onChange={e => setVehExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVehicle}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  {savingVehicle ? 'Saving...' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fuel Log Dialog */}
      {isFuelModalOpen && selectedVehicle && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6 overflow-y-auto animate-scale-in text-slate-800 dark:text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Fuel className="w-5 h-5 text-indigo-500" /> Log Fuel Expense
            </h3>
            <span className="text-[10px] font-bold text-slate-500 block mb-4">Vehicle: {selectedVehicle.name} ({selectedVehicle.license_plate})</span>
            
            <form onSubmit={handleSaveFuelLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Liters Filled</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelLitres}
                    onChange={e => setFuelLitres(e.target.value)}
                    placeholder="e.g. 45.5"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Total Cost (QAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelCost}
                    onChange={e => setFuelCost(e.target.value)}
                    placeholder="e.g. 95.00"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Odometer (km)</label>
                  <input
                    type="number"
                    required
                    value={fuelOdo}
                    onChange={e => setFuelOdo(e.target.value)}
                    placeholder={`e.g. ${Number(selectedVehicle.current_mileage) + 200}`}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Refueling Date</label>
                  <input
                    type="date"
                    value={fuelDate}
                    onChange={e => setFuelDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsFuelModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFuel}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  {savingFuel ? 'Saving...' : 'Save Fuel Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GPS Route Tracking Simulator Dialog */}
      {isGpsOpen && gpsJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-xl p-6 overflow-y-auto animate-scale-in text-slate-800 dark:text-white">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Navigation className="w-5 h-5 text-sky-500 animate-bounce" /> Real-time Dispatch Route Tracker
              </h3>
              <button 
                onClick={() => setIsGpsOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Simulator Telemetry */}
              <div className="space-y-4 md:col-span-1">
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl space-y-3">
                  <div>
                    <span className="text-[8px] uppercase font-bold text-slate-400">Order Number</span>
                    <span className="text-xs font-bold block">{gpsJob.order_number}</span>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase font-bold text-slate-400">Job Type</span>
                    <span className="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase">
                      {gpsJob.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase font-bold text-slate-400">Status</span>
                    <span className="text-xs font-bold text-amber-500 block animate-pulse">In Transit</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl space-y-3 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[9px]">SPEED:</span>
                    <span className="font-bold">{simSpeed} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[9px]">LATITUDE:</span>
                    <span className="font-bold">{simCoords.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[9px]">LONGITUDE:</span>
                    <span className="font-bold">{simCoords.lng.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[9px]">DIST LEFT:</span>
                    <span className="font-bold">{simDistance} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-[9px]">ETA:</span>
                    <span className="font-bold text-indigo-500">{simEta} mins</span>
                  </div>
                </div>
              </div>

              {/* Animated Map Canvas Mock */}
              <div className="md:col-span-2 space-y-4">
                <div className="relative h-64 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden flex flex-col justify-between p-4 shadow-inner">
                  {/* Mock Map Background Grid */}
                  <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-10 pointer-events-none">
                    {[...Array(36)].map((_, i) => (
                      <div key={i} className="border border-slate-800 dark:border-slate-300" />
                    ))}
                  </div>

                  {/* Animated Route Line */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {/* Road Path */}
                    <path 
                      d="M 50 180 Q 150 50 250 180 T 450 80" 
                      fill="none" 
                      stroke="#cbd5e1" 
                      strokeWidth="6" 
                      strokeLinecap="round"
                    />
                    {/* Active Transit Path */}
                    <path 
                      d="M 50 180 Q 150 50 250 180 T 450 80" 
                      fill="none" 
                      stroke="#6366f1" 
                      strokeWidth="6" 
                      strokeLinecap="round"
                      strokeDasharray="500"
                      strokeDashoffset={500 - (500 * simProgress) / 100}
                    />
                  </svg>

                  {/* Start Point */}
                  <div className="absolute left-[38px] top-[165px] z-10 flex flex-col items-center">
                    <MapPin className="w-6 h-6 text-emerald-500 fill-emerald-100" />
                    <span className="text-[8px] font-bold bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border shadow">Start</span>
                  </div>

                  {/* End Point */}
                  <div className="absolute left-[438px] top-[65px] z-10 flex flex-col items-center">
                    <MapPin className="w-6 h-6 text-rose-500 fill-rose-100" />
                    <span className="text-[8px] font-bold bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border shadow">Dest</span>
                  </div>

                  {/* Moving Car Icon */}
                  <div 
                    className="absolute z-20 flex flex-col items-center transition-all duration-300"
                    style={{
                      left: `${50 + (390 * simProgress) / 100}px`,
                      top: `${165 - (100 * Math.sin((simProgress * Math.PI) / 100))}px`
                    }}
                  >
                    <Truck className="w-7 h-7 text-indigo-600 bg-white dark:bg-zinc-800 p-1.5 rounded-full border-2 border-indigo-500 shadow-md animate-bounce" />
                  </div>

                  {/* Progress overlay */}
                  <div className="z-30 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[10px] font-bold mt-auto">
                    <span>Route Completion: {simProgress}%</span>
                    <div className="w-32 bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${simProgress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
