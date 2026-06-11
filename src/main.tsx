import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

// Import layouts/pages
import IndexPage from "./routes/index";
import LoginPage from "./routes/login";
import FavPage from "./routes/favorites";
import AnalyticsPage from "./routes/analytics";
import TeamPage from "./routes/team";
import SettingsSecurityPage from "./routes/settings.security";
import CategoriesPage from "./routes/categories";
import CategorySlugPage from "./routes/categories.$slug";

import AdminLayout from "./routes/admin";
import AdminHome from "./routes/admin.index";
import NewProjectPage from "./routes/admin.projects.new";
import EditProjectPage from "./routes/admin.projects.$slug";
import AuditLogPage from "./routes/admin.audit-log";

import ProjectsPage from "./routes/projects.index";
import ProjectDetailIndex from "./routes/projects.$slug.index";
import ProjectPipeline from "./routes/projects.$slug.pipeline";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={150}>
      <BrowserRouter>
        <Routes>
          {/* Main App Routes */}
          <Route path="/" element={<IndexPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/favorites" element={<FavPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings/security" element={<SettingsSecurityPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:slug" element={<CategorySlugPage />} />
          
          {/* Projects Routes */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailIndex />} />
          <Route path="/projects/:slug/pipeline" element={<ProjectPipeline />} />

          {/* Admin Layout & Nested Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="projects/new" element={<NewProjectPage />} />
            <Route path="projects/:slug" element={<EditProjectPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  </React.StrictMode>
);
