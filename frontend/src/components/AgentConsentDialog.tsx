import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Terminal, Wifi } from "lucide-react";

const CONSENT_KEY = "devpilot_agent_consent_v1";

export function hasAgentConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

function recordConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch {}
}

interface AgentConsentDialogProps {
  open: boolean;
  onConsent: () => void;
  onCancel: () => void;
}

/**
 * One-time consent dialog shown before any local agent connection attempt.
 * Once the user accepts, the decision is persisted to localStorage and
 * this dialog is never shown again.
 */
export function AgentConsentDialog({ open, onConsent, onCancel }: AgentConsentDialogProps) {
  const handleAccept = () => {
    recordConsent();
    onConsent();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base">Connect Local Shell Agent</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You are about to connect DevPilot to a{" "}
                <strong className="text-foreground">local shell agent</strong> running on your
                machine. Please read carefully before proceeding.
              </p>

              <div className="rounded-lg border border-warning/40 bg-warning/8 p-3 space-y-2">
                <div className="flex gap-2">
                  <Terminal className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">Full shell access:</strong> While the agent
                    is running, DevPilot can execute any command on your machine with your user's
                    permissions.
                  </span>
                </div>
                <div className="flex gap-2">
                  <Wifi className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">Local only:</strong> The agent binds
                    exclusively to 127.0.0.1 and is never reachable from the internet.
                  </span>
                </div>
                <div className="flex gap-2">
                  <ShieldAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">Token-gated:</strong> A fresh random token
                    is printed in the agent's console on each startup. You must paste it here to
                    connect.
                  </span>
                </div>
              </div>

              <p>
                You can disconnect the agent at any time from the terminal panel. Closing the agent
                process on your machine immediately revokes all access.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            I understand — Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
