'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileDown, FileSpreadsheet, FileText, Search, BarChart2, Users, Building2,
  Calendar, TrendingUp, TrendingDown, Minus, CheckCircle2, Clock, AlertTriangle,
  Star, UserPlus, Target, Award,
} from 'lucide-react';
import { reportsApi, usersApi, departmentsApi } from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';

/* ── helpers ──────────────────────────────────────────────── */
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

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—'; }
function tenure(hireDate: string) {
  const months = Math.floor((Date.now() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 1) return '< 1 month';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years}y${rem > 0 ? ` ${rem}m` : ''}`;
}
function isOverdue(due: string, status: string) {
  return due && status !== 'done' && new Date(due) < new Date();
}

const STATUS_STYLE: Record<string, string> = {
  done: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  todo: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
};

/* ── Excel export ─────────────────────────────────────────── */
async function exportExcel(type: 'employee' | 'department', data: any) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  if (type === 'employee') {
    const { employee, leaveRequests, leaveSummary, performance, tasks, taskStats } = data;

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Employee Report'],
      [],
      ['Name', `${employee.first_name} ${employee.last_name}`],
      ['Email', employee.email],
      ['Job Title', employee.job_title ?? ''],
      ['Department', employee.department_name ?? ''],
      ['Reports To', employee.reports_to_name ?? ''],
      ['Hire Date', employee.hire_date ? fmt(employee.hire_date) : ''],
      ['Tenure', employee.hire_date ? tenure(employee.hire_date) : ''],
      ['Period', `${fmt(data.dateFrom)} — ${fmt(data.dateTo)}`],
      [],
      ['Task Summary'],
      ['Total', taskStats.total],
      ['Done', taskStats.done],
      ['In Progress', taskStats.in_progress],
      ['To Do', taskStats.todo],
      ['Overdue', taskStats.overdue],
      ['Completion Rate', taskStats.total ? `${Math.round((taskStats.done / taskStats.total) * 100)}%` : 'N/A'],
      [],
      ['Avg Performance Score', data.avgScore ?? 'N/A'],
      ['Total Leave Days Taken', data.totalLeaveDays ?? 0],
    ]), 'Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Type', 'Total Requests', 'Approved', 'Rejected', 'Pending', 'Approved Days'],
      ...Object.entries(leaveSummary).map(([type, s]: any) => [
        capitalize(type), s.total, s.approved, s.rejected, s.pending, s.days,
      ]),
    ]), 'Leave Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Type', 'Start', 'End', 'Days', 'Status', 'Reason'],
      ...leaveRequests.map((l: any) => {
        const days = Math.ceil((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1;
        return [capitalize(l.type), l.start_date, l.end_date, days, l.status, l.reason ?? ''];
      }),
    ]), 'Leave Requests');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Period', 'Score', 'Status', 'Feedback', 'Reviewer'],
      ...performance.map((p: any) => [p.period, p.score ?? '', p.status, p.feedback ?? '', p.reviewer_name ?? '']),
    ]), 'Performance');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Task', 'Project', 'Sprint', 'Status', 'Priority', 'Due Date', 'Overdue'],
      ...tasks.map((t: any) => [
        t.title, t.project_name ?? '', t.sprint_name ?? '', t.status, t.priority ?? '',
        t.due_date ? fmt(t.due_date) : '', isOverdue(t.due_date, t.status) ? 'Yes' : 'No',
      ]),
    ]), 'Tasks');

    XLSX.writeFile(wb, `employee-report-${employee.last_name}-${data.dateFrom}.xlsx`);
  } else {
    const { department, employees, topPerformers, perfDistribution } = data;

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Department Report'],
      [],
      ['Department', department.name],
      ['Manager', department.manager_name ?? 'N/A'],
      ['Period', `${fmt(data.dateFrom)} — ${fmt(data.dateTo)}`],
      [],
      ['Headcount', data.headcount],
      ['New Hires (in period)', data.newHires],
      ['Total Leave Days', data.totalLeaveDays],
      ['Avg Performance Score', data.avgDeptScore ?? 'N/A'],
      ['Tasks Done / Total', `${data.totalTasksDone} / ${data.totalTasksAll}`],
      [],
      ['Performance Distribution'],
      ['Excellent (≥80)', perfDistribution.excellent],
      ['Good (60–79)', perfDistribution.good],
      ['Needs Improvement (<60)', perfDistribution.needsImprovement],
    ]), 'Summary');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Name', 'Job Title', 'Hire Date', 'Leave Days', 'Leave Count', 'Avg Score', 'Tasks Done', 'Tasks Total', 'Completion %', 'Overdue Tasks'],
      ...employees.map((e: any) => [
        `${e.first_name} ${e.last_name}`, e.job_title ?? '',
        e.hire_date ? fmt(e.hire_date) : '',
        e.leaveDays, e.leaveCount, e.avgScore ?? 'N/A',
        e.tasksDone, e.tasksTotal,
        e.completionRate !== null ? `${e.completionRate}%` : 'N/A',
        e.tasksOverdue,
      ]),
    ]), 'Employees');

    if (topPerformers.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Rank', 'Name', 'Job Title', 'Avg Score', 'Tasks Done'],
        ...topPerformers.map((e: any, i: number) => [
          i + 1, `${e.first_name} ${e.last_name}`, e.job_title ?? '', e.avgScore, `${e.tasksDone}/${e.tasksTotal}`,
        ]),
      ]), 'Top Performers');
    }

    XLSX.writeFile(wb, `dept-report-${department.name.replace(/\s+/g, '-')}-${data.dateFrom}.xlsx`);
  }
}

/* ── PDF export ───────────────────────────────────────────── */
async function exportPdf(type: 'employee' | 'department', data: any) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  const INDIGO: [number, number, number] = [79, 70, 229];
  const period = `${fmt(data.dateFrom)} — ${fmt(data.dateTo)}`;

  if (type === 'employee') {
    const { employee, leaveRequests, leaveSummary, performance, tasks, taskStats } = data;

    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text('Employee Report', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${fmt(today())}  |  Period: ${period}`, 14, 25);

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`${employee.first_name} ${employee.last_name}`, 14, 35);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`${employee.job_title ?? '—'}  ·  ${employee.department_name ?? '—'}`, 14, 41);
    doc.text(`Email: ${employee.email}`, 14, 47);
    if (employee.reports_to_name) doc.text(`Reports to: ${employee.reports_to_name}`, 14, 53);
    if (employee.hire_date) doc.text(`Hired: ${fmt(employee.hire_date)}  (${tenure(employee.hire_date)} tenure)`, 14, 59);
    if (data.avgScore !== null) {
      doc.setFontSize(14);
      doc.setTextColor(...INDIGO);
      doc.text(`Avg Score: ${data.avgScore}/100`, 140, 41);
    }

    // Task summary
    const taskY = employee.hire_date ? 68 : 62;
    autoTable(doc, {
      startY: taskY,
      head: [['Task Stats', 'Count']],
      body: [
        ['Total Tasks', taskStats.total],
        ['Done', taskStats.done],
        ['In Progress', taskStats.in_progress],
        ['To Do', taskStats.todo],
        ['Overdue', taskStats.overdue],
        ['Completion Rate', taskStats.total ? `${Math.round((taskStats.done / taskStats.total) * 100)}%` : 'N/A'],
      ],
      headStyles: { fillColor: INDIGO },
      tableWidth: 80,
    });

    autoTable(doc, {
      startY: taskY,
      margin: { left: 110 },
      head: [['Leave Type', 'Requests', 'Days Taken']],
      body: Object.entries(leaveSummary).map(([type, s]: any) => [capitalize(type), s.total, s.days]),
      headStyles: { fillColor: INDIGO },
      tableWidth: 90,
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Type', 'Start', 'End', 'Status', 'Reason']],
      body: leaveRequests.map((l: any) => [capitalize(l.type), l.start_date, l.end_date, capitalize(l.status), l.reason ?? '—']),
      headStyles: { fillColor: INDIGO },
      columnStyles: { 4: { cellWidth: 60 } },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Task', 'Project', 'Sprint', 'Status', 'Priority', 'Due Date']],
      body: tasks.map((t: any) => [
        t.title, t.project_name ?? '—', t.sprint_name ?? '—',
        capitalize(t.status), capitalize(t.priority ?? '—'), t.due_date ? fmt(t.due_date) : '—',
      ]),
      headStyles: { fillColor: INDIGO },
      columnStyles: { 0: { cellWidth: 55 } },
    });

    if (performance.length) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Period', 'Score', 'Feedback', 'Reviewer']],
        body: performance.map((p: any) => [p.period, p.score ?? 'N/A', p.feedback ?? '—', p.reviewer_name ?? '—']),
        headStyles: { fillColor: INDIGO },
        columnStyles: { 2: { cellWidth: 70 } },
      });
    }

    doc.save(`employee-report-${employee.last_name}-${data.dateFrom}.pdf`);
  } else {
    const { department, employees, topPerformers, perfDistribution } = data;

    doc.setFontSize(20);
    doc.text('Department Report', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${fmt(today())}  |  Period: ${period}`, 14, 25);

    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(`${department.name}`, 14, 35);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (department.manager_name) doc.text(`Manager: ${department.manager_name}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Headcount', data.headcount],
        ['New Hires (in period)', data.newHires],
        ['Total Leave Days', data.totalLeaveDays],
        ['Avg Performance Score', data.avgDeptScore ?? 'N/A'],
        ['Tasks Done / Total', `${data.totalTasksDone} / ${data.totalTasksAll}`],
        ['Excellent performers (≥80)', perfDistribution.excellent],
        ['Good performers (60–79)', perfDistribution.good],
        ['Needs improvement (<60)', perfDistribution.needsImprovement],
      ],
      headStyles: { fillColor: INDIGO },
      tableWidth: 100,
    });

    if (topPerformers.length) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['Top Performers', 'Job Title', 'Score', 'Tasks Done']],
        body: topPerformers.map((e: any) => [
          `${e.first_name} ${e.last_name}`, e.job_title ?? '—', e.avgScore, `${e.tasksDone}/${e.tasksTotal}`,
        ]),
        headStyles: { fillColor: [34, 197, 94] },
      });
    }

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Employee', 'Job Title', 'Leave Days', 'Avg Score', 'Completion %', 'Overdue']],
      body: employees.map((e: any) => [
        `${e.first_name} ${e.last_name}`, e.job_title ?? '—',
        e.leaveDays, e.avgScore ?? '—',
        e.completionRate !== null ? `${e.completionRate}%` : 'N/A',
        e.tasksOverdue,
      ]),
      headStyles: { fillColor: INDIGO },
    });

    doc.save(`dept-report-${department.name.replace(/\s+/g, '-')}-${data.dateFrom}.pdf`);
  }
}

