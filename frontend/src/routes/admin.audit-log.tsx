import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Filter,
  Download,
  ChevronRight,
  Shield,
  Settings,
  Info,
  ChevronLeft,
  Calendar,
} from "lucide-react";

import { useState } from "react";

// Telemetry mock audit entries
const INITIAL_EVENTS = [
  {
    id: "evt-1",
    authorInitials: "SJ",
    authorName: "Sarah Jenkins",
    action: "triggered production deploy",
    status: "Success",
    statusColor: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
    time: "10:42 AM",
    description: "Deployment #4092 completed successfully in 4m 12s.",
    details: 'Commit: a8f92bd - "Update payment gateway API version"\nTarget: production-cluster-01\nDuration: 252000ms',
    type: "Deployments",
  },
  {
    id: "evt-2",
    authorInitials: "SA",
    authorName: "System Admin",
    action: "modified environment variables",
    status: "Warning",
    statusColor: "bg-amber-50 text-amber-600 border-amber-200/50",
    time: "09:15 AM",
    description: "Modified sensitive secrets in staging environment.",
    details: "User: sysadmin@devorchestrate.com\nAction: UPDATE_SECRET\nKeys modified: DB_PASSWORD, API_KEY_V2",
    type: "Configuration",
  },
  {
    id: "evt-3",
    authorInitials: "MR",
    authorName: "Marcus Reed",
    action: "joined Project Alpha",
    status: "Info",
    statusColor: "bg-blue-50 text-blue-600 border-blue-200/50",
    time: "Yesterday, 14:30",
    description: "User was granted 'Developer' role access by Team Lead.",
    details: "Role: Developer\nGranted By: Sarah Jenkins\nScopes: read, write, deploy",
    type: "User Access",
  },
];

function ActivityAuditLogPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [dateRange, setDateRange] = useState("Last 24 Hours");

  const [filterTypes, setFilterTypes] = useState({
    Deployments: true,
    Configuration: true,
    "User Access": true,
    "System Events": false,
  });

  const handleCheckboxChange = (type: string) => {
    setFilterTypes((prev: any) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const filteredEvents = INITIAL_EVENTS.filter((evt) => {
    // Search query filter
    const matchesSearch =
      evt.authorName.toLowerCase().includes(search.toLowerCase()) ||
      evt.action.toLowerCase().includes(search.toLowerCase()) ||
      evt.description.toLowerCase().includes(search.toLowerCase());

    // Type checkbox filter
    const matchesType = (filterTypes as any)[evt.type];

    return matchesSearch && matchesType;
  });

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-8 animate-fade-in">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Activity Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Platform-wide timeline of system events, configurations, and user actions.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 h-9 border-border bg-card">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Sidebar & Timeline Bento Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Left Column: Sidebar Filters Panel */}
          <aside className="lg:col-span-3">
            <div className="bg-card border border-border/60 rounded-xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-6 sticky top-20">
              <h3 className="font-bold text-base text-foreground border-b border-border/40 pb-3 flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" /> Filters
              </h3>

              <div className="space-y-5">
                {/* Search query */}
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Search Logs</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/75" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search events..."
                      className="pl-9 h-9 border-border bg-background"
                    />
                  </div>
                </div>

                {/* Project Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Project</label>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg h-9 text-xs px-3 focus:ring-2 focus:ring-primary/10"
                  >
                    <option>All Projects</option>
                    <option>Project Alpha</option>
                    <option>Project Beta</option>
                  </select>
                </div>

                {/* Event Type Checkbox group */}
                <div className="space-y-2.5">
                  <label className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Event Type</label>
                  <div className="space-y-2">
                    {Object.keys(filterTypes).map((type) => (
                      <label key={type} className="flex items-center gap-2.5 cursor-pointer text-xs text-foreground group select-none">
                        <Checkbox
                          checked={(filterTypes as any)[type]}
                          onCheckedChange={() => handleCheckboxChange(type)}
                          className="h-4 w-4 text-primary"
                        />
                        <span className="group-hover:text-primary transition-colors font-medium">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Date Range</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/75" />
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg h-9 text-xs pl-9 pr-3 focus:ring-2 focus:ring-primary/10"
                    >
                      <option>Last 24 Hours</option>
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                      <option>Custom Range...</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-border/40 flex gap-2">
                <Button
                  onClick={() => {
                    setSearch("");
                    setProjectFilter("All Projects");
                    setFilterTypes({
                      Deployments: true,
                      Configuration: true,
                      "User Access": true,
                      "System Events": false,
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 border-border bg-background"
                >
                  Reset
                </Button>
                <Button size="sm" className="flex-1 h-8 bg-primary text-primary-foreground">
                  Apply
                </Button>
              </div>
            </div>
          </aside>

          {/* Right Column: Timeline Log Canvas */}
          <div className="lg:col-span-9 border border-border/40 rounded-xl bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border/40 bg-muted/20">
              <h2 className="text-sm font-bold text-foreground">Latest Events</h2>
              <span className="text-xs text-muted-foreground">{filteredEvents.length} results</span>
            </div>

            {/* List entries */}
            <div className="divide-y divide-border/30">
              {filteredEvents.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">No events match your active filters.</div>
              ) : (
                filteredEvents.map((evt) => (
                  <div key={evt.id} className="p-5 hover:bg-accent/20 transition-colors group">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {evt.authorInitials}
                      </div>

                      {/* Content panel */}
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-1.5">
                          <p className="text-sm text-foreground font-semibold">
                            {evt.authorName} <span className="text-muted-foreground font-normal">{evt.action}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${evt.statusColor}`}>
                              {evt.status}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">{evt.time}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{evt.description}</p>

                        {/* Interactive Accordion Spec expander */}
                        <details className="group/details pt-1">
                          <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-xs font-bold text-primary hover:opacity-80 select-none">
                            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/details:rotate-90" />
                            View Details
                          </summary>
                          <div className="mt-3 p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-emerald-400 font-mono text-[11px] whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                            {evt.details}
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination footer */}
            <div className="p-4 flex items-center justify-between border-t border-border/40 bg-muted/20">
              <span className="text-xs text-muted-foreground font-medium">Page 1 of 5</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 px-3 border-border bg-card gap-1 text-muted-foreground" disabled>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-3 border-border bg-card gap-1">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default ActivityAuditLogPage;
