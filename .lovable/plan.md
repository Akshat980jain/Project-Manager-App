## Stack note

This Lovable project runs on **TanStack Start (React 19) + Supabase**, not Node/Express/MongoDB. Supabase gives you Postgres (instead of MongoDB), Auth, Storage, and Realtime — functionally equivalent to a MERN+Supabase setup. All requested features are fully supported.

## Visual direction

GitHub clean — dark canvas (`#0d1117` / `#161b22`), blue accent `#58a6ff`, green status `#3fb950`, mono+sans typography, crisp borders, subtle hover states. Sidebar nav, dashboard grid of icon cards, detail pages with tabbed sections.

---

## Phased build plan

### Phase 1 — Foundation & Dashboard
**Goal:** browse projects, view details, search/filter, theme.

- Database + RLS: `profiles`, `user_roles` (+ `has_role`), `categories`, `projects`, `project_tags`, `project_screenshots`, `project_files`, `project_apks`, `project_docs`
- Storage buckets: `screenshots`, `project-files`, `apks`, `avatars`
- Seed 10 categories + 24 example projects with matching lucide icons (Bot, Smartphone, Music, Link, Calendar, MessageSquare, Users, Briefcase, CalendarClock, Landmark, Wallet, Coffee, Box, Cpu, Kanban, Activity, QrCode, ShoppingCart, Share2, CheckSquare, Train, Upload, Video, Youtube)
- Auth (email/password), first signup auto-promoted to admin
- Sidebar shell + dark/light toggle (tokens in `src/styles.css`)
- Routes: `/`, `/projects`, `/projects/$slug`, `/categories/$slug`, `/login`
- Dashboard: 4 stat cards (Total/Active/Completed/In Development) + project grid
- Project detail tabs: Overview, Screenshots (lightbox), Docs (markdown), Files (download), APK ("Download APK" button only if APK exists), GitHub card
- Search + status/category/tech filters via URL query params

**Deliverable:** read-only, browsable ProjectHub seeded with your 24 projects.

---

### Phase 2 — Admin Panel & Content Management
**Goal:** manage everything from the UI, no code edits.

- Routes: `/admin`, `/admin/projects/new`, `/admin/projects/$slug`, `/admin/categories`
- Admin guard via `has_role(auth.uid(),'admin')` on server fns
- Add/Edit/Delete project form: name, description, category, icon picker (lucide grid), color, status, tech stack chips, GitHub/live links, start date
- Screenshot manager: upload, reorder, delete
- Project files manager: upload ZIP/PDF/DOC/PPT/Image with kind detection, label, delete
- APK manager: upload / replace / delete (one active per project)
- Docs editor: markdown editor for Notes, Research, Requirements, Documentation
- Category manager: name, slug, color
- Admin dashboard with quick stats and recent uploads

**Deliverable:** full self-service CMS for projects.

---

### Phase 3 — Engagement Layer
**Goal:** the "extras" — favorites, recents, tags, tasks, activity, notifications.

- Tables: `project_tasks`, `favorites`, `recent_views`, `activity_events`, `notifications`
- Favorites: star toggle on cards + `/favorites` page
- Recently Opened: upsert on detail view + row on dashboard
- Tags: chip input in admin form, filterable on listings
- Tasks tab: checklist with completion %, drives Project Statistics block (Total / Completed / Pending / %)
- Activity timeline: server fns log create/update/upload/status-change; rendered on detail page + global Recent Activity on dashboard
- Notifications: header bell with unread count, Supabase realtime subscription, mark-as-read
- Polish: glassmorphism on cards, framer-motion page transitions, skeleton loaders, empty states

**Deliverable:** full ProjectHub matching the original spec.

---

## Out of scope (future)

External GitHub API sync, full-text search across docs, multi-admin, comments, mobile app.

After you approve, I'll start Phase 1 with the database migration.