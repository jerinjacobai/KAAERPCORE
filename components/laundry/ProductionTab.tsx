import React, { useState } from 'react';
import { 
  Play, 
  CheckCircle, 
  Cpu, 
  Layers, 
  User, 
  Calendar, 
  Plus, 
  CheckSquare, 
  Square,
  Activity,
  AlertCircle
} from 'lucide-react';
import { LaundryBatch, LaundryMachine, LaundryOrderItem } from './types';

interface ProductionTabProps {
  batches: LaundryBatch[];
  machines: LaundryMachine[];
  employees: { id: string; name: string }[];
  pendingItems: LaundryOrderItem[];
  onCreateBatch: (batch: Omit<LaundryBatch, 'id' | 'created_at' | 'company_id' | 'batch_number' | 'status'>, itemIds: string[]) => Promise<void>;
  onUpdateBatchStage: (batchId: string, stage: LaundryBatch['stage'], status: LaundryBatch['status'], machineId?: string) => Promise<void>;
}

export const ProductionTab: React.FC<ProductionTabProps> = ({
  batches,
  machines,
  employees,
  pendingItems,
  onCreateBatch,
  onUpdateBatchStage
}) => {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // New Batch Form
  const [stage, setStage] = useState<LaundryBatch['stage']>('Washing');
  const [machineId, setMachineId] = useState('');
  const [operatorId, setOperatorId] = useState('');

  const toggleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(x => x !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleStartCreate = () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one garment to include in the batch.');
      return;
    }
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setMachineId('');
    setOperatorId('');
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateBatch({
        stage,
        machine_id: machineId || undefined,
        operator_id: operatorId || undefined
      }, selectedItems);
      setSelectedItems([]);
      handleCancelCreate();
    } catch (err: any) {
      alert('Error creating batch: ' + err.message);
    }
  };

  const handleAdvanceStage = async (batch: LaundryBatch) => {
    let nextStage: LaundryBatch['stage'] = 'Washing';
    let nextStatus: LaundryBatch['status'] = 'In Progress';
    
    if (batch.status === 'Active') {
      nextStage = batch.stage;
      nextStatus = 'In Progress';
    } else if (batch.status === 'In Progress') {
      if (batch.stage === 'Washing') nextStage = 'Drying';
      else if (batch.stage === 'Drying') nextStage = 'Ironing';
      else if (batch.stage === 'Ironing') nextStage = 'QC';
      else if (batch.stage === 'QC') nextStage = 'Packing';
      
      nextStatus = 'Completed';
    }

    try {
      await onUpdateBatchStage(batch.id, nextStage, nextStatus);
    } catch (err: any) {
      alert('Error updating batch status: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batches Log */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" /> Active Batches
            </h3>
          </div>
          
          {batches.length === 0 ? (
            <div className="bg-white dark:bg-zinc-950 p-12 rounded-3xl border border-slate-100 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 text-xs font-medium">
              No active production batches. Set up a batch from pending garments.
            </div>
          ) : (
            batches.map(batch => {
              const statusColors = {
                Active: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
                'In Progress': 'bg-sky-50 text-sky-600 dark:bg-sky-950/20',
                Completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20'
              };

              return (
                <div key={batch.id} className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{batch.batch_number}</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold">{batch.stage}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[batch.status] || 'bg-slate-100'}`}>
                        {batch.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                      <div className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Machine: {batch.machine_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>Op: {batch.operator_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Garments: {batch.items_count} items</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {batch.status !== 'Completed' && (
                      <button
                        onClick={() => handleAdvanceStage(batch)}
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                          batch.status === 'Active' 
                            ? 'bg-sky-500 text-white hover:bg-sky-600'
                            : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        }`}
                      >
                        {batch.status === 'Active' ? (
                          <>
                            <Play className="w-3.5 h-3.5" /> Start Cycle
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" /> Finish {batch.stage}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar: Batch Planner */}
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm h-fit space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" /> Batch Planner
          </h3>

          {!isCreating ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Garments ({pendingItems.length})</span>
                {selectedItems.length > 0 && (
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{selectedItems.length} selected</span>
                )}
              </div>

              {pendingItems.length === 0 ? (
                <div className="text-xs text-slate-400 leading-relaxed text-center py-6">
                  No garments are currently awaiting sorting/production tagging.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {pendingItems.map(item => {
                    const isSelected = selectedItems.includes(item.id);
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => toggleSelectItem(item.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-indigo-200 bg-indigo-50/20 dark:border-indigo-900/30' 
                            : 'border-slate-100 dark:border-zinc-800 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-white block">{item.item_name}</span>
                            <span className="text-[9px] text-slate-400 font-medium">{item.service_name}</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">Qty: {item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                disabled={selectedItems.length === 0}
                onClick={handleStartCreate}
                className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:dark:bg-zinc-900 disabled:shadow-none text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create Batch ({selectedItems.length})
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitBatch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Initial Stage</label>
                <select
                  value={stage}
                  onChange={e => setStage(e.target.value as any)}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                >
                  <option value="Washing">Washing Cycle</option>
                  <option value="Drying">Drying Cycle</option>
                  <option value="Ironing">Steam Press / Ironing</option>
                  <option value="QC">Quality Control</option>
                  <option value="Packing">Final Packing</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign Machine</label>
                <select
                  value={machineId}
                  onChange={e => setMachineId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                >
                  <option value="">-- No machine --</option>
                  {machines.filter(m => m.type.startsWith(stage.substring(0,4)) || stage === 'QC' || stage === 'Packing').map(mach => (
                    <option key={mach.id} value={mach.id}>{mach.name} ({mach.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign Operator</label>
                <select
                  value={operatorId}
                  onChange={e => setOperatorId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                >
                  <option value="">-- No operator --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Start Batch
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
