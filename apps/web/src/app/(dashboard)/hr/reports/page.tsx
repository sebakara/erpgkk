'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, FileText, Search, BarChart2, Users, Building2, Calendar } from 'lucide-react';
import { reportsApi, usersApi, departmentsApi } from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';

/* ── date helpers ─────────────────────────────────────────── */
function today() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function monthsAgo(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); }

const PRESETS = [
  { label: 'This month',    from: () => firstOfMonth(),   to: () => today() },
  { label: 'Last month',    from: () => monthsAgo(1),      to: () => firstOfMonth() },
  { label: 'Last 3 months', from: () => monthsAgo(3),      to: () => today() },
  { label: 'Last 6 months', from: () => monthsAgo(6),      to: () => today() },
  { label: 'This year',     from: () => `${new Date().getFullYear()}-01-01`, to: () => today() },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

const STATUS_STYLE: Record<string, string> = {
  done: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  todo: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

/* ── Excel export ─────────────────────────────────────────── */
async function exportExcel(type: 'employee' | 'department', data: any) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  if (type === 'employee') {
    const { employee, leaveRequests, leaveSummary, performance, tasks } = data;

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Employee Report'],
      ['Name', `${employee.first_name} ${employee.last_name}`],
      ['Email', employee.email],
      ['Job Title', employee.job_title ?? ''],
      ['Department', employee.department_name ?? ''],
      ['Period', `${formatDate(data.dateFrom)} — ${formatDate(data.dateTo)}`],
    ]), 'Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Type', 'Start', 'End', 'Status', 'Reason'],
      ...leaveRequests.map((l: any) => [capitalize(l.type), l.start_date, l.end_date, l.status, l.reason ?? '']),
    ]), 'Leave Requests');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Period', 'Score', 'Status', 'Feedback', 'Reviewer'],
      ...performance.map((p: any) => [p.period, p.score ?? '', p.status, p.feedback ?? '', p.reviewer_name ?? '']),
    ]), 'Performance');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Task', 'Project', 'Status', 'Priority'],
      ...tasks.map((t: any) => [t.title, t.project_name ?? '', t.status, t.priority ?? '']),
    ]), 'Tasks');

    XLSX.writeFile(wb, `report-${employee.last_name}-${data.dateFrom}.xlsx`);
  } else {
    const { department, employees } = data;

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Department Report'],
      ['Department', department.name],
      ['Headcount', data.headcount],
      ['Total Leave Days Taken', data.totalLeaveDays],
      ['Avg Performance Score', data.avgDeptScore ?? 'N/A'],
      ['Period', `${formatDate(data.dateFrom)} — ${formatDate(data.dateTo)}`],
    ]), 'Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Name', 'Job Title', 'Leave Days', 'Leave Requests', 'Avg Score', 'Tasks Total', 'Tasks Done'],
      ...employees.map((e: any) => [
        `${e.first_name} ${e.last_name}`, e.job_title ?? '',
        e.leaveDays, e.leaveCount, e.avgScore ?? 'N/A', e.tasksTotal, e.tasksDone,
      ]),
    ]), 'Employees');

    XLSX.writeFile(wb, `report-dept-${department.name.replace(/\s+/g, '-')}-${data.dateFrom}.xlsx`);
  }
}

