import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Package,
  QrCode,
  Terminal
} from 'lucide-react';
import { LaundryBatch, LaundryMachine, LaundryOrderItem } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { getInventoryItems, getWarehouseBins, consumeSupply } from './services';

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

  // Inventory Integration States
  const { currentCompanyId } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedBinId, setSelectedBinId] = useState('');
  const [consumeQty, setConsumeQty] = useState('');
  const [consuming, setConsuming] = useState(false);

  // Phase 2 QC States
  const [isQcOpen, setIsQcOpen] = useState(false);
  const [qcBatch, setQcBatch] = useState<LaundryBatch | null>(null);
  const [qcScore, setQcScore] = useState(100);
  const [qcStainRemoved, setQcStainRemoved] = useState(true);
  const [qcDamageFound, setQcDamageFound] = useState(false);
  const [qcComments, setQcComments] = useState('');
  const [savingQc, setSavingQc] = useState(false);

  // Phase 3 Barcode Scanner States
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanLogs, setScanLogs] = useState<any[]>([]);

  useEffect(() => {
    const loadInventoryData = async () => {
      if (!currentCompanyId) return;
      try {
        const [itemsRes, binsRes] = await Promise.all([
          getInventoryItems(currentCompanyId),
          getWarehouseBins(currentCompanyId)
        ]);
        setInventoryItems(itemsRes);
        setWarehouseBins(binsRes);
      } catch (err: any) {
        console.error('Error fetching inventory items/bins for laundry:', err);
      }
    };
    loadInventoryData();
  }, [currentCompanyId]);

  const handleConsumeStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompanyId || !selectedItemId || !selectedBinId || !consumeQty) return;
    const qty = parseFloat(consumeQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    setConsuming(true);
    try {
      await consumeSupply(currentCompanyId, selectedItemId, qty, selectedBinId, 'Laundry Operational Log');
      alert('Stock successfully consumed from inventory!');
      setConsumeQty('');
      setSelectedItemId('');
      setSelectedBinId('');
    } catch (err: any) {
      alert('Error consuming supplies: ' + err.message);
    }
    setConsuming(false);
  };

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
    if (batch.status === 'In Progress' && batch.stage === 'QC') {
      setQcBatch(batch);
      setIsQcOpen(true);
      return;
    }

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

  const handleSubmitQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcBatch || !currentCompanyId) return;
    setSavingQc(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: batchItems } = await supabase
        .from('laundry_batch_items')
        .select('order_item_id')
        .eq('company_id', currentCompanyId)
        .eq('batch_id', qcBatch.id);

      if (batchItems && batchItems.length > 0) {
        const inserts = batchItems.map(item => ({
          company_id: currentCompanyId,
          order_item_id: item.order_item_id,
          check_status: qcScore >= 80 ? 'Passed' : 'Rewash',
          stain_removed: qcStainRemoved,
          damage_found: qcDamageFound,
          comments: qcComments || 'Passed Quality Checklist'
        }));
        await supabase.from('laundry_quality_logs').insert(inserts);
      }

      await onUpdateBatchStage(qcBatch.id, 'Packing', 'Completed');
      setIsQcOpen(false);
      setQcBatch(null);
      setQcScore(100);
      setQcStainRemoved(true);
      setQcDamageFound(false);
      setQcComments('');
      alert('Quality check completed and logged successfully!');
    } catch (err: any) {
      alert('Error saving QC records: ' + err.message);
    }
    setSavingQc(false);
  };

  const handleBarcodeScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const code = barcodeInput.trim().toUpperCase();
    setBarcodeInput('');

    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      code,
      status: 'Success',
      message: ''
    };

    try {
      // 1. Check if it matches a Batch number (e.g. "BAT-XXXX")
      const matchedBatch = batches.find(b => b.batch_number.toUpperCase() === code);
      if (matchedBatch) {
        logEntry.message = `Batch ${matchedBatch.batch_number} recognized. Advancing stage...`;
        await handleAdvanceStage(matchedBatch);
        setScanLogs(prev => [logEntry, ...prev]);
        return;
      }

      // 2. Check if it matches a pending Order Item ID or code (e.g. ends with or contains)
      const matchedItem = pendingItems.find(item => 
        item.id.toUpperCase().endsWith(code) || 
        item.item_name.toUpperCase().includes(code)
      );
      if (matchedItem) {
        logEntry.message = `Garment "${matchedItem.item_name}" scanned. Toggled selection.`;
        toggleSelectItem(matchedItem.id);
        setScanLogs(prev => [logEntry, ...prev]);
        return;
      }

      // 3. Fallback: unrecognised code
      logEntry.status = 'Warning';
      logEntry.message = `Unknown barcode syntax. No matching active batch or pending garment.`;
      setScanLogs(prev => [logEntry, ...prev]);
    } catch (err: any) {
      logEntry.status = 'Error';
      logEntry.message = `Process failed: ${err.message}`;
      setScanLogs(prev => [logEntry, ...prev]);
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

          {/* Barcode Scanning Simulator Terminal */}
          <div className="bg-slate-900 text-zinc-300 p-6 rounded-3xl border border-zinc-800 shadow-xl space-y-4 mt-6">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Garment &amp; Batch Barcode Terminal</h4>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                <Terminal className="w-3.5 h-3.5" />
                <span>ONLINE SIMULATION</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Scan batch barcodes (e.g. <span className="font-mono text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">BAT-001</span>) to advance production cycles, or scan garment tag codes (e.g. keywords from pending list) to auto-select/sort them.
            </p>

            <form onSubmit={handleBarcodeScan} className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                placeholder="Scan or type barcode (e.g. BAT-001, Shirt, Suit)..."
                className="flex-1 px-4 py-2.5 text-xs font-mono rounded-xl bg-zinc-950 border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-200 placeholder-zinc-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
              >
                Scan Code
              </button>
            </form>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/60 max-h-40 overflow-y-auto font-mono text-[9px] space-y-1.5">
              <span className="text-[8px] text-zinc-500 font-bold block mb-1">SCAN LOG READOUT</span>
              {scanLogs.length === 0 ? (
                <div className="text-zinc-600 italic">Terminal awaiting scanner input...</div>
              ) : (
                scanLogs.map((log, idx) => (
                  <div key={idx} className="flex justify-between border-b border-zinc-900/60 pb-1">
                    <span className="text-zinc-500 font-medium">[{log.timestamp}]</span>
                    <span className={`font-bold px-1.5 rounded-full ${
                      log.status === 'Success' ? 'text-emerald-400 bg-emerald-950/20' :
                      log.status === 'Warning' ? 'text-amber-400 bg-amber-950/20' : 'text-rose-400 bg-rose-950/20'
                    }`}>{log.code}</span>
                    <span className="text-zinc-300 text-right flex-1 ml-4 truncate">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
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

          {/* Sidebar: Consume cleaning supplies */}
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm h-fit space-y-4 animate-slide-up">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-500" /> Supplies Consumption
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed">
              Deduct laundry detergent, fabric softener, tags, or hangers directly from KAA ERP stock inventory.
            </p>
            <form onSubmit={handleConsumeStock} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Supplies Item</label>
                <select
                  required
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                >
                  <option value="">-- Choose supply item --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Bin</label>
                  <select
                    required
                    value={selectedBinId}
                    onChange={e => setSelectedBinId(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  >
                    <option value="">-- Choose bin --</option>
                    {warehouseBins.map(bin => (
                      <option key={bin.id} value={bin.id}>{bin.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qty to Consume</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={consumeQty}
                    onChange={e => setConsumeQty(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={consuming}
                className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Package className="w-4 h-4" /> {consuming ? 'Deducting Stock...' : 'Log Consumption'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Quality Control Checklist Dialog */}
      {isQcOpen && qcBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh] animate-scale-in">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">Quality Control Checklist</h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed mb-4">
              Perform inspection on Batch **{qcBatch.batch_number}** before packing and delivery storage.
            </p>

            <form onSubmit={handleSubmitQc} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Score (1 - 100)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={qcScore}
                  onChange={e => setQcScore(Number(e.target.value))}
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="qc-stain"
                    checked={qcStainRemoved}
                    onChange={e => setQcStainRemoved(e.target.checked)}
                    className="rounded text-indigo-500 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="qc-stain" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    All stains successfully removed
                  </label>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="qc-damage"
                    checked={qcDamageFound}
                    onChange={e => setQcDamageFound(e.target.checked)}
                    className="rounded text-indigo-500 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="qc-damage" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer text-rose-500">
                    Fabric damage found (requires review)
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inspection Comments</label>
                <textarea
                  value={qcComments}
                  onChange={e => setQcComments(e.target.value)}
                  placeholder="Inspector observations, folding notes, packaging instructions..."
                  className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-white h-16"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsQcOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-500 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQc}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  {savingQc ? 'Logging...' : 'Approve & Pass Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
