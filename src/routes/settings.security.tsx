import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Key,
  Globe,
  Settings,
  Github,
  Cloud,
  MessageSquare,
  AlertOctagon,
  Copy,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/security")({
  head: () => ({
    meta: [
      { title: "Integrations & Security — DevEngine" },
      { name: "description", content: "Manage webhooks, rotate API credentials, and connect third-party integrations." },
    ],
  }),
  component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
  const [apiKey, setApiKey] = useState("de_live_9a8b7c6d5e4f3g2h1i0j_prod");
  const [showKey, setShowKey] = useState(false);
  const [webhooks, setWebhooks] = useState([
    {
      id: "wh-1",
      url: "https://api.devorchestrate.com/webhooks/prod",
      events: "Push, Deployment",
      status: "Active",
    },
    {
      id: "wh-2",
      url: "https://hooks.slack.com/services/T00/B00/X00",
      events: "Failure Alerts",
      status: "Active",
    },
  ]);

  const handleRotateKey = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    setApiKey(`de_live_${randomHex}_prod`);
    toast.success("API Credentials rotated successfully!");
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API Key copied to clipboard!");
  };

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-5xl mx-auto space-y-8 animate-fade-in">
        
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Integrations & Security</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Configure third-party service connections, webhook endpoints, and rotate API keys.
            </p>
          </div>
        </header>

        {/* Bento Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Integrations Grid Cards */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Service connections */}
            <div className="border border-border/40 rounded-xl p-6 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Third-Party Integrations
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* GitHub */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0">
                      <Github className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">GitHub Integration</h4>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Connected (v1.2)</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-8 hover:bg-accent/40">Manage</Button>
                </div>

                {/* AWS */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">AWS Deployer</h4>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Connected (us-east-1)</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-8 hover:bg-accent/40">Manage</Button>
                </div>

                {/* Slack */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Slack Alerts</h4>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Connected (#alerts)</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-8 hover:bg-accent/40">Manage</Button>
                </div>

                {/* Sentry */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all opacity-85">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <AlertOctagon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Sentry Debug</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Not Connected</p>
                    </div>
                  </div>
                  <Button size="sm" className="text-xs bg-primary text-primary-foreground h-8 px-3">Connect</Button>
                </div>
              </div>
            </div>

            {/* Webhooks Panel */}
            <div className="border border-border/40 rounded-xl p-6 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> Active Webhook Relays
                </h3>
                <Button size="sm" className="gap-1 bg-primary text-primary-foreground h-8">
                  <Plus className="h-4 w-4" /> Add Webhook
                </Button>
              </div>

              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden bg-background">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-foreground">{wh.url}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-wider">
                        Events: {wh.events} · <span className="text-emerald-600 font-bold">{wh.status}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setWebhooks((prev) => prev.filter((item) => item.id !== wh.id));
                        toast.success("Webhook endpoint deleted successfully.");
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Credentials & Rotation */}
          <div className="space-y-6">
            
            {/* Credentials Card */}
            <div className="border border-border/40 rounded-xl p-6 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> API Key Credentials
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Live Token</span>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      readOnly
                      className="pr-20 h-9 font-mono text-xs border-border bg-background focus:ring-0"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-12 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:opacity-85"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={handleCopyKey}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 border-t border-border/20 pt-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Token Scope Permissions</span>
                  <div className="space-y-1 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> read_telemetry
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> write_deployments
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> admin_audit_log
                    </label>
                  </div>
                </div>

                <Button
                  onClick={handleRotateKey}
                  className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/95 h-9 text-xs"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Rotate API Keys
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
