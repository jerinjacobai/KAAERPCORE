import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { 
    getToolLogs, 
    createToolLog, 
    updateToolLog, 
    ToolLog 
} from '../../crm/enhancementServices';
import { 
    Boxes, 
    Plus, 
    Search, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Printer, 
    Check, 
    X, 
    Clock, 
    AlertTriangle, 
    User, 
    Building, 
    Calendar,
    Briefcase,
    Loader2,
    CheckCircle2
} from 'lucide-react';
import { Modal } from '../../ui/Modal';

export const ToolTracking: React.FC = () => {
    const { currentCompanyId, user } = useAuth();
    const [logs, setLogs] = useState<ToolLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Out' | 'Returned'>('All');
    
    // Modals
    const [isOutModalOpen, setIsOutModalOpen] = useState(false);
    const [isInModalOpen, setIsInModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<ToolLog | null>(null);

    // Form states
    const [saving, setSaving] = useState(false);
    const [employees, setEmployees] = useState<{ id: string, name: string }[]>([]);
    const [departments, setDepartments] = useState<{ id: number, name: string }[]>([]);
    
    // Tool Out Form
    const [outForm, setOutForm] = useState({
        tool_name: '',
        item_code: '',
        serial_number: '',
        quantity_out: 1,
        employee_id: '',
        department_id: '',
        project_name: '',
        expected_return_date: '',
        remarks_out: ''
    });

    // Tool In Form
    const [inForm, setInForm] = useState({
        quantity_returned: 1,
        condition_status: 'Good',
        remarks_in: ''
    });

    useEffect(() => {
        if (currentCompanyId) {
            fetchLogs();
            fetchDropdownData();
        }
    }, [currentCompanyId]);

    const fetchLogs = async () => {
        if (!currentCompanyId) return;
        setLoading(true);
        const data = await getToolLogs(currentCompanyId);
        setLogs(data);
        setLoading(false);
    };

    const fetchDropdownData = async () => {
        if (!currentCompanyId) return;
        
        // Fetch employees
        const { data: empData } = await supabase
            .from('employees')
            .select('id, name')
            .eq('company_id', currentCompanyId)
            .order('name');
        setEmployees(empData || []);

        // Fetch departments
        const { data: deptData } = await supabase
            .from('departments')
            .select('id, name')
            .eq('company_id', currentCompanyId)
            .order('name');
        setDepartments(deptData || []);
    };

    // Log Tool Out
    const handleLogOutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCompanyId) return;
        if (!outForm.tool_name) {
            alert('Tool name is required');
            return;
        }

        setSaving(true);
        try {
            const selectedEmp = employees.find(emp => emp.id === outForm.employee_id);
            const selectedDept = departments.find(dept => dept.id === parseInt(outForm.department_id));

            const logData: Partial<ToolLog> = {
                company_id: currentCompanyId,
                tool_name: outForm.tool_name,
                item_code: outForm.item_code || undefined,
                serial_number: outForm.serial_number || undefined,
                quantity_out: outForm.quantity_out,
                employee_id: outForm.employee_id || undefined,
                employee_name: selectedEmp?.name || undefined,
                department_id: selectedDept?.id || undefined,
                department_name: selectedDept?.name || undefined,
                project_name: outForm.project_name || undefined,
                date_out: new Date().toISOString().split('T')[0],
                expected_return_date: outForm.expected_return_date || undefined,
                remarks_out: outForm.remarks_out || undefined,
                approval_status: 'Approved',
                quantity_returned: 0
            };

            const created = await createToolLog(logData);
            if (created) {
                // Insert auto SLA record for tool return (default 7 days if not specified)
                const start = new Date();
                const due = outForm.expected_return_date 
                    ? new Date(outForm.expected_return_date) 
                    : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
                
                await (supabase as any).from('sla_tracking').insert([{
                    company_id: currentCompanyId,
                    entity_type: 'TOOL',
                    entity_id: created.id,
                    sla_hours: Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60)),
                    start_time: start.toISOString(),
                    due_time: due.toISOString(),
                    status: 'Pending'
                }]);

                setIsOutModalOpen(false);
                setOutForm({
                    tool_name: '',
                    item_code: '',
                    serial_number: '',
                    quantity_out: 1,
                    employee_id: '',
                    department_id: '',
                    project_name: '',
                    expected_return_date: '',
                    remarks_out: ''
                });
                fetchLogs();
            } else {
                alert('Failed to log tool check-out');
            }
        } catch (err: any) {
            console.error('Error logging tool out:', err);
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Log Tool In (Check-in)
    const handleCheckInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLog) return;

        setSaving(true);
        try {
            const returnedQty = inForm.quantity_returned;
            const newReturnedTotal = (selectedLog.quantity_returned || 0) + returnedQty;

            const updates: Partial<ToolLog> = {
                quantity_returned: newReturnedTotal,
                date_returned: new Date().toISOString().split('T')[0],
                condition_status: inForm.condition_status,
                remarks_in: inForm.remarks_in || undefined
            };

            const updated = await updateToolLog(selectedLog.id, updates);
            if (updated) {
                // If fully returned, mark SLA completed
                if (newReturnedTotal >= selectedLog.quantity_out) {
                    await (supabase as any)
                        .from('sla_tracking')
                        .update({ status: 'Completed', completed_time: new Date().toISOString() })
                        .eq('entity_type', 'TOOL')
                        .eq('entity_id', selectedLog.id)
                        .eq('status', 'Pending');
                }

                setIsInModalOpen(false);
                setSelectedLog(null);
                setInForm({
                    quantity_returned: 1,
                    condition_status: 'Good',
                    remarks_in: ''
                });
                fetchLogs();
            } else {
                alert('Failed to log check-in');
            }
        } catch (err: any) {
            console.error('Error checking in tool:', err);
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Generate Printable Receipt
    const handlePrintReceipt = async (log: ToolLog) => {
        if (!currentCompanyId) return;

        // Fetch company logo and profile details
        const { data: comp } = await supabase
            .from('companies')
            .select('*')
            .eq('id', currentCompanyId)
            .single();

        const companyLogo = comp?.logo_url || 'https://raw.githubusercontent.com/jacobjerin38/KAA-ERP-Live1/main/kaa_logo.png';
        const companyName = comp?.name || 'KAA ERP SYSTEM';
        const companyAddress = (comp as any)?.address || `${comp?.address_line_1 || ''} ${comp?.city || ''}`.trim();
        const companyPhone = comp?.phone || '';

        const receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tool Out Receipt - ${log.tool_name}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #333;
                        margin: 40px;
                        line-height: 1.5;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .company-logo {
                        max-height: 60px;
                        max-width: 150px;
                    }
                    .company-details {
                        text-align: right;
                    }
                    .company-name {
                        font-weight: bold;
                        font-size: 1.4rem;
                        margin-bottom: 5px;
                    }
                    .receipt-title {
                        text-align: center;
                        font-size: 1.6rem;
                        font-weight: bold;
                        margin: 30px 0;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .details-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 40px;
                    }
                    .section {
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        padding: 15px;
                        background: #fdfdfd;
                    }
                    .section-title {
                        font-weight: bold;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                        color: #555;
                    }
                    .row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 8px;
                        font-size: 0.95rem;
                    }
                    .label {
                        color: #666;
                        font-weight: 500;
                    }
                    .value {
                        font-weight: bold;
                    }
                    .remarks {
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        padding: 15px;
                        margin-bottom: 60px;
                        background: #fdfdfd;
                    }
                    .remarks-title {
                        font-weight: bold;
                        color: #555;
                        margin-bottom: 5px;
                    }
                    .signatures {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 100px;
                    }
                    .signature-block {
                        width: 40%;
                        text-align: center;
                        border-top: 1px solid #333;
                        padding-top: 10px;
                        font-weight: bold;
                        color: #555;
                    }
                    @media print {
                        body {
                            margin: 20px;
                        }
                        button {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div style="text-align: right; margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-weight: bold; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Print Receipt
                    </button>
                </div>
                
                <div class="header">
                    <img class="company-logo" src="${companyLogo}" alt="Logo" onerror="this.src='https://via.placeholder.com/150x60?text=KAA+ERP'" />
                    <div class="company-details">
                        <div class="company-name">${companyName}</div>
                        <div>${companyAddress}</div>
                        <div>Phone: ${companyPhone}</div>
                    </div>
                </div>

                <div class="receipt-title">Tool Out Receipt</div>

                <div class="details-grid">
                    <div class="section">
                        <div class="section-title">Item Details</div>
                        <div class="row">
                            <span class="label">Tool Name:</span>
                            <span class="value">${log.tool_name}</span>
                        </div>
                        <div class="row">
                            <span class="label">Item Code:</span>
                            <span class="value">${log.item_code || 'N/A'}</span>
                        </div>
                        <div class="row">
                            <span class="label">Serial Number:</span>
                            <span class="value">${log.serial_number || 'N/A'}</span>
                        </div>
                        <div class="row">
                            <span class="label">Quantity Checked Out:</span>
                            <span class="value">${log.quantity_out}</span>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">Assignment & Dates</div>
                        <div class="row">
                            <span class="label">Employee Name:</span>
                            <span class="value">${log.employee_name || 'N/A'}</span>
                        </div>
                        <div class="row">
                            <span class="label">Department:</span>
                            <span class="value">${log.department_name || 'N/A'}</span>
                        </div>
                        <div class="row">
                            <span class="label">Project:</span>
                            <span class="value">${log.project_name || 'N/A'}</span>
                        </div>
                        <div class="row">
                            <span class="label">Date Issued:</span>
                            <span class="value">${new Date(log.date_out).toLocaleDateString()}</span>
                        </div>
                        <div class="row">
                            <span class="label">Expected Return:</span>
                            <span class="value">${log.expected_return_date ? new Date(log.expected_return_date).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="remarks">
                    <div class="remarks-title">Terms & Remarks:</div>
                    <div style="font-size: 0.9rem; color: #555;">
                        ${log.remarks_out || 'The employee takes full responsibility for the tool mentioned in this receipt. The tool must be returned in the same condition as received on or before the expected return date.'}
                    </div>
                </div>

                <div class="signatures">
                    <div class="signature-block">
                        Issued By (Storekeeper / Admin)
                    </div>
                    <div class="signature-block">
                        Received By (Employee Signature)
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
        }
    };

    // Filters
    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            log.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.serial_number && log.serial_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.employee_name && log.employee_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.project_name && log.project_name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const isReturned = (log.quantity_returned || 0) >= log.quantity_out;
        const matchesStatus = 
            filterStatus === 'All' ? true :
            filterStatus === 'Out' ? !isReturned : isReturned;

        return matchesSearch && matchesStatus;
    });

    // Counts
    const totalOut = logs.filter(l => (l.quantity_returned || 0) < l.quantity_out).length;
    const totalReturned = logs.filter(l => (l.quantity_returned || 0) >= l.quantity_out).length;
    const totalOverdue = logs.filter(l => {
        const isReturned = (l.quantity_returned || 0) >= l.quantity_out;
        if (isReturned || !l.expected_return_date) return false;
        return new Date(l.expected_return_date).getTime() < Date.now();
    }).length;
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Tool Tracking</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Log and track tool assignments, returns, and conditions.</p>
                </div>
                <button
                    onClick={() => setIsOutModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Log Tool Out
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-xl">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tools Checked Out</h4>
                        <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">{totalOut}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
                        <ArrowDownLeft className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fully Returned</h4>
                        <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">{totalReturned}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-xl">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Returns</h4>
                        <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">{totalOverdue}</p>
                    </div>
                </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by tool, employee, serial, project..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>

                <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-max">
                    {['All', 'Out', 'Returned'].map(st => (
                        <button
                            key={st}
                            onClick={() => setFilterStatus(st as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                filterStatus === st 
                                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                        <Loader2 className="animate-spin text-indigo-500" /> Loading logs...
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <Boxes className="w-12 h-12 opacity-30 mb-3" />
                        <h4 className="font-bold text-slate-600 dark:text-slate-300">No tool logs found</h4>
                        <p className="text-xs mt-1">Try updating your filters or log a new check-out</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold">
                                    <th className="p-4">Tool details</th>
                                    <th className="p-4">Assigned To</th>
                                    <th className="p-4">Dates</th>
                                    <th className="p-4">Quantity</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                                {filteredLogs.map(log => {
                                    const isReturned = (log.quantity_returned || 0) >= log.quantity_out;
                                    const isOverdue = !isReturned && log.expected_return_date && new Date(log.expected_return_date).getTime() < Date.now();
                                    
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800 dark:text-white text-sm">{log.tool_name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    Code: {log.item_code || 'N/A'} | S/N: {log.serial_number || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-zinc-300">
                                                    <User size={12} className="text-indigo-500" />
                                                    {log.employee_name || 'N/A'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Building size={10} /> {log.department_name || 'N/A'}
                                                    {log.project_name && <> | <Briefcase size={10} /> {log.project_name}</>}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1 mt-0.5 text-slate-500 dark:text-zinc-400">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    Out: {new Date(log.date_out).toLocaleDateString()}
                                                </div>
                                                {log.expected_return_date && (
                                                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <Clock size={10} /> Expected: {new Date(log.expected_return_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700 dark:text-zinc-300">
                                                    {log.quantity_out} Out
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {log.quantity_returned || 0} Returned
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {isReturned ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/10">
                                                        <Check size={10} /> Returned
                                                    </span>
                                                ) : isOverdue ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/10">
                                                        <Clock size={10} /> Overdue
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/10">
                                                        <Clock size={10} /> Active Out
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handlePrintReceipt(log)}
                                                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                                                        title="Print Receipt"
                                                    >
                                                        <Printer size={15} />
                                                    </button>
                                                    {!isReturned && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedLog(log);
                                                                setInForm({
                                                                    quantity_returned: log.quantity_out - (log.quantity_returned || 0),
                                                                    condition_status: 'Good',
                                                                    remarks_in: ''
                                                                });
                                                                setIsInModalOpen(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold"
                                                        >
                                                            Check In
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Log Tool Out Modal */}
            {isOutModalOpen && (
                <Modal title="Log Tool Check-Out" onClose={() => setIsOutModalOpen(false)}>
                    <form onSubmit={handleLogOutSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Tool Name *</label>
                            <input
                                required
                                value={outForm.tool_name}
                                onChange={e => setOutForm({ ...outForm, tool_name: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                placeholder="e.g. Electric Drill, Safety Harness"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Item Code</label>
                                <input
                                    value={outForm.item_code}
                                    onChange={e => setOutForm({ ...outForm, item_code: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                    placeholder="e.g. TOOL-DRILL-01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Serial Number</label>
                                <input
                                    value={outForm.serial_number}
                                    onChange={e => setOutForm({ ...outForm, serial_number: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                    placeholder="e.g. SN123456"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Quantity Out</label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={outForm.quantity_out}
                                    onChange={e => setOutForm({ ...outForm, quantity_out: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Expected Return Date</label>
                                <input
                                    type="date"
                                    value={outForm.expected_return_date}
                                    onChange={e => setOutForm({ ...outForm, expected_return_date: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Assign to Employee</label>
                                <select
                                    value={outForm.employee_id}
                                    onChange={e => setOutForm({ ...outForm, employee_id: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                >
                                    <option value="">Select Employee...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Department</label>
                                <select
                                    value={outForm.department_id}
                                    onChange={e => setOutForm({ ...outForm, department_id: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                >
                                    <option value="">Select Department...</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Project Name</label>
                            <input
                                value={outForm.project_name}
                                onChange={e => setOutForm({ ...outForm, project_name: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                placeholder="e.g. West Bay Tower, Lusail Marina"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Remarks / Terms</label>
                            <textarea
                                value={outForm.remarks_out}
                                onChange={e => setOutForm({ ...outForm, remarks_out: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                rows={3}
                                placeholder="Any specific instructions, terms or physical condition notes on issue..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsOutModalOpen(false)}
                                className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
                            >
                                {saving && <Loader2 className="animate-spin w-4 h-4" />}
                                Check Out Tool
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Check In Modal */}
            {isInModalOpen && selectedLog && (
                <Modal title={`Log Tool Check-In - ${selectedLog.tool_name}`} onClose={() => { setIsInModalOpen(false); setSelectedLog(null); }}>
                    <form onSubmit={handleCheckInSubmit} className="space-y-4">
                        <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-xl text-slate-600 dark:text-slate-400">
                            <div className="font-bold text-slate-800 dark:text-white mb-1">Log Summary</div>
                            <div>Checked Out: <span className="font-semibold">{selectedLog.quantity_out}</span> by {selectedLog.employee_name || 'N/A'}</div>
                            {selectedLog.quantity_returned > 0 && <div>Already Returned: <span className="font-semibold text-emerald-600">{selectedLog.quantity_returned}</span></div>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Quantity Returned *</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedLog.quantity_out - (selectedLog.quantity_returned || 0)}
                                    required
                                    value={inForm.quantity_returned}
                                    onChange={e => setInForm({ ...inForm, quantity_returned: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Condition Status *</label>
                                <select
                                    required
                                    value={inForm.condition_status}
                                    onChange={e => setInForm({ ...inForm, condition_status: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                >
                                    <option value="Good">Good (Ready for Use)</option>
                                    <option value="Damaged">Damaged (Needs Repair)</option>
                                    <option value="Needs Repair">Needs Repair / Maintenance</option>
                                    <option value="Lost">Lost</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">Check-in Remarks</label>
                            <textarea
                                value={inForm.remarks_in}
                                onChange={e => setInForm({ ...inForm, remarks_in: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm"
                                rows={3}
                                placeholder="Describe physical condition, lost details, repair needs etc..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => { setIsInModalOpen(false); setSelectedLog(null); }}
                                className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1.5"
                            >
                                {saving && <Loader2 className="animate-spin w-4 h-4" />}
                                Check In Tool
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
