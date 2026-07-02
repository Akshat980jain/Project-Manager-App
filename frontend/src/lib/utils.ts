import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getProjectDisplayName(slug: string, rawName: string): string {
  const cleanSlug = (slug || "").toLowerCase().trim();
  if (cleanSlug === "android-erp" || cleanSlug.includes("android-erp")) {
    return "EduConnect";
  }
  if (cleanSlug === "ems" || cleanSlug === "ems-frontend" || cleanSlug.includes("ems")) {
    return "StaffSphere";
  }
  if (cleanSlug === "booking-management-app" || cleanSlug.includes("booking")) {
    return "BookEase 24x7";
  }
  if (cleanSlug === "lovable-chat-app" || cleanSlug.includes("lovable-chat")) {
    return "Loop Chat";
  }
  if (cleanSlug === "ytblog" || cleanSlug.includes("ytblog")) {
    return "Scribe";
  }
  if (cleanSlug === "qscan" || cleanSlug.includes("qscan")) {
    return "QRVault";
  }
  if (cleanSlug === "pulse-app" || cleanSlug.includes("pulse")) {
    return "Pulse";
  }
  return rawName;
}
