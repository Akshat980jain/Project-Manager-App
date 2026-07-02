
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- timestamp helper
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile + auto-admin first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#58a6ff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROJECTS ============
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'in_development', 'archived');

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  icon TEXT NOT NULL DEFAULT 'Box',
  color TEXT NOT NULL DEFAULT '#58a6ff',
  status project_status NOT NULL DEFAULT 'in_development',
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  github_url TEXT,
  live_url TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects public read" ON public.projects FOR SELECT USING (true);
CREATE POLICY "admins manage projects" ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SCREENSHOTS ============
CREATE TABLE public.project_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_screenshots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_screenshots TO authenticated;
GRANT ALL ON public.project_screenshots TO service_role;
ALTER TABLE public.project_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots public read" ON public.project_screenshots FOR SELECT USING (true);
CREATE POLICY "admins manage screenshots" ON public.project_screenshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ FILES ============
CREATE TABLE public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_files TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files public read" ON public.project_files FOR SELECT USING (true);
CREATE POLICY "admins manage files" ON public.project_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ APKS ============
CREATE TABLE public.project_apks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  version TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_apks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_apks TO authenticated;
GRANT ALL ON public.project_apks TO service_role;
ALTER TABLE public.project_apks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apks public read" ON public.project_apks FOR SELECT USING (true);
CREATE POLICY "admins manage apks" ON public.project_apks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ DOCS ============
CREATE TABLE public.project_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  research TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  documentation TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_docs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_docs TO authenticated;
GRANT ALL ON public.project_docs TO service_role;
ALTER TABLE public.project_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs public read" ON public.project_docs FOR SELECT USING (true);
CREATE POLICY "admins manage docs" ON public.project_docs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.project_docs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TASKS ============
CREATE TABLE public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_tasks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks public read" ON public.project_tasks FOR SELECT USING (true);
CREATE POLICY "admins manage tasks" ON public.project_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ FAVORITES ============
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own favorites" ON public.favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ RECENT VIEWS ============
CREATE TABLE public.recent_views (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recent_views TO authenticated;
GRANT ALL ON public.recent_views TO service_role;
ALTER TABLE public.recent_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own recents" ON public.recent_views FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ACTIVITY EVENTS ============
CREATE TABLE public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_events TO anon, authenticated;
GRANT INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity public read" ON public.activity_events FOR SELECT USING (true);
CREATE POLICY "admins insert activity" ON public.activity_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('screenshots', 'screenshots', true),
  ('project-files', 'project-files', true),
  ('apks', 'apks', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'screenshots');
CREATE POLICY "admin write screenshots" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'screenshots' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update screenshots" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'screenshots' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete screenshots" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'screenshots' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read project-files" ON storage.objects FOR SELECT USING (bucket_id = 'project-files');
CREATE POLICY "admin write project-files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update project-files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete project-files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read apks" ON storage.objects FOR SELECT USING (bucket_id = 'apks');
CREATE POLICY "admin write apks" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update apks" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete apks" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "users write own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ SEED DATA ============
INSERT INTO public.categories (name, slug, color) VALUES
  ('AI Projects', 'ai', '#a78bfa'),
  ('Android Apps', 'android', '#3fb950'),
  ('MERN Projects', 'mern', '#58a6ff'),
  ('Blockchain Projects', 'blockchain', '#f59e0b'),
  ('Java Projects', 'java', '#ef4444'),
  ('Kotlin Projects', 'kotlin', '#8b5cf6'),
  ('Networking Projects', 'networking', '#06b6d4'),
  ('Web Applications', 'web', '#22d3ee'),
  ('Utility Apps', 'utility', '#94a3b8'),
  ('Games', 'games', '#ec4899');

INSERT INTO public.projects (name, slug, description, icon, color, status, tech_stack, tags, category_id) VALUES
  ('AI Document Vault', 'ai-document-vault', 'Secure AI-powered document storage with semantic search.', 'Bot', '#a78bfa', 'active', ARRAY['React','OpenAI','Supabase'], ARRAY['ai','documents'], (SELECT id FROM public.categories WHERE slug='ai')),
  ('EduConnect', 'android-erp', 'Enterprise resource planning app for Android.', 'Smartphone', '#3fb950', 'active', ARRAY['Android','Kotlin','MERN'], ARRAY['erp','mobile'], (SELECT id FROM public.categories WHERE slug='android')),
  ('Audio App', 'audio-app', 'Music streaming and audio playback application.', 'Music', '#ec4899', 'in_development', ARRAY['React Native','Node.js'], ARRAY['audio'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('Blockchain Voting System', 'blockchain-voting', 'Decentralized voting platform on Ethereum.', 'Link', '#f59e0b', 'completed', ARRAY['Solidity','Web3','React'], ARRAY['blockchain','voting'], (SELECT id FROM public.categories WHERE slug='blockchain')),
  ('Booking Management App', 'booking-management', 'Full booking workflow with calendar and payments.', 'Calendar', '#58a6ff', 'active', ARRAY['MERN','Stripe'], ARRAY['booking'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('Chat App', 'chat-app', 'Real-time chat with rooms and presence.', 'MessageSquare', '#22d3ee', 'completed', ARRAY['React','Socket.io','Node'], ARRAY['chat','realtime'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('EMS', 'ems', 'Employee management system.', 'Users', '#3fb950', 'active', ARRAY['MERN'], ARRAY['ems'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('ERP App', 'erp-app', 'Modular ERP suite for small businesses.', 'Briefcase', '#58a6ff', 'in_development', ARRAY['MERN','Postgres'], ARRAY['erp'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('Event Scheduler', 'event-scheduler', 'Personal event scheduling with reminders.', 'CalendarClock', '#a78bfa', 'completed', ARRAY['React','Node'], ARRAY['events'], (SELECT id FROM public.categories WHERE slug='web')),
  ('Banking App', 'banking-app', 'Modern mobile banking experience.', 'Landmark', '#3fb950', 'in_development', ARRAY['Android','Kotlin'], ARRAY['fintech'], (SELECT id FROM public.categories WHERE slug='android')),
  ('Java Expense App', 'java-expense-app', 'Personal expense tracker built in Java.', 'Wallet', '#ef4444', 'completed', ARRAY['Java','SQLite'], ARRAY['expense'], (SELECT id FROM public.categories WHERE slug='java')),
  ('Kotlin Projects', 'kotlin-projects', 'Collection of Kotlin learning projects.', 'Coffee', '#8b5cf6', 'active', ARRAY['Kotlin'], ARRAY['learning'], (SELECT id FROM public.categories WHERE slug='kotlin')),
  ('Minecraft Projects', 'minecraft-projects', 'Mods and plugins for Minecraft.', 'Box', '#3fb950', 'completed', ARRAY['Java','Minecraft API'], ARRAY['games'], (SELECT id FROM public.categories WHERE slug='games')),
  ('Operating System Projects', 'os-projects', 'Custom kernel modules and OS experiments.', 'Cpu', '#94a3b8', 'in_development', ARRAY['C','Assembly'], ARRAY['os','systems'], (SELECT id FROM public.categories WHERE slug='networking')),
  ('Project Management App', 'project-management-app', 'Lightweight project tracker.', 'Kanban', '#58a6ff', 'active', ARRAY['MERN'], ARRAY['productivity'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('Pulse App', 'pulse-app', 'Health and activity tracking dashboard.', 'Activity', '#ec4899', 'in_development', ARRAY['React','Charts'], ARRAY['health'], (SELECT id FROM public.categories WHERE slug='web')),
  ('QR Scanner', 'qr-scanner', 'Fast QR/barcode scanner utility.', 'QrCode', '#94a3b8', 'completed', ARRAY['Android','Kotlin'], ARRAY['utility'], (SELECT id FROM public.categories WHERE slug='utility')),
  ('QuickKart', 'quickkart', 'E-commerce storefront with cart and checkout.', 'ShoppingCart', '#58a6ff', 'active', ARRAY['MERN','Stripe'], ARRAY['ecommerce'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('Social Media App', 'social-media-app', 'Posts, follows, and a real-time feed.', 'Share2', '#ec4899', 'in_development', ARRAY['MERN','Socket.io'], ARRAY['social'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('Task App', 'task-app', 'Minimal task and to-do manager.', 'CheckSquare', '#3fb950', 'completed', ARRAY['React','Node'], ARRAY['tasks'], (SELECT id FROM public.categories WHERE slug='web')),
  ('Train Tracker App', 'train-tracker', 'Real-time train tracking with live updates.', 'Train', '#06b6d4', 'active', ARRAY['React','Maps API'], ARRAY['travel'], (SELECT id FROM public.categories WHERE slug='web')),
  ('Upload App', 'upload-app', 'Drag-and-drop file upload service.', 'Upload', '#94a3b8', 'completed', ARRAY['Node','S3'], ARRAY['utility'], (SELECT id FROM public.categories WHERE slug='utility')),
  ('Video Calling App', 'video-calling-app', 'WebRTC video calling with rooms.', 'Video', '#a78bfa', 'in_development', ARRAY['WebRTC','React'], ARRAY['video'], (SELECT id FROM public.categories WHERE slug='mern')),
  ('YouTube Blog', 'youtube-blog', 'Blog platform for YouTube creators.', 'Youtube', '#ef4444', 'active', ARRAY['Next.js','MDX'], ARRAY['blog'], (SELECT id FROM public.categories WHERE slug='web'));
