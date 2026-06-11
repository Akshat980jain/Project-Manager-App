import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  UserPlus,
  Shield,
  Briefcase,
  Trash2,
  CheckCircle2,
  Mail,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team Collaboration — DevEngine" },
      { name: "description", content: "Manage member authorizations, active sprint tasks, and access credentials." },
    ],
  }),
  component: TeamCollaborationPage,
});

function TeamCollaborationPage() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Developer");
  const [members, setMembers] = useState([
    {
      id: "mem-1",
      name: "Sarah Jenkins",
      email: "sjenkins@devorchestrate.com",
      role: "Team Lead",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCJ5qAlpvGDLvytv4q2c2uvvWQNOCNAFBOzKztRwpMcFbL5miJi5lBambbJTXhAMxydQxCxYMvVN5UB9-vvEzA1b89F7dO6fziiqBYSJaaZ17C4iHG6QfVgwiLuyqjq_vPq3QAAtqQ-mFNI5EbNNG9RhMuRzXByWwupbRL543pgWC8l0ZGa_qEt4Vr2_8DetI04tJvcpw9pFpWrAj5zVKfMWllqud0amxc1Fs5pao_SMX81rntFTXkSDm00iRP0PwOlMPbDVbsotIU",
      status: "Online",
      task: "ShopSpace #4092",
      read: true,
      write: true,
      deploy: true,
    },
    {
      id: "mem-2",
      name: "Marcus Reed",
      email: "mreed@devorchestrate.com",
      role: "Developer",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDt45cJ_iAsD4V5q0te2rj515ppy9-vBafsyiQD9g-5ZZpnKvwphdJ9wvElCFYtchI-AbeZqTPkhUaCm-R6ulCzijCL-B4ntUMM83TlPmEwe79uFcVZvCVLqwAY_N_aSJQ4w6uZVAA7XavajgSL_xC3NgDGuL0-VoxgiV2j3i4pHsYbJWFhTQA4HkUZlUQhNff-FWBHz4Rd9aeM0LSrvIfOBijn65Z2oSDEOh4YaGvTZ_8aAgYSVd6rQJUBT0EgtTe5coafDneMogQ",
      status: "Online",
      task: "Loop Chat #8492",
      read: true,
      write: true,
      deploy: false,
    },
    {
      id: "mem-3",
      name: "Arthur Connor",
      email: "aconnor@devorchestrate.com",
      role: "Developer",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBV8W-s04widVSyoXifreEg1oJY9NoDFI-4x7oHdlNZ-X--Fk_Edz3tgyYDNpxO0QqOYTa9b99msxwYarSFSkAAprO4VOfDzYmim_1khzKuBAmjGyTLFJ-Naq1DK2EN8bdk3rFvEGqCBLP-j10ItXUEq9OXsPISacA50VCevJEDOXi42hzQGTqtvHdhwe64THRZmL_6yj5F_Nkju97zaNITMZ4_ryt3Igix0Td-kC8C9sOVnv_D1-i2-6LvtqpHWhXpndn85tKMGrg",
      status: "Offline",
      task: "Vercel Docs #1024",
      read: true,
      write: false,
      deploy: false,
    },
  ]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    const initials = inviteEmail.substring(0, 2).toUpperCase();
    const name = inviteEmail.split("@")[0].replace(".", " ");
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    setMembers((prev) => [
      ...prev,
      {
        id: `mem-${Date.now()}`,
        name: formattedName,
        email: inviteEmail,
        role: inviteRole,
        avatar: "",
        status: "Offline",
        task: "Idle",
        read: true,
        write: inviteRole !== "Guest",
        deploy: inviteRole === "Team Lead",
      },
    ]);
    
    setInviteEmail("");
    toast.success(`Invite sent successfully to ${inviteEmail}!`);
  };

  const handlePermissionToggle = (id: string, field: "read" | "write" | "deploy") => {
    setMembers((prev) =>
      prev.map((mem) => {
        if (mem.id === id) {
          return {
            ...mem,
            [field]: !mem[field],
          };
        }
        return mem;
      })
    );
    toast.success("Member authorization scope updated.");
  };

  const handleDelete = (id: string, name: string) => {
    setMembers((prev) => prev.filter((mem) => mem.id !== id));
    toast.success(`${name} removed from the fleet console.`);
  };

  return (
    <AppShell>
      <div className="px-6 md:px-12 py-10 max-w-7xl 3xl:max-w-[1700px] 4xl:max-w-[2100px] 5xl:max-w-[2500px] 6xl:max-w-[3100px] 4k:max-w-[3600px] w-full mx-auto space-y-8 animate-fade-in">
        
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Team Collaboration Hub</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Coordinate microservice scopes, active sprint tasks, and member access permissions.
            </p>
          </div>
        </header>

        {/* Layout Row (Members Access & Invite Form) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Member Permissions Matrix */}
          <div className="lg:col-span-9 border border-border/40 rounded-xl bg-card shadow-[0_4px_12px_rgba(0,0,0,0.01)] overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-border/40 bg-muted/20">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Core Fleet Members
              </h3>
              <span className="text-xs text-muted-foreground font-mono font-semibold">{members.length} members authorized</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30 font-mono text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="py-4 px-6 font-bold">Member</th>
                    <th className="py-4 px-6 font-bold">Role</th>
                    <th className="py-4 px-6 font-bold">Active Sprint Task</th>
                    <th className="py-4 px-6 font-bold">Status</th>
                    <th className="py-4 px-6 font-bold text-center w-40">Scopes (R / W / D)</th>
                    <th className="py-4 px-6 font-bold w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-sm">
                  {members.map((mem) => (
                    <tr key={mem.id} className="hover:bg-accent/20 transition-colors group">
                      {/* Name & Avatar */}
                      <td className="py-4 px-6 flex items-center gap-3">
                        {mem.avatar ? (
                          <img src={mem.avatar} alt={mem.name} className="w-8 h-8 rounded-full border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {mem.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground truncate">{mem.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{mem.email}</span>
                        </div>
                      </td>

                      {/* Custom Role Badge */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          mem.role === "Team Lead" 
                            ? "bg-violet-50 text-violet-600 border-violet-200/50" 
                            : "bg-blue-50 text-blue-600 border-blue-200/50"
                        }`}>
                          <Shield className="h-3 w-3" />
                          {mem.role}
                        </span>
                      </td>

                      {/* Active Task */}
                      <td className="py-4 px-6 font-medium text-foreground">
                        <span className="flex items-center gap-1.5 text-xs font-mono">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          {mem.task}
                        </span>
                      </td>

                      {/* Pulsating status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${
                          mem.status === "Online"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200/50"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200/50"
                        }`}>
                          {mem.status === "Online" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />}
                          {mem.status}
                        </span>
                      </td>

                      {/* Scope checklists */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-4">
                          <Checkbox
                            checked={mem.read}
                            onCheckedChange={() => handlePermissionToggle(mem.id, "read")}
                            className="h-4 w-4 text-primary"
                          />
                          <Checkbox
                            checked={mem.write}
                            onCheckedChange={() => handlePermissionToggle(mem.id, "write")}
                            className="h-4 w-4 text-primary"
                          />
                          <Checkbox
                            checked={mem.deploy}
                            onCheckedChange={() => handlePermissionToggle(mem.id, "deploy")}
                            className="h-4 w-4 text-primary"
                          />
                        </div>
                      </td>

                      {/* Delete member */}
                      <td className="py-4 px-6">
                        <Button
                          onClick={() => handleDelete(mem.id, mem.name)}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Invite New Members */}
          <aside className="lg:col-span-3">
            <div className="bg-card border border-border/60 rounded-xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-5">
              <h3 className="font-bold text-base text-foreground border-b border-border/40 pb-3 flex items-center gap-2">
                <UserPlus className="h-4.5 w-4.5 text-primary" /> Invite Developer
              </h3>

              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/75" />
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="dev@devorchestrate.com"
                      className="pl-9 h-9 border-border bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">System Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg h-9 text-xs px-3 focus:ring-2 focus:ring-primary/10"
                  >
                    <option>Developer</option>
                    <option>Team Lead</option>
                    <option>Guest</option>
                  </select>
                </div>

                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/95 h-9 text-xs gap-1.5 font-bold shadow-[0_4px_12px_rgba(0,104,95,0.2)]">
                  <UserPlus className="h-3.5 w-3.5" /> Send Invitation
                </Button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
