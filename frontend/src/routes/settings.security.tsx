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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function SecuritySettingsPage() {
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem("fleet_api_key") || "de_live_9a8b7c6d5e4f3g2h1i0j_prod";
  });
  const [showKey, setShowKey] = useState(false);
  const [webhooks, setWebhooks] = useState(() => {
    const saved = localStorage.getItem("fleet_webhooks");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
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
    ];
  });

  const [integrations, setIntegrations] = useState(() => {
    const saved = localStorage.getItem("fleet_integrations");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      github: { connected: true, detail: "Connected (v1.2)" },
      aws: { connected: true, detail: "Connected (us-east-1)" },
      slack: { connected: true, detail: "Connected (#alerts)" },
      sentry: { connected: false, detail: "Not Connected" }
    };
  });

  // Custom Dialog States
  const [isGithubOpen, setIsGithubOpen] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookEventsInput, setWebhookEventsInput] = useState("Push, Deployment");

  const handleRotateKey = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const newKey = `de_live_${randomHex}_prod`;
    setApiKey(newKey);
    localStorage.setItem("fleet_api_key", newKey);
    toast.success("API Credentials rotated successfully!");
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API Key copied to clipboard!");
  };

  const connectGithub = async () => {
    if (!githubTokenInput.trim()) {
      toast.error("Please enter your Personal Access Token.");
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `token ${githubTokenInput}`
        }
      });

      if (!res.ok) {
        throw new Error("Invalid token or connection error.");
      }

      const userData = await res.json();
      const updated = {
        ...integrations,
        github: {
          connected: true,
          detail: `Connected (@${userData.login})`
        }
      };
      setIntegrations(updated);
      localStorage.setItem("fleet_integrations", JSON.stringify(updated));
      localStorage.setItem("fleet_github_token", githubTokenInput);
      localStorage.setItem("fleet_github_user", JSON.stringify({
        login: userData.login,
        avatar_url: userData.avatar_url
      }));
      toast.success(`Connected to GitHub as @${userData.login}!`);
      setIsGithubOpen(false);
      setGithubTokenInput("");
    } catch (err: any) {
      toast.error(`GitHub connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectGithub = () => {
    const updated = {
      ...integrations,
      github: {
        connected: false,
        detail: "Not Connected"
      }
    };
    setIntegrations(updated);
    localStorage.setItem("fleet_integrations", JSON.stringify(updated));
    localStorage.removeItem("fleet_github_token");
    localStorage.removeItem("fleet_github_user");
    toast.success("Disconnected from GitHub.");
  };

  const toggleIntegration = (key: string, name: string, activeDetail: string) => {
    if (key === "github") {
      if (integrations.github.connected) {
        disconnectGithub();
      } else {
        setIsGithubOpen(true);
      }
      return;
    }
    const current = (integrations as any)[key];
    const updated = {
      ...integrations,
      [key]: {
        connected: !current.connected,
        detail: !current.connected ? activeDetail : "Not Connected"
      }
    };
    setIntegrations(updated);
    localStorage.setItem("fleet_integrations", JSON.stringify(updated));
    toast.success(`${name} integration ${!current.connected ? "connected" : "disconnected"} successfully.`);
  };

  const handleAddWebhook = () => {
    setIsWebhookOpen(true);
  };

  const handleAddWebhookSubmit = () => {
    if (!webhookUrlInput.trim()) {
      toast.error("Please enter a webhook target URL.");
      return;
    }
    if (!webhookUrlInput.startsWith("http://") && !webhookUrlInput.startsWith("https://")) {
      toast.error("Invalid URL. Must start with http:// or https://");
      return;
    }

    const newWh = {
      id: `wh_${Date.now()}`,
      url: webhookUrlInput,
      events: webhookEventsInput || "Push, Deployment",
      status: "Active"
    };
    const updated = [...webhooks, newWh];
    setWebhooks(updated);
    localStorage.setItem("fleet_webhooks", JSON.stringify(updated));
    toast.success("Webhook endpoint registered successfully.");
    setIsWebhookOpen(false);
    setWebhookUrlInput("");
    setWebhookEventsInput("Push, Deployment");
  };

  const handleDeleteWebhook = (id: string) => {
    const updated = webhooks.filter((item) => item.id !== id);
    setWebhooks(updated);
    localStorage.setItem("fleet_webhooks", JSON.stringify(updated));
    toast.success("Webhook endpoint deleted successfully.");
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
                      <p className={`text-[10px] font-semibold mt-0.5 ${integrations.github.connected ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {integrations.github.detail}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => toggleIntegration("github", "GitHub", "Connected (v1.2)")}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-8 hover:bg-accent/40 cursor-pointer"
                  >
                    {integrations.github.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>

                {/* AWS */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">AWS Deployer</h4>
                      <p className={`text-[10px] font-semibold mt-0.5 ${integrations.aws.connected ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {integrations.aws.detail}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => toggleIntegration("aws", "AWS Deployer", "Connected (us-east-1)")}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-8 hover:bg-accent/40 cursor-pointer"
                  >
                    {integrations.aws.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>

                {/* Slack */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Slack Alerts</h4>
                      <p className={`text-[10px] font-semibold mt-0.5 ${integrations.slack.connected ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {integrations.slack.detail}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => toggleIntegration("slack", "Slack Alerts", "Connected (#alerts)")}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-8 hover:bg-accent/40 cursor-pointer"
                  >
                    {integrations.slack.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>

                {/* Sentry */}
                <div className="border border-border/60 rounded-xl p-4 flex items-center justify-between bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <AlertOctagon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Sentry Debug</h4>
                      <p className={`text-[10px] font-semibold mt-0.5 ${integrations.sentry.connected ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {integrations.sentry.detail}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => toggleIntegration("sentry", "Sentry Debug", "Connected (production)")}
                    variant={integrations.sentry.connected ? "ghost" : "default"}
                    size="sm"
                    className="text-xs h-8 px-3 cursor-pointer"
                  >
                    {integrations.sentry.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Webhooks Panel */}
            <div className="border border-border/40 rounded-xl p-6 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> Active Webhook Relays
                </h3>
                <Button
                  onClick={handleAddWebhook}
                  size="sm"
                  className="gap-1 bg-primary text-primary-foreground h-8 cursor-pointer"
                >
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
                      onClick={() => handleDeleteWebhook(wh.id)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {webhooks.length === 0 && (
                  <div className="text-xs text-muted-foreground italic p-6 text-center">
                    No active webhooks configured. Click "Add Webhook" to register an endpoint.
                  </div>
                )}
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

      {/* Custom dialog for GitHub Connection */}
      <Dialog open={isGithubOpen} onOpenChange={setIsGithubOpen}>
        <DialogContent className="sm:max-w-[425px] border-border bg-card/95 backdrop-blur shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-xl">
              <Github className="h-5 w-5 text-primary" /> Connect GitHub Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Supply a GitHub Personal Access Token (PAT) to authorize remote commit logging, project README syncs, and rate-limit free code fetching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pat" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Personal Access Token (PAT)
              </Label>
              <Input
                id="pat"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={githubTokenInput}
                onChange={(e) => setGithubTokenInput(e.target.value)}
                className="font-mono text-xs border-border bg-background focus:ring-1 focus:ring-primary h-10"
              />
            </div>
            
            <div className="p-3 bg-primary-container/10 border border-primary/20 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">Recommended Permissions:</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                We only need <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground font-bold">repo</code> (Full control of private repositories) or <code className="font-mono bg-muted/60 px-1 py-0.5 rounded text-foreground font-bold">public_repo</code> read scopes to display commits and file trees.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsGithubOpen(false);
                setGithubTokenInput("");
              }}
              className="border-border hover:bg-muted/40 cursor-pointer h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={connectGithub}
              disabled={isConnecting}
              className="bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer h-9 text-xs font-bold"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Connect Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom dialog for Adding Webhooks */}
      <Dialog open={isWebhookOpen} onOpenChange={setIsWebhookOpen}>
        <DialogContent className="sm:max-w-[425px] border-border bg-card/95 backdrop-blur shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-xl">
              <Globe className="h-5 w-5 text-primary" /> Register Webhook Relay
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Specify your target server relay URL and listening events to dispatch repository notifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Target Payload URL
              </Label>
              <Input
                id="webhookUrl"
                type="text"
                placeholder="https://api.yourdomain.com/webhooks"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                className="text-xs border-border bg-background focus:ring-1 focus:ring-primary h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="events" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Trigger Events (Comma separated)
              </Label>
              <Input
                id="events"
                type="text"
                placeholder="Push, Deployment, Release"
                value={webhookEventsInput}
                onChange={(e) => setWebhookEventsInput(e.target.value)}
                className="text-xs border-border bg-background focus:ring-1 focus:ring-primary h-10"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsWebhookOpen(false);
                setWebhookUrlInput("");
                setWebhookEventsInput("Push, Deployment");
              }}
              className="border-border hover:bg-muted/40 cursor-pointer h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddWebhookSubmit}
              className="bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer h-9 text-xs font-bold"
            >
              Register Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export default SecuritySettingsPage;
