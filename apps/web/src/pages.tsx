import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  apiRequest,
  formatMoney,
  type Analytics,
  type Employee,
  type SalaryRevision,
} from "./api";
import { useAuth } from "./use-auth";
import type { ReactNode } from "react";

const departments = [
  "Engineering",
  "Product",
  "People",
  "Finance",
  "Sales",
  "Operations",
  "Design",
  "Legal",
];
const currencies = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "CAD",
  "AUD",
  "SGD",
  "JPY",
  "BHD",
];
const countries = [
  "United States",
  "India",
  "United Kingdom",
  "Germany",
  "Canada",
  "Australia",
  "Singapore",
  "Japan",
  "Bahrain",
];

function useAnalytics() {
  const { token } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<Analytics>("/analytics", token)
      .then(setData)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to load analytics.",
        ),
      );
  }, [token]);
  return { data, error };
}

function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function LoadingError({ error }: { error: string }) {
  return (
    <div className="state-panel" role={error ? "alert" : undefined}>
      {error || "Loading your latest data…"}
    </div>
  );
}

function MetricCard({
  label,
  value,
  footnote,
  icon,
}: {
  label: string;
  value: string;
  footnote: string;
  icon: ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{footnote}</small>
    </article>
  );
}

function countryCounts(
  rows: Analytics["byCountry"],
): Array<{ country: string; employeeCount: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.country, (counts.get(row.country) ?? 0) + row.employeeCount);
  }
  return [...counts.entries()]
    .map(([country, employeeCount]) => ({ country, employeeCount }))
    .sort((a, b) => b.employeeCount - a.employeeCount);
}

