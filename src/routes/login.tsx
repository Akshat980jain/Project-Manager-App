import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Terminal, Shield, KeyRound, Play, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — DevEngine" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) nav({ to: "/", replace: true }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) toast.error(error.message); else toast.success("Account created! Check your email to verify.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 md:p-10 relative overflow-hidden bg-zinc-950/20">
        {/* Pulsating Ambient Background Glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] bg-emerald-550/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />

        {/* Global Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {/* Main Split-Screen Container Card */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl border border-border/60 bg-card/65 backdrop-blur-xl shadow-2xl overflow-hidden relative z-10 animate-fade-in">
          
          {/* Left Panel: Hero Graphics (Visible on md+) */}
          <div className="hidden md:flex flex-col justify-between p-8 bg-zinc-900/40 relative overflow-hidden border-r border-border/40">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5 pointer-events-none" />
            
            {/* Logo and Header */}
            <div className="space-y-3 relative z-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-xl shadow-[0_4px_12px_rgba(0,104,95,0.3)]">
                ▲
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
                Developer Fleet Console <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect and manage local directories, parse gradle compile details, dynamically discover compiled APK files, and explore source code in real-time.
              </p>
            </div>

            {/* Simulated Live Environment Terminal */}
            <div className="border border-border/30 rounded-xl p-4 bg-zinc-955/70 font-mono text-[10px] space-y-1.5 shadow-inner relative my-6 leading-relaxed bg-zinc-950/70">
              <div className="flex items-center gap-1.5 border-b border-border/10 pb-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[8px] text-muted-foreground font-bold tracking-wide uppercase ml-2 flex items-center gap-1">
                  <Terminal className="h-3 w-3" /> Console Scan Stream
                </span>
              </div>
              <div className="text-zinc-400">$ node devengine.js --scan-root=E:\</div>
              <div className="text-emerald-400">✓ Discovered local repository workspace</div>
              <div className="text-zinc-500">↳ Loading Android ERP, Booking App, EMS, QScan...</div>
              <div className="text-emerald-400">✓ Scanned Kotlin build.gradle.kts (Gradle 8.7 parsed)</div>
              <div className="text-emerald-400">✓ Dynamic APK mapped: E:\Booking Management App\... (41.7 MB)</div>
              <div className="text-indigo-400">★ Ready to inspect codebase elements...</div>
              <div className="w-2 h-3 bg-zinc-400 inline-block animate-pulse ml-0.5" />
            </div>

            {/* Footer Tagline */}
            <div className="text-[10px] text-muted-foreground font-mono relative z-10 flex items-center justify-between border-t border-border/15 pt-4">
              <span>ACTIVE ENVIRONMENT NODE</span>
              <span className="text-emerald-400 font-bold">PORT 8080 // ONLINE</span>
            </div>
          </div>

          {/* Right Panel: Interactive Form */}
          <div className="p-8 md:p-12 flex flex-col justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none" />
            
            {/* Header Content */}
            <div className="mb-6 relative z-10 text-center md:text-left">
              <h1 className="text-2xl font-black tracking-tight text-foreground transition-all duration-300">
                {mode === "signin" ? "Sign In" : "Create Account"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {mode === "signin" 
                  ? "Access your Developer Console workspace dashboard." 
                  : "The first registered account is granted Full Root Admin access."}
              </p>
            </div>

            {/* Sliding Tab Selector */}
            <div className="flex rounded-lg bg-zinc-900/50 p-1 border border-border/30 mb-6 relative z-10">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all duration-200 ${
                  mode === "signin" 
                    ? "bg-card text-foreground shadow-sm scale-102" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all duration-200 ${
                  mode === "signup" 
                    ? "bg-card text-foreground shadow-sm scale-102" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="space-y-4 relative z-10">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Email Address</Label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="w-full bg-zinc-950/20 border-border/80 focus:border-primary/60 transition-colors focus:ring-1 focus:ring-primary/20 h-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Password</Label>
                  {mode === "signin" && (
                    <button type="button" className="text-[10px] text-primary hover:underline font-semibold bg-transparent border-0 p-0">
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950/20 border-border/80 focus:border-primary/60 transition-colors focus:ring-1 focus:ring-primary/20 h-10"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 h-10 text-xs font-bold rounded-lg shadow-lg active:scale-98 transition-all relative z-10 mt-2" 
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    {mode === "signin" ? (
                      <>
                        <KeyRound className="h-4 w-4 shrink-0 text-primary-foreground" /> Sign In to Console
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 shrink-0 text-primary-foreground" /> Initialize Admin Profile
                      </>
                    )}
                  </span>
                )}
              </Button>
            </form>

            {/* Toggle Helper under form */}
            <div className="mt-6 text-center relative z-10">
              <button 
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")} 
                className="text-xs text-muted-foreground hover:text-primary transition-colors bg-transparent border-0 p-0"
              >
                {mode === "signin" 
                  ? "Don't have an account? Create one now" 
                  : "Already have an account? Sign in here"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
