import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Globe,
  Timer,
  AlertTriangle,
  DollarSign,
  Download,
  Filter,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Fleet Analytics — DevEngine" },
      { name: "description", content: "Platform-wide aggregated telemetry and infrastructure cost allocations." },
    ],
  }),
  component: AnalyticsDashboardPage,
});

// Telemetry mock data for Traffic Volume Area Chart
const trafficData = [
  { name: "Mon", requests: 80 },
  { name: "Tue", requests: 120 },
  { name: "Wed", requests: 95 },
  { name: "Thu", requests: 160 },
  { name: "Fri", requests: 140 },
  { name: "Sat", requests: 190 },
  { name: "Sun", requests: 220 },
];

// Telemetry mock data for Spend Allocation Donut Chart
const spendData = [
  { name: "Compute", value: 65, color: "#00685f" }, // primary
  { name: "Storage", value: 25, color: "#b05e3d" }, // tertiary
  { name: "Network", value: 10, color: "#bcc9c6" }, // outline
];

// Project Breakdown entries
const BREAKDOWN_PROJECTS = [
  {
    name: "project-alpha-core",
    status: "Healthy",
    statusColor: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
    statusDot: "bg-emerald-500",
    reqs: "4,205",
    errorRate: "0.02%",
    sparklinePoints: "0,15 20,10 40,12 60,5 80,8 100,2",
    sparkColor: "stroke-primary",
  },
  {
    name: "auth-service-v2",
    status: "Healthy",
    statusColor: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
    statusDot: "bg-emerald-500",
    reqs: "1,890",
    errorRate: "0.05%",
    sparklinePoints: "0,10 20,12 40,8 60,10 80,5 100,8",
    sparkColor: "stroke-primary",
  },
  {
    name: "legacy-payment-gw",
    status: "Degraded",
    statusColor: "bg-red-50 text-red-600 border-red-200/50",
    statusDot: "bg-red-500 animate-pulse",
    reqs: "850",
    errorRate: "2.45%",
    sparklinePoints: "0,18 20,15 40,18 60,10 80,15 100,5",
    sparkColor: "stroke-destructive",
    errorHighlight: true,
  },
  {
    name: "data-ingestion-pipe",
    status: "Healthy",
    statusColor: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
    statusDot: "bg-emerald-500",
    reqs: "12,400",
    errorRate: "0.01%",
    sparklinePoints: "0,5 20,4 40,6 60,3 80,5 100,2",
    sparkColor: "stroke-primary",
  },
];