export function DashboardPage() {
  const { data, error } = useAnalytics();
  if (!data || error)
    return (
      <>
        <PageTitle
          eyebrow="PEOPLE OVERVIEW"
          title="Good morning"
          description="A snapshot of your global workforce and salary landscape."
        />
        <LoadingError error={error} />
      </>
    );
  const departmentsData = Object.values(
    data.byDepartment.reduce<
      Record<string, { department: string; employees: number }>
    >((acc, row) => {
      acc[row.department] ??= { department: row.department, employees: 0 };
      acc[row.department]!.employees += row.employeeCount;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.employees - a.employees)
    .slice(0, 7);
  const countries = countryCounts(data.byCountry);
  return (
    <>
      <PageTitle
        eyebrow="PEOPLE OVERVIEW"
        title="Good morning"
        description="A snapshot of your global workforce and salary landscape."
      >
        <Link className="button secondary" to="/analytics">
          View analytics <ArrowUpRight size={16} />
        </Link>
      </PageTitle>
      <div className="metric-grid">
        <MetricCard
          label="Total employees"
          value={data.totalEmployees.toLocaleString()}
          footnote="Across all locations"
          icon={<Users size={18} />}
        />
        <MetricCard
          label="Active employees"
          value={data.activeEmployees.toLocaleString()}
          footnote={`${data.totalEmployees ? Math.round((data.activeEmployees / data.totalEmployees) * 100) : 0}% of workforce`}
          icon={<span className="green-dot" />}
        />
        <MetricCard
          label="Countries"
          value={String(countries.length)}
          footnote="Global footprint"
          icon={<span className="metric-letter">G</span>}
        />
        <MetricCard
          label="Currencies"
          value={String(data.salarySummary.length)}
          footnote="Reported independently"
          icon={<CircleDollarSign size={18} />}
        />
      </div>
      <section className="content-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Team distribution</h2>
              <p>Employee headcount by department</p>
            </div>
            <span className="period-label">All employees</span>
          </div>
          {departmentsData.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentsData}
                  margin={{ left: -18, right: 12, top: 10 }}
                >
                  <CartesianGrid vertical={false} stroke="#edf0f3" />
                  <XAxis
                    dataKey="department"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#818a98", fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#818a98", fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="employees"
                    fill="#5c6ac4"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="empty-state">No employee records yet.</p>
          )}
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Salary overview</h2>
              <p>Statistics separated by currency</p>
            </div>
          </div>
          <div className="salary-overview">
            {data.salarySummary.slice(0, 5).map((item) => (
              <div className="salary-line" key={item.currency}>
                <span className="currency-badge">{item.currency}</span>
                <div>
                  <strong>
                    {item.average
                      ? formatMoney(item.average, item.currency)
                      : "—"}
                  </strong>
                  <small>
                    Average · {item.employeeCount.toLocaleString()} employees
                  </small>
                </div>
                <span className="salary-line-median">
                  Median
                  <br />
                  <b>
                    {item.median === null
                      ? "—"
                      : formatMoney(item.median, item.currency)}
                  </b>
                </span>
              </div>
            ))}
          </div>
          <Link className="text-link" to="/analytics">
            Explore salary metrics <ArrowUpRight size={14} />
          </Link>
        </article>
      </section>
      <section className="panel location-panel">
        <div className="panel-heading">
          <div>
            <h2>Team locations</h2>
            <p>Headcount across operating countries</p>
          </div>
          <Link to="/analytics" className="text-link">
            View all
          </Link>
        </div>
        <div className="location-list">
          {countries.slice(0, 6).map((item) => (
            <div className="location-row" key={item.country}>
              <span>{item.country}</span>
              <div className="location-track">
                <i
                  style={{
                    width: `${Math.max(2, (item.employeeCount / Math.max(...countries.map((country) => country.employeeCount))) * 100)}%`,
                  }}
                />
              </div>
              <b>{item.employeeCount.toLocaleString()}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function EmployeeForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (payload: Record<string, string>) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    );
    try {
      await onSubmit(payload);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save employee.",
      );
    }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-employee-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EMPLOYEE RECORD</p>
            <h2 id="new-employee-title">Add employee</h2>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="form-grid">
          <label>
            Employee ID
            <input
              name="employeeNumber"
              required
              minLength={2}
              maxLength={32}
            />
          </label>
          <label>
            Full name
            <input name="fullName" required minLength={2} maxLength={160} />
          </label>
          <label>
            Work email
            <input name="email" type="email" required />
          </label>
          <label>
            Department
            <input name="department" required minLength={2} maxLength={100} />
          </label>
          <label>
            Job title
            <input name="jobTitle" required />
          </label>
          <label>
            Country
            <input name="country" required minLength={2} maxLength={80} />
          </label>
          <label>
            Currency
            <select name="currency">
              {currencies.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Annual salary
            <input
              name="currentSalary"
              inputMode="decimal"
              placeholder="e.g. 75000.00"
              required
            />
          </label>
          {error && (
            <p role="alert" className="form-error form-wide">
              {error}
            </p>
          )}
          <div className="form-actions form-wide">
            <button
              className="button secondary"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Create employee"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EmployeeEditForm({
  employee,
  onSubmit,
  onCancel,
}: {
  employee: Employee;
  onSubmit: (payload: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    );
    try {
      await onSubmit(payload);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update employee.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-employee-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EMPLOYEE RECORD</p>
            <h2 id="edit-employee-title">Edit employee details</h2>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="form-grid">
          <label>
            Full name
            <input name="fullName" defaultValue={employee.fullName} required />
          </label>
          <label>
            Work email
            <input
              name="email"
              type="email"
              defaultValue={employee.email}
              required
            />
          </label>
          <label>
            Department
            <input
              name="department"
              defaultValue={employee.department}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Job title
            <input name="jobTitle" defaultValue={employee.jobTitle} required />
          </label>
          <label>
            Country
            <input
              name="country"
              defaultValue={employee.country}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={employee.status}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="form-error form-wide">
              {error}
            </p>
          )}
          <div className="form-actions form-wide">
            <button
              className="button secondary"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EmployeesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [country, setCountry] = useState("");
  const [sortBy, setSortBy] = useState("employeeNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        sortBy: "employeeNumber",
      });
      if (query) params.set("search", query);
      if (status) params.set("status", status);
      if (department) params.set("department", department);
      if (country) params.set("country", country);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      try {
        const result = await apiRequest<{
          items: Employee[];
          total: number;
          totalPages: number;
        }>(`/employees?${params}`, token);
        if (active) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(Math.max(1, result.totalPages));
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load employees.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [
    token,
    page,
    query,
    status,
    department,
    country,
    sortBy,
    sortOrder,
    refresh,
  ]);
  async function create(payload: Record<string, string>) {
    setBusy(true);
    try {
      await apiRequest("/employees", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setPage(1);
      setQuery("");
      setSearch("");
      setRefresh((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="PEOPLE"
        title="Employee directory"
        description="Search and manage employee records across your organization."
      >
        <button className="button primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add employee
        </button>
      </PageTitle>
      <section className="panel directory-panel">
        <form
          className="directory-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search by name or employee ID"
              placeholder="Search name or employee ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <input
            aria-label="Filter by department"
            placeholder="All departments"
            value={department}
            list="department-filter-options"
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          />
          <datalist id="department-filter-options">
            {departments.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </datalist>
          <input
            aria-label="Filter by country"
            placeholder="All countries"
            value={country}
            list="country-filter-options"
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
          />
          <datalist id="country-filter-options">
            {countries.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </datalist>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            aria-label="Sort employees by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="employeeNumber">Employee ID</option>
            <option value="fullName">Name</option>
            <option value="department">Department</option>
            <option value="country">Country</option>
            <option value="status">Status</option>
            <option value="updatedAt">Recently updated</option>
          </select>
          <button
            className="button secondary"
            type="button"
            aria-label="Toggle sort direction"
            onClick={() =>
              setSortOrder((value) => (value === "asc" ? "desc" : "asc"))
            }
          >
            {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>
          <button className="button secondary" type="submit">
            Search
          </button>
        </form>
        {error ? (
          <LoadingError error={error} />
        ) : loading ? (
          <LoadingError error="" />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Users size={26} />
            <strong>No employees found</strong>
            <span>Try another search or add an employee.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>DEPARTMENT</th>
                  <th>LOCATION</th>
                  <th>ANNUAL SALARY</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <Link
                        className="employee-cell"
                        to={`/employees/${employee.id}`}
                      >
                        <span className="initials">
                          {employee.fullName
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <span>
                          <strong>{employee.fullName}</strong>
                          <small>
                            {employee.employeeNumber} · {employee.jobTitle}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.country}</td>
                    <td>
                      <strong>
                        {formatMoney(employee.currentSalary, employee.currency)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${employee.status.toLowerCase()}`}
                      >
                        {employee.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="table-arrow"
                        aria-label={`View ${employee.fullName}`}
                        to={`/employees/${employee.id}`}
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            Showing {items.length ? (page - 1) * 25 + 1 : 0}–
            {Math.min(page * 25, total)} of {total.toLocaleString()} employees
          </span>
          <div className="pagination">
            <button
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      {showForm && (
        <EmployeeForm
          onSubmit={create}
          onCancel={() => setShowForm(false)}
          busy={busy}
        />
      )}
    </>
  );
}

export function EmployeeDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<SalaryRevision[]>([]);
  const [error, setError] = useState("");
  const [salary, setSalary] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{
        employee: Employee & { salaryHistory: SalaryRevision[] };
      }>(`/employees/${id}`, token);
      setEmployee(result.employee);
      setHistory(result.employee.salaryHistory);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load employee.",
      );
    }
  }, [id, token]);
  useEffect(() => {
    void load();
  }, [load]);
  async function updateSalary(event: FormEvent) {
    event.preventDefault();
    if (
      !employee ||
      !window.confirm(
        `Update ${employee.fullName}'s salary to ${formatMoney(salary, employee.currency)}?`,
      )
    )
      return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await apiRequest(`/employees/${id}/salary-revisions`, token, {
        method: "POST",
        body: JSON.stringify({
          newSalary: salary,
          currency: employee.currency,
          reason: reason || undefined,
        }),
      });
      setSalary("");
      setReason("");
      setNotice("Salary updated and revision history recorded.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update salary.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updateEmployee(payload: Record<string, string>) {
    await apiRequest(`/employees/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setEditing(false);
    await load();
  }
  if (error && !employee)
    return (
      <>
        <button className="back-link" onClick={() => navigate("/employees")}>
          ‹ Back to employees
        </button>
        <LoadingError error={error} />
      </>
    );
  if (!employee) return <LoadingError error="" />;
  return (
    <>
      <button className="back-link" onClick={() => navigate("/employees")}>
        ‹ Back to employees
      </button>
      <PageTitle
        eyebrow={`EMPLOYEE · ${employee.employeeNumber}`}
        title={employee.fullName}
        description={`${employee.jobTitle} · ${employee.department}`}
      >
        <div className="detail-actions">
          <span className={`status-pill ${employee.status.toLowerCase()}`}>
            {employee.status === "ACTIVE" ? "Active" : "Inactive"}
          </span>
          <button className="button secondary" onClick={() => setEditing(true)}>
            Edit details
          </button>
        </div>
      </PageTitle>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="inline-success">
          {notice}
        </p>
      )}
      <div className="detail-grid">
        <section className="panel employee-info">
          <div className="panel-heading">
            <div>
              <h2>Employee details</h2>
              <p>Employment and compensation profile</p>
            </div>
          </div>
          <div className="profile-salary">
            <small>Current annual salary</small>
            <strong data-testid="current-salary">
              {formatMoney(employee.currentSalary, employee.currency)}
            </strong>
            <span>{employee.currency} · per year</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Work email</dt>
              <dd>{employee.email}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{employee.country}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{employee.department}</dd>
            </div>
            <div>
              <dt>Job title</dt>
              <dd>{employee.jobTitle}</dd>
            </div>
            <div>
              <dt>Employee ID</dt>
              <dd>{employee.employeeNumber}</dd>
            </div>
          </dl>
        </section>
        <section className="panel salary-update">
          <div className="panel-heading">
            <div>
              <h2>Update salary</h2>
              <p>Changes are recorded in the salary history.</p>
            </div>
          </div>
          <form onSubmit={updateSalary} className="form-stack">
            <label>
              New annual salary ({employee.currency})
              <input
                type="text"
                inputMode="decimal"
                required
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
                placeholder="e.g. 85000.00"
              />
            </label>
            <label>
              Reason for change{" "}
              <textarea
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional context for this revision"
              />
            </label>
            <button className="button primary w-full h-[42px]" disabled={busy}>
              {busy ? "Saving…" : "Save salary change"}
            </button>
          </form>
        </section>
      </div>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Salary history</h2>
            <p>Historical revisions are retained and cannot be deleted.</p>
          </div>
          <span className="history-count">{history.length} revisions</span>
        </div>
        {history.length === 0 ? (
          <p className="empty-state">No salary history recorded.</p>
        ) : (
          <div className="history-list">
            {history.map((revision) => (
              <div className="history-row" key={revision.id}>
                <span className="history-dot" />
                <div>
                  <strong>
                    {formatMoney(revision.newSalary, revision.currency)}
                  </strong>
                  <small>
                    {revision.reason ||
                      (revision.previousSalary === null
                        ? "Initial salary record"
                        : "Salary revision")}
                  </small>
                </div>
                <span className="history-change">
                  {revision.previousSalary
                    ? `${formatMoney(revision.previousSalary, revision.currency)} → `
                    : ""}
                  {formatMoney(revision.newSalary, revision.currency)}
                </span>
                <time>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                  }).format(new Date(revision.effectiveAt))}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
      {editing && (
        <EmployeeEditForm
          employee={employee}
          onSubmit={updateEmployee}
          onCancel={() => setEditing(false)}
        />
      )}
    </>
  );
}

export function AnalyticsPage() {
  const { data, error } = useAnalytics();
  if (!data || error)
    return (
      <>
        <PageTitle
          eyebrow="REPORTING"
          title="Salary analytics"
          description="Explore workforce composition and compensation, with financial values grouped by currency."
        />
        <LoadingError error={error} />
      </>
    );
  const departmentsData = Object.values(
    data.byDepartment.reduce<
      Record<string, { department: string; employees: number }>
    >((acc, row) => {
      acc[row.department] ??= { department: row.department, employees: 0 };
      acc[row.department]!.employees += row.employeeCount;
      return acc;
    }, {}),
  ).sort((a, b) => b.employees - a.employees);
  const countriesData = countryCounts(data.byCountry);
  return (
    <>
      <PageTitle
        eyebrow="REPORTING"
        title="Salary analytics"
        description="Explore workforce composition and compensation. Financial values are grouped by currency."
      />
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Headcount by department</h2>
            <p>Current employee records, across currencies</p>
          </div>
          <span className="period-label">Live data</span>
        </div>
        <div className="chart analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={departmentsData}
              margin={{ left: -12, right: 12, top: 12 }}
            >
              <CartesianGrid vertical={false} stroke="#edf0f3" />
              <XAxis
                dataKey="department"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#818a98", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#818a98", fontSize: 11 }}
              />
              <Tooltip />
              <Bar
                dataKey="employees"
                name="Employees"
                fill="#5c6ac4"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Salary by currency</h2>
              <p>Descriptive statistics; no currency conversion</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>CURRENCY</th>
                  <th>COUNT</th>
                  <th>AVERAGE</th>
                  <th>MEDIAN</th>
                  <th>RANGE</th>
                </tr>
              </thead>
              <tbody>
                {data.salarySummary.map((row) => (
                  <tr key={row.currency}>
                    <td>
                      <span className="currency-badge">{row.currency}</span>
                    </td>
                    <td>{row.employeeCount.toLocaleString()}</td>
                    <td>
                      {row.average
                        ? formatMoney(row.average, row.currency)
                        : "—"}
                    </td>
                    <td>
                      {row.median === null
                        ? "—"
                        : formatMoney(row.median, row.currency)}
                    </td>
                    <td>
                      {row.minimum && row.maximum
                        ? `${formatMoney(row.minimum, row.currency)} – ${formatMoney(row.maximum, row.currency)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Country distribution</h2>
              <p>{countriesData.length} countries represented</p>
            </div>
          </div>
          <div className="country-list">
            {countriesData.map((row) => (
              <div className="country-row" key={row.country}>
                <span>{row.country}</span>
                <strong>{row.employeeCount.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="salary-distribution-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Salary by department</h2>
              <p>Average annual salary, grouped separately by currency</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DEPARTMENT</th>
                  <th>CURRENCY</th>
                  <th>EMPLOYEES</th>
                  <th>AVERAGE SALARY</th>
                </tr>
              </thead>
              <tbody>
                {data.byDepartment.map((row) => (
                  <tr key={`${row.department}-${row.currency}`}>
                    <td>{row.department}</td>
                    <td>
                      <span className="currency-badge">{row.currency}</span>
                    </td>
                    <td>{row.employeeCount.toLocaleString()}</td>
                    <td>
                      {row.averageSalary
                        ? formatMoney(row.averageSalary, row.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Salary by country</h2>
              <p>Average annual salary, grouped separately by currency</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>COUNTRY</th>
                  <th>CURRENCY</th>
                  <th>EMPLOYEES</th>
                  <th>AVERAGE SALARY</th>
                </tr>
              </thead>
              <tbody>
                {data.byCountry.map((row) => (
                  <tr key={`${row.country}-${row.currency}`}>
                    <td>{row.country}</td>
                    <td>
                      <span className="currency-badge">{row.currency}</span>
                    </td>
                    <td>{row.employeeCount.toLocaleString()}</td>
                    <td>
                      {row.averageSalary
                        ? formatMoney(row.averageSalary, row.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel band-panel">
        <div className="panel-heading">
          <div>
            <h2>Relative salary bands</h2>
            <p>
              Lower, middle, and upper quartiles calculated independently within
              each currency.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CURRENCY</th>
                <th>LOWER QUARTILE</th>
                <th>MIDDLE QUARTILES</th>
                <th>UPPER QUARTILE</th>
              </tr>
            </thead>
            <tbody>
              {data.salarySummary.map((row) => (
                <tr key={row.currency}>
                  <td>
                    <span className="currency-badge">{row.currency}</span>
                  </td>
                  <td>{row.salaryBands.lower}</td>
                  <td>{row.salaryBands.middle}</td>
                  <td>{row.salaryBands.upper}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
