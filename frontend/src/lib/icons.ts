import {
  Bot, Smartphone, Music, Link as LinkIcon, Calendar, MessageSquare,
  Users, Briefcase, CalendarClock, Landmark, Wallet, Coffee, Box, Cpu,
  Kanban, Activity, QrCode, ShoppingCart, Share2, CheckSquare, Train,
  Upload, Video, Youtube, Folder, Globe, Database, Code2, Layers,
  Gamepad2, Shield, Zap, Cloud, FileText, Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Bot, Smartphone, Music, Link: LinkIcon, Calendar, MessageSquare,
  Users, Briefcase, CalendarClock, Landmark, Wallet, Coffee, Box, Cpu,
  Kanban, Activity, QrCode, ShoppingCart, Share2, CheckSquare, Train,
  Upload, Video, Youtube, Folder, Globe, Database, Code2, Layers,
  Gamepad2, Shield, Zap, Cloud, FileText, Image: ImageIcon,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Folder;
  return ICON_MAP[name] ?? Folder;
}
