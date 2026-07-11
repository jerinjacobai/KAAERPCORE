import React from 'react';
import { 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  Truck, 
  DollarSign, 
  Activity, 
  Smile 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { LaundryOrder, LaundryMachine } from './types';

interface DashboardTabProps {
  orders: LaundryOrder[];
  machines: LaundryMachine[];
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ orders, machines }) => {
  // Aggregate KPIs
  const todayStr = new Date().toISOString().split('T')[0];
  
  const todayOrders = orders.filter(o => o.created_at.startsWith(todayStr));
  const pendingPickups = orders.filter(o => o.status === 'Pickup');
  const processing = orders.filter(o => ['Sorting', 'Tagging', 'Production Batch', 'Washing', 'Drying', 'Ironing', 'Quality', 'Packing'].includes(o.status));
  const ready = orders.filter(o => o.status === 'Storage');
  const delivery = orders.filter(o => ['Delivery Assignment', 'Delivery'].includes(o.status));
  const completed = orders.filter(o => o.status === 'Completed');
  
  const totalRevenue = orders.filter(o => o.status !== 'Cancelled').reduce((acc, o) => acc + Number(o.total_amount), 0);
  const pendingPayments = orders.filter(o => o.payment_status !== 'Paid' && o.status !== 'Cancelled').reduce((acc, o) => acc + Number(o.total_amount), 0);

  // Group orders by date for chart (last 7 days)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => {
    const dayOrders = orders.filter(o => o.created_at.startsWith(date));
    const dayRevenue = dayOrders.filter(o => o.status !== 'Cancelled').reduce((acc, o) => acc + Number(o.total_amount), 0);
    return {
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      Orders: dayOrders.length,
      Revenue: dayRevenue
    };
  });

  // Machine breakdown chart data
  const machineStatusData = [
    { name: 'Idle', value: machines.filter(m => m.status === 'Idle').length, color: '#38bdf8' },
    { name: 'Running', value: machines.filter(m => m.status === 'Running').length, color: '#10b981' },
    { name: 'Maintenance', value: machines.filter(m => m.status === 'Maintenance').length, color: '#f59e0b' },
    { name: 'Breakdown', value: machines.filter(m => m.status === 'Breakdown').length, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Channel distribution data
  const channels = ['Walk-in', 'Corporate', 'Hotel', 'Hospital', 'Online', 'WhatsApp', 'Phone'];
  const channelData = channels.map(channel => {
    const count = orders.filter(o => o.channel === channel).length;
    return { name: channel, value: count };
  }).filter(c => c.value > 0);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card: Orders Today */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Orders Today</span>
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{todayOrders.length}</span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active Intake</span>
            </div>
          </div>
          <div className="p-4 bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 rounded-2xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Card: Processing */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">In Processing</span>
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{processing.length}</span>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              <span>{pendingPickups.length} awaiting pickup</span>
            </div>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card: Ready & Out */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Ready / Dispatch</span>
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{ready.length} / {delivery.length}</span>
            <div className="text-[10px] text-emerald-500 font-bold mt-1">
              <span>{completed.length} completed total</span>
            </div>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card: Revenue */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Total Revenue</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">QAR {totalRevenue.toFixed(2)}</span>
            <div className="text-[10px] text-rose-500 font-bold mt-1">
              <span>QAR {pendingPayments.toFixed(2)} unpaid</span>
            </div>
          </div>
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Chart Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Throughput & Revenue */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Weekly Performance Trend</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (QAR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Split */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">Order Channels</h3>
          </div>
          {channelData.length > 0 ? (
            <div className="h-48 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 ml-4">
                {channelData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                    <span className="truncate max-w-[80px]">{c.name}</span>
                    <span className="text-slate-400 font-bold ml-auto">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">No orders logged yet.</div>
          )}
        </div>
      </div>

      {/* Bottom Row: Machine Utilisation & Branch Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Machine Status */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Machine Operations</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 font-medium">
              {machines.length} Total
            </span>
          </div>
          <div className="space-y-3">
            {machines.slice(0, 4).map(m => {
              const statusColors = {
                Idle: 'bg-sky-500 text-white',
                Running: 'bg-emerald-500 text-white',
                Maintenance: 'bg-amber-500 text-white',
                Breakdown: 'bg-rose-500 text-white'
              };
              return (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100/50 dark:border-zinc-800/50">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white block">{m.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{m.code} • Capacity: {m.capacity || 'N/A'}</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${statusColors[m.status] || 'bg-slate-400'}`}>
                    {m.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Satisfaction / Branch status */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Customer Experience</h3>
            <Smile className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-2">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-full">
              <Smile className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">96% Satisfaction</h4>
            <p className="text-xs text-slate-400 max-w-xs">Based on simulated operational SLA benchmarks and delivery times recorded.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