/* ── Reusable components ─────────────────────────────────── */
function StatCard({ label, value, sub, icon, color = 'indigo' }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-600 bg-indigo-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={cn('p-2.5 rounded-lg', colors[color])}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = 'indigo' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColor: Record<string, string> = {
    indigo: 'bg-indigo-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor[color])} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
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
    } catch (e) {
      console.error(e);
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
                ? (employees as any[]).map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)
                : (departments as any[]).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">
              Report for{' '}
              <span className="font-semibold text-gray-800">
                {reportType === 'employee'
                  ? `${data.employee?.first_name} ${data.employee?.last_name}`
                  : data.department?.name}
              </span>{' '}
              · {fmt(dateFrom)} — {fmt(dateTo)}
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

          {/* ── Employee report ── */}
          {reportType === 'employee' && (
            <div className="space-y-4">
              {/* Profile header */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 text-xl font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {data.employee?.avatar_url
                      ? <img src={data.employee.avatar_url} className="w-16 h-16 object-cover" />
                      : getInitials(`${data.employee?.first_name} ${data.employee?.last_name}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-900">{data.employee?.first_name} {data.employee?.last_name}</p>
                    <p className="text-sm text-gray-600">{data.employee?.job_title ?? '—'} · {data.employee?.department_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{data.employee?.email}</p>
                    {data.employee?.reports_to_name && (
                      <p className="text-xs text-gray-400 mt-0.5">Reports to: <span className="text-gray-600">{data.employee.reports_to_name}</span></p>
                    )}
                    {data.employee?.hire_date && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Hired {fmt(data.employee.hire_date)} · <span className="text-indigo-600 font-medium">{tenure(data.employee.hire_date)} tenure</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {data.avgScore !== null && (
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <p className="text-3xl font-bold text-indigo-600">{data.avgScore}</p>
                          {data.scoreTrend === 'up' && <TrendingUp size={16} className="text-green-500" />}
                          {data.scoreTrend === 'down' && <TrendingDown size={16} className="text-red-500" />}
                          {data.scoreTrend === 'stable' && <Minus size={16} className="text-gray-400" />}
                        </div>
                        <p className="text-xs text-gray-400">Avg Score / 100</p>
                        {data.scoreTrend && (
                          <p className={cn('text-xs font-medium', data.scoreTrend === 'up' ? 'text-green-600' : data.scoreTrend === 'down' ? 'text-red-600' : 'text-gray-400')}>
                            {data.scoreTrend === 'up' ? 'Improving' : data.scoreTrend === 'down' ? 'Declining' : 'Stable'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Task & leave stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Tasks Total" value={data.taskStats.total} icon={<Target size={16} />} color="indigo" />
                <StatCard label="Tasks Done" value={data.taskStats.done}
                  sub={data.taskStats.total ? `${Math.round((data.taskStats.done / data.taskStats.total) * 100)}% completion` : undefined}
                  icon={<CheckCircle2 size={16} />} color="green" />
                <StatCard label="In Progress" value={data.taskStats.in_progress} icon={<Clock size={16} />} color="blue" />
                <StatCard label="Overdue" value={data.taskStats.overdue} icon={<AlertTriangle size={16} />} color={data.taskStats.overdue > 0 ? 'red' : 'indigo'} />
              </div>

              {/* Task completion bar */}
              {data.taskStats.total > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Task completion rate</span>
                    <span>{data.taskStats.done}/{data.taskStats.total}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.round((data.taskStats.done / data.taskStats.total) * 100)}%` }} />
                    <div className="h-full bg-blue-400 transition-all" style={{ width: `${Math.round((data.taskStats.in_progress / data.taskStats.total) * 100)}%` }} />
                    <div className="h-full bg-gray-200 transition-all" style={{ width: `${Math.round((data.taskStats.todo / data.taskStats.total) * 100)}%` }} />
                  </div>
                  <div className="flex gap-4 mt-2">
                    {[
                      { label: 'Done', color: 'bg-green-500' },
                      { label: 'In Progress', color: 'bg-blue-400' },
                      { label: 'To Do', color: 'bg-gray-200' },
                    ].map(({ label, color }) => (
                      <span key={label} className="flex items-center gap-1 text-xs text-gray-500">
                        <span className={cn('w-2 h-2 rounded-full', color)} />{label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Leave summary */}
              <SectionCard title={`Leave Summary · ${data.totalLeaveDays ?? 0} days taken`}>
                {Object.keys(data.leaveSummary ?? {}).length === 0
                  ? <p className="text-sm text-gray-400">No leave requests in this period.</p>
                  : <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                          <th className="pb-2 font-medium">Type</th>
                          <th className="pb-2 font-medium">Total</th>
                          <th className="pb-2 font-medium text-green-600">Approved</th>
                          <th className="pb-2 font-medium text-red-500">Rejected</th>
                          <th className="pb-2 font-medium text-amber-500">Pending</th>
                          <th className="pb-2 font-medium">Days Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.leaveSummary).map(([type, s]: any) => (
                          <tr key={type} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 font-medium capitalize">{capitalize(type)}</td>
                            <td className="py-2 text-gray-600">{s.total}</td>
                            <td className="py-2 text-green-600">{s.approved}</td>
                            <td className="py-2 text-red-500">{s.rejected}</td>
                            <td className="py-2 text-amber-500">{s.pending}</td>
                            <td className="py-2 text-gray-600 font-medium">{s.days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>}
              </SectionCard>

              {/* Leave requests detail */}
              {data.leaveRequests?.length > 0 && (
                <SectionCard title={`Leave Requests (${data.leaveRequests.length})`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Start</th>
                        <th className="pb-2 font-medium">End</th>
                        <th className="pb-2 font-medium">Days</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaveRequests.map((l: any) => {
                        const days = Math.ceil((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1;
                        return (
                          <tr key={l.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 font-medium">{capitalize(l.type)}</td>
                            <td className="py-2 text-gray-600">{fmt(l.start_date)}</td>
                            <td className="py-2 text-gray-600">{fmt(l.end_date)}</td>
                            <td className="py-2 text-gray-600">{days}</td>
                            <td className="py-2">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[l.status])}>
                                {l.status}
                              </span>
                            </td>
                            <td className="py-2 text-gray-400 text-xs max-w-[180px] truncate">{l.reason || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </SectionCard>
              )}

              {/* Tasks */}
              {data.tasks?.length > 0 && (
                <SectionCard title={`Assigned Tasks (${data.tasks.length})`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Task</th>
                        <th className="pb-2 font-medium">Project</th>
                        <th className="pb-2 font-medium">Sprint</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Priority</th>
                        <th className="pb-2 font-medium">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tasks.map((t: any) => (
                        <tr key={t.id} className={cn('border-b border-gray-50 last:border-0', isOverdue(t.due_date, t.status) && 'bg-red-50/40')}>
                          <td className="py-2 font-medium max-w-[180px]">
                            <span className="line-clamp-1">{t.title}</span>
                          </td>
                          <td className="py-2 text-gray-500 text-xs">{t.project_name ?? '—'}</td>
                          <td className="py-2 text-gray-400 text-xs">{t.sprint_name ?? '—'}</td>
                          <td className="py-2">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-600')}>
                              {capitalize(t.status)}
                            </span>
                          </td>
                          <td className="py-2">
                            {t.priority
                              ? <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_STYLE[t.priority] ?? 'bg-gray-100 text-gray-500')}>{capitalize(t.priority)}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="py-2 text-xs">
                            {t.due_date
                              ? <span className={cn(isOverdue(t.due_date, t.status) ? 'text-red-600 font-medium' : 'text-gray-500')}>
                                  {fmt(t.due_date)}{isOverdue(t.due_date, t.status) && ' ⚠'}
                                </span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SectionCard>
              )}

              {/* Performance reviews */}
              {data.performance?.length > 0 && (
                <SectionCard title="Performance Reviews">
                  <div className="space-y-3">
                    {data.performance.map((p: any, i: number) => {
                      const prev = data.performance[i - 1];
                      const trend = prev?.score != null && p.score != null
                        ? p.score > prev.score ? 'up' : p.score < prev.score ? 'down' : 'stable'
                        : null;
                      return (
                        <div key={p.id} className="border border-gray-100 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-sm font-semibold text-gray-800">{p.period}</span>
                              <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-600')}>{p.status}</span>
                            </div>
                            {p.score != null && (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xl font-bold text-indigo-600">{p.score}<span className="text-sm font-normal text-gray-400">/100</span></span>
                                {trend === 'up' && <TrendingUp size={14} className="text-green-500" />}
                                {trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
                              </div>
                            )}
                          </div>
                          {p.score != null && (
                            <div className="mt-2">
                              <ProgressBar value={p.score} max={100} color={p.score >= 80 ? 'green' : p.score >= 60 ? 'indigo' : 'amber'} />
                            </div>
                          )}
                          {p.feedback && <p className="text-sm text-gray-500 mt-2">{p.feedback}</p>}
                          <p className="text-xs text-gray-400 mt-1.5">Reviewed by {p.reviewer_name ?? '—'}</p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── Department report ── */}
          {reportType === 'department' && (
            <div className="space-y-4">
              {/* Department header */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 rounded-xl">
                    <Building2 size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{data.department?.name}</p>
                    {data.department?.manager_name && (
                      <p className="text-sm text-gray-500">Manager: <span className="font-medium text-gray-700">{data.department.manager_name}</span></p>
                    )}
                    <p className="text-xs text-gray-400">{fmt(dateFrom)} — {fmt(dateTo)}</p>
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Headcount" value={data.headcount} icon={<Users size={16} />} color="indigo" />
                <StatCard label="New Hires" value={data.newHires} sub="in this period" icon={<UserPlus size={16} />} color="green" />
                <StatCard label="Total Leave Days" value={data.totalLeaveDays} icon={<Calendar size={16} />} color="amber" />
                <StatCard
                  label="Avg Performance"
                  value={data.avgDeptScore ?? 'N/A'}
                  sub={data.avgDeptScore ? '/100' : 'no reviews'}
                  icon={<BarChart2 size={16} />}
                  color="purple"
                />
              </div>

              {/* Task summary */}
              {data.totalTasksAll > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span className="font-medium text-gray-700 text-sm">Department task completion</span>
                    <span>{data.totalTasksDone}/{data.totalTasksAll} done</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.round((data.totalTasksDone / data.totalTasksAll) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{Math.round((data.totalTasksDone / data.totalTasksAll) * 100)}% completion rate</p>
                </div>
              )}

              {/* Performance distribution */}
              {(data.perfDistribution.excellent + data.perfDistribution.good + data.perfDistribution.needsImprovement) > 0 && (
                <SectionCard title="Performance Distribution">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Excellent', sub: '≥ 80', value: data.perfDistribution.excellent, color: 'text-green-600', bg: 'bg-green-50' },
                      { label: 'Good', sub: '60 – 79', value: data.perfDistribution.good, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                      { label: 'Needs Improvement', sub: '< 60', value: data.perfDistribution.needsImprovement, color: 'text-amber-600', bg: 'bg-amber-50' },
                    ].map(({ label, sub, value, color, bg }) => (
                      <div key={label} className={cn('rounded-lg p-4 text-center', bg)}>
                        <p className={cn('text-3xl font-bold', color)}>{value}</p>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
                        <p className="text-xs text-gray-400">{sub}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Top performers */}
              {data.topPerformers?.length > 0 && (
                <SectionCard title="Top Performers">
                  <div className="space-y-3">
                    {data.topPerformers.map((e: any, i: number) => (
                      <div key={e.id} className="flex items-center gap-3">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                          i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600',
                        )}>
                          {i === 0 ? <Award size={14} /> : i + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                          {e.avatar_url ? <img src={e.avatar_url} className="w-8 h-8 object-cover" /> : getInitials(`${e.first_name} ${e.last_name}`)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{e.first_name} {e.last_name}</p>
                          <p className="text-xs text-gray-400">{e.job_title ?? '—'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-indigo-600">{e.avgScore}<span className="text-xs font-normal text-gray-400">/100</span></p>
                          <p className="text-xs text-gray-400">{e.tasksDone}/{e.tasksTotal} tasks</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Employee breakdown */}
              <SectionCard title="Employee Breakdown">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Employee</th>
                        <th className="pb-2 font-medium">Job Title</th>
                        <th className="pb-2 font-medium">Hire Date</th>
                        <th className="pb-2 font-medium">Leave Days</th>
                        <th className="pb-2 font-medium">Avg Score</th>
                        <th className="pb-2 font-medium">Completion</th>
                        <th className="pb-2 font-medium">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees?.map((e: any) => (
                        <tr key={e.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                                {e.avatar_url ? <img src={e.avatar_url} className="w-7 h-7 object-cover" /> : getInitials(`${e.first_name} ${e.last_name}`)}
                              </div>
                              <span className="font-medium text-gray-800">{e.first_name} {e.last_name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-gray-500 text-xs">{e.job_title ?? '—'}</td>
                          <td className="py-2.5 text-gray-400 text-xs">{e.hire_date ? fmt(e.hire_date) : '—'}</td>
                          <td className="py-2.5 text-gray-600">{e.leaveDays}</td>
                          <td className="py-2.5">
                            {e.avgScore !== null
                              ? <span className={cn('font-semibold', e.avgScore >= 80 ? 'text-green-600' : e.avgScore >= 60 ? 'text-indigo-600' : 'text-amber-600')}>
                                  {e.avgScore}
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="py-2.5 w-32">
                            {e.tasksTotal > 0
                              ? <div className="space-y-0.5">
                                  <ProgressBar value={e.tasksDone} max={e.tasksTotal}
                                    color={e.completionRate >= 80 ? 'green' : e.completionRate >= 50 ? 'indigo' : 'amber'} />
                                  <p className="text-xs text-gray-400">{e.tasksDone}/{e.tasksTotal}</p>
                                </div>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="py-2.5 text-center">
                            {e.tasksOverdue > 0
                              ? <span className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">{e.tasksOverdue}</span>
                              : <span className="text-xs text-gray-300">0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
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
