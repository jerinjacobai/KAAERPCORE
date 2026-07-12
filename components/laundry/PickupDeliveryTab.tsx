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
  CalendarRange
} from 'lucide-react';
import { LaundryPickup, LaundryDelivery } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { getDriverShifts, saveDriverShift } from './services';

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
  const [activeTab, setActiveTab] = useState<'pickups' | 'deliveries'>('pickups');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [route, setRoute] = useState('');

  // Phase 2 Driver Shift States
  const { currentCompanyId } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [rosterDriverId, setRosterDriverId] = useState('');
  const [rosterDate, setRosterDate] = useState('');
  const [rosterShiftType, setRosterShiftType] = useState<'Morning' | 'Afternoon' | 'Night'>('Morning');
  const [savingRoster, setSavingRoster] = useState(false);

  const fetchShifts = async () => {
    if (!currentCompanyId) return;
    try {
      const data = await getDriverShifts(currentCompanyId);
      setShifts(data);
    } catch (err) {
      console.error('Error fetching driver shifts:', err);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [currentCompanyId]);

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

  const list = activeTab === 'pickups' ? pickups : deliveries;

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
      </div>

      {/* Grid of logistics jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logistics Jobs List */}
        <div className="lg:col-span-2 space-y-4">
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
                      <button
                        onClick={() => handleCompleteJob(job.id)}
                        className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Complete Dispatch
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Cards Column */}
        <div className="space-y-6">
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
                  <input
                    type="text"
                    required
                    value={vehicle}
                    onChange={e => setVehicle(e.target.value)}
                    placeholder="e.g. Toyota HiAce Pl. 40220"
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  />
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
        </div>
      </div>
    </div>
  );
};