/* ── PDF export ───────────────────────────────────────────── */
async function exportPdf(type: 'employee' | 'department', data: any) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();

  const period = `${formatDate(data.dateFrom)} — ${formatDate(data.dateTo)}`;

  if (type === 'employee') {
    const { employee, leaveRequests, leaveSummary, performance, tasks } = data;
    doc.setFontSize(18);
    doc.text('Employee Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`Name: ${employee.first_name} ${employee.last_name}`, 14, 32);
    doc.text(`Department: ${employee.department_name ?? '—'}`, 14, 39);
    doc.text(`Job Title: ${employee.job_title ?? '—'}`, 14, 46);
    doc.text(`Period: ${period}`, 14, 53);

    autoTable(doc, {
      startY: 60,
      head: [['Leave Type', 'Requests', 'Approved Days']],
      body: Object.entries(leaveSummary).map(([type, s]: any) => [capitalize(type), s.total, s.days]),
      headStyles: { fillColor: [79, 70, 229] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Leave Type', 'Start', 'End', 'Status']],
      body: leaveRequests.map((l: any) => [capitalize(l.type), l.start_date, l.end_date, l.status]),
      headStyles: { fillColor: [79, 70, 229] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Task', 'Project', 'Status', 'Priority']],
      body: tasks.map((t: any) => [t.title, t.project_name ?? '—', t.status, t.priority ?? '—']),
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`report-${employee.last_name}-${data.dateFrom}.pdf`);
  } else {
    const { department, employees } = data;
    doc.setFontSize(18);
    doc.text('Department Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`Department: ${department.name}`, 14, 32);
    doc.text(`Headcount: ${data.headcount}`, 14, 39);
    doc.text(`Period: ${period}`, 14, 46);

    autoTable(doc, {
      startY: 54,
      head: [['Employee', 'Job Title', 'Leave Days', 'Avg Score', 'Tasks Done']],
      body: employees.map((e: any) => [
        `${e.first_name} ${e.last_name}`, e.job_title ?? '—',
        e.leaveDays, e.avgScore ?? '—', `${e.tasksDone}/${e.tasksTotal}`,
      ]),
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`report-dept-${department.name.replace(/\s+/g, '-')}-${data.dateFrom}.pdf`);
  }
}

/* ── Main component ───────────────────────────────────────── */
export default function ReportsPage() {
  const [reportType, setReportType] = useState<'employee' | 'department'>('employee');
  const [selectedId, setSelectedId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [fetched, setFetched] = useState(false);

  const { data: employees = [] } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() });

  const employeeQuery = useQuery({
    queryKey: ['report-employee', selectedId, dateFrom, dateTo],
    queryFn: () => reportsApi.employee({ userId: selectedId, dateFrom, dateTo }),
    enabled: false,
  });

  const deptQuery = useQuery({
    queryKey: ['report-dept', selectedId, dateFrom, dateTo],
    queryFn: () => reportsApi.department({ departmentId: selectedId, dateFrom, dateTo }),
    enabled: false,
  });

  const report = reportType === 'employee' ? employeeQuery : deptQuery;
  const data = report.data;

  const handleGenerate = async () => {
    if (!selectedId) return toast.error('Please select an employee or department');
    setFetched(true);
    if (reportType === 'employee') await employeeQuery.refetch();
    else await deptQuery.refetch();
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!data) return;
    try {
      if (format === 'excel') await exportExcel(reportType, data);
      else await exportPdf(reportType, data);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={18} className="text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-800">Generate Report</h2>
        </div>

        {/* Report type */}
        <div className="flex gap-2">
          {(['employee', 'department'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setReportType(t); setSelectedId(''); setFetched(false); }}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border transition-colors',
                reportType === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300',
              )}
            >
              {t === 'employee' ? <Users size={14} /> : <Building2 size={14} />}
              {t === 'employee' ? 'Employee' : 'Department'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Entity select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {reportType === 'employee' ? 'Select Employee' : 'Select Department'}
            </label>
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setFetched(false); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— choose —</option>
              {reportType === 'employee'
                ? (employees as any[]).map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))
                : (departments as any[]).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-400 self-center">Quick:</span>
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { setDateFrom(p.from()); setDateTo(p.to()); setFetched(false); }}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 rounded-full transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={handleGenerate} disabled={report.isFetching}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60">
            {report.isFetching
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Search size={15} />}
            Generate Report
          </button>
        </div>
      </div>

      {/* Results */}
      {fetched && data && (
        <div className="space-y-4">
          {/* Export toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Report for <span className="font-semibold text-gray-800">
                {reportType === 'employee'
                  ? `${data.employee?.first_name} ${data.employee?.last_name}`
                  : data.department?.name}
              </span> · {formatDate(dateFrom)} — {formatDate(dateTo)}
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleExport('excel')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors">
                <FileSpreadsheet size={15} /> Export Excel
              </button>
              <button onClick={() => handleExport('pdf')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                <FileText size={15} /> Export PDF
              </button>
            </div>
          </div>

          {/* Employee report */}
          {reportType === 'employee' && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 text-xl font-bold flex items-center justify-center shrink-0">
                  {data.employee?.avatar_url
                    ? <img src={data.employee.avatar_url} className="w-14 h-14 rounded-full object-cover" />
                    : getInitials(`${data.employee?.first_name} ${data.employee?.last_name}`)}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-gray-900">{data.employee?.first_name} {data.employee?.last_name}</p>
                  <p className="text-sm text-gray-500">{data.employee?.job_title ?? '—'} · {data.employee?.department_name ?? '—'}</p>
                  <p className="text-xs text-gray-400">{data.employee?.email}</p>
                </div>
                {data.avgScore !== null && (
                  <div className="text-center shrink-0">
                    <p className="text-3xl font-bold text-indigo-600">{data.avgScore}</p>
                    <p className="text-xs text-gray-400">Avg Score</p>
                  </div>
                )}
              </div>

              {/* Leave summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Leave Summary</h3>
                {Object.keys(data.leaveSummary ?? {}).length === 0
                  ? <p className="text-sm text-gray-400">No leave requests in this period.</p>
                  : <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-2">Type</th><th className="pb-2">Requests</th><th className="pb-2">Approved Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.leaveSummary).map(([type, s]: any) => (
                          <tr key={type} className="border-b border-gray-50">
                            <td className="py-2 font-medium">{capitalize(type)}</td>
                            <td className="py-2 text-gray-600">{s.total}</td>
                            <td className="py-2 text-gray-600">{s.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>}
              </div>

              {/* Leave requests */}
              {data.leaveRequests?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Leave Requests</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2">Type</th><th className="pb-2">Start</th><th className="pb-2">End</th><th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaveRequests.map((l: any) => (
                        <tr key={l.id} className="border-b border-gray-50">
                          <td className="py-2 font-medium">{capitalize(l.type)}</td>
                          <td className="py-2 text-gray-600">{formatDate(l.start_date)}</td>
                          <td className="py-2 text-gray-600">{formatDate(l.end_date)}</td>
                          <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[l.status])}>{l.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tasks */}
              {data.tasks?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned Tasks ({data.tasks.length})</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2">Task</th><th className="pb-2">Project</th><th className="pb-2">Status</th><th className="pb-2">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tasks.map((t: any) => (
                        <tr key={t.id} className="border-b border-gray-50">
                          <td className="py-2 font-medium max-w-xs truncate">{t.title}</td>
                          <td className="py-2 text-gray-500">{t.project_name ?? '—'}</td>
                          <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-600')}>{t.status.replace('_', ' ')}</span></td>
                          <td className="py-2 text-gray-500 capitalize">{t.priority ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Performance */}
              {data.performance?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance Reviews</h3>
                  <div className="space-y-3">
                    {data.performance.map((p: any) => (
                      <div key={p.id} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">{p.period}</span>
                          {p.score && <span className="text-lg font-bold text-indigo-600">{p.score}/100</span>}
                        </div>
                        {p.feedback && <p className="text-sm text-gray-500">{p.feedback}</p>}
                        <p className="text-xs text-gray-400 mt-1">by {p.reviewer_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Department report */}
          {reportType === 'department' && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Headcount', value: data.headcount, icon: <Users size={18} className="text-indigo-500" /> },
                  { label: 'Total Leave Days', value: data.totalLeaveDays, icon: <Calendar size={18} className="text-amber-500" /> },
                  { label: 'Avg Performance', value: data.avgDeptScore ?? 'N/A', icon: <BarChart2 size={18} className="text-green-500" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
                    {icon}
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Employee breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Employee Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2">Employee</th>
                      <th className="pb-2">Job Title</th>
                      <th className="pb-2">Leave Days</th>
                      <th className="pb-2">Avg Score</th>
                      <th className="pb-2">Tasks Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employees?.map((e: any) => (
                      <tr key={e.id} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{e.first_name} {e.last_name}</td>
                        <td className="py-2 text-gray-500">{e.job_title ?? '—'}</td>
                        <td className="py-2 text-gray-600">{e.leaveDays}</td>
                        <td className="py-2 text-gray-600">{e.avgScore ?? '—'}</td>
                        <td className="py-2 text-gray-600">{e.tasksDone}/{e.tasksTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {fetched && !data && !report.isFetching && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <FileDown size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No data found for the selected period.</p>
        </div>
      )}
    </div>
  );
}