function AnalyticsDashboardPage() {
  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-8 animate-fade-in">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">Fleet Analytics</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Aggregated telemetry across 15 active microservices.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select className="bg-card border border-border/80 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-primary/10">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Quarter</option>
            </select>
            <Button variant="outline" size="sm" className="gap-2 h-9 border-border bg-card">
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </div>
        </header>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Requests */}
          <div className="relative glass border border-border/40 rounded-xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-4 right-4 text-primary opacity-10 group-hover:opacity-30 transition-opacity">
              <Globe className="h-10 w-10" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Requests</p>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">1.24B</h3>
            <div className="flex items-center gap-1 mt-4 text-primary text-xs font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+12.4% vs last period</span>
            </div>
          </div>

          {/* Card 2: Avg Global Latency */}
          <div className="relative glass border border-border/40 rounded-xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-4 right-4 text-primary opacity-10 group-hover:opacity-30 transition-opacity">
              <Timer className="h-10 w-10" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Global Latency</p>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">42<span className="text-lg text-muted-foreground font-normal ml-0.5">ms</span></h3>
            <div className="flex items-center gap-1 mt-4 text-primary text-xs font-semibold">
              <TrendingDown className="h-3.5 w-3.5" />
              <span>-3.1ms improvement</span>
            </div>
          </div>

          {/* Card 3: Fleet Error Rate */}
          <div className="relative glass border border-border/40 rounded-xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-4 right-4 text-destructive opacity-10 group-hover:opacity-30 transition-opacity">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fleet Error Rate</p>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">0.08<span className="text-lg text-muted-foreground font-normal ml-0.5">%</span></h3>
            <div className="flex items-center gap-1 mt-4 text-destructive text-xs font-semibold">
              <TrendingUp className="h-3.5 w-3.5 animate-pulse" />
              <span>+0.02% variance alert</span>
            </div>
          </div>

          {/* Card 4: Est. Spend */}
          <div className="relative glass border border-border/40 rounded-xl p-6 shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-4 right-4 text-primary opacity-10 group-hover:opacity-30 transition-opacity">
              <DollarSign className="h-10 w-10" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Infra Spend</p>
            <h3 className="text-3xl font-extrabold text-foreground mt-2">$14.2<span className="text-lg text-muted-foreground font-normal ml-0.5">k</span></h3>
            <div className="flex items-center gap-1 mt-4 text-muted-foreground text-xs font-semibold">
              <Activity className="h-3.5 w-3.5" />
              <span>On budget</span>
            </div>
          </div>
        </div>

        {/* Bento Grid: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Traffic Volume Chart */}
          <div className="lg:col-span-2 border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur shadow-[0_4px_12px_rgba(0,0,0,0.01)] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-lg text-foreground tracking-tight">Total Traffic Volume</h4>
              <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded font-bold uppercase">telemetry stream</span>
            </div>
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00685f" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00685f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(188, 201, 198, 0.15)" />
                  <XAxis dataKey="name" stroke="rgba(61, 73, 71, 0.5)" fontSize={11} tickLine={false} />
                  <YAxis stroke="rgba(61, 73, 71, 0.5)" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #bcc9c6", borderRadius: "8px", fontFamily: "Inter" }} />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stroke="#00685f"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#trafficGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Spend Allocation Donut */}
          <div className="border border-border/40 rounded-xl p-6 bg-card/60 backdrop-blur shadow-[0_4px_12px_rgba(0,0,0,0.01)] flex flex-col justify-between">
            <h4 className="font-bold text-lg text-foreground tracking-tight mb-4">Spend Allocation</h4>
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[180px]">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={spendData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {spendData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Central counter */}
              <div className="absolute top-[37%] text-center">
                <span className="block text-2xl font-black text-foreground">15</span>
                <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Services</span>
              </div>
            </div>

            {/* Spend labels */}
            <div className="space-y-2 mt-4">
              {spendData.map((item) => (
                <div key={item.name} className="flex justify-between items-center font-mono text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-bold text-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="border border-border/40 rounded-xl overflow-hidden bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)]">
          <div className="p-6 border-b border-border/40 flex justify-between items-center bg-card/50">
            <h4 className="font-bold text-lg text-foreground tracking-tight">Project Breakdown</h4>
            <Button variant="outline" size="sm" className="h-8 border-border gap-2 bg-card">
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40 font-mono text-xs text-muted-foreground uppercase">
                  <th className="py-4 px-6 font-bold">Project Name</th>
                  <th className="py-4 px-6 font-bold">Status</th>
                  <th className="py-4 px-6 font-bold text-right">Req / Sec</th>
                  <th className="py-4 px-6 font-bold text-right">Error Rate</th>
                  <th className="py-4 px-6 font-bold w-36">7D Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 text-sm">
                {BREAKDOWN_PROJECTS.map((project) => (
                  <tr key={project.name} className="hover:bg-accent/40 transition-colors group cursor-pointer">
                    <td className="py-4 px-6 font-mono font-bold text-primary flex items-center gap-1">
                      {project.name}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${project.statusColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${project.statusDot}`} />
                        {project.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-muted-foreground">{project.reqs}</td>
                    <td className={`py-4 px-6 text-right font-mono font-bold ${project.errorHighlight ? "text-destructive" : "text-muted-foreground"}`}>
                      {project.errorRate}
                    </td>
                    <td className="py-4 px-6">
                      <svg className="w-24 h-6 overflow-visible" viewBox="0 0 100 20">
                        <polyline
                          fill="none"
                          points={project.sparklinePoints}
                          className={`${project.sparkColor} stroke-2`}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-muted/20 flex justify-center border-t border-border/30">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-xs font-bold gap-1">
              View All 15 Projects
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
