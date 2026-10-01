-- CAPITALE TT — Schéma Supabase complet
-- Version 1 — création non destructive
-- Exécuter dans Supabase > SQL Editor
--
-- Le schéma autorise les opérations aux utilisateurs AUTHENTIFIÉS uniquement.
-- Il n'utilise pas de clé service_role dans le frontend.
-- Les tables sont nommées pour couvrir les modules de l'application.

create extension if not exists pgcrypto;

-- =========================================================
-- FONCTION TECHNIQUE updated_at
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;

-- =========================================================
-- AGENCES / PROFILS
-- =========================================================

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  phone text,
  email text,
  address text,
  postal_code text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  role text not null default 'commercial'
    check (role in ('gerant','recrutement','commercial','administratif','terrain','client','interimaire')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CLIENTS / CONTACTS / CHANTIERS
-- =========================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  type text not null default 'Prospect'
    check (type in ('Prospect','Client actif','Ancien client','Client à risque','Partenaire')),
  status text not null default 'À qualifier'
    check (status in ('À qualifier','Actif','Bloqué','À risque','Inactif')),
  company text not null,
  activity text,
  phone text,
  email text,
  address text,
  postal text,
  city text,
  department text,
  country text default 'France',
  siret text,
  naf text,
  employees text,
  jobs text,
  qualifications text,
  current_tt integer not null default 0 check (current_tt >= 0),
  potential_tt integer not null default 0 check (potential_tt >= 0),
  competitors text,
  atradius text,
  billing text,
  payment_delay text,
  payment_method text,
  holidays text,
  night_markup numeric(10,2),
  bad_weather text,
  contract_email text,
  invoice_email text,
  outstanding numeric(12,2) not null default 0,
  credit_limit numeric(12,2) not null default 0,
  risk_level text not null default 'normal'
    check (risk_level in ('normal','surveillance','bloqué')),
  account_manager_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  first_name text,
  last_name text not null,
  job_title text,
  phone text,
  email text,
  is_primary boolean not null default false,
  is_billing boolean not null default false,
  is_operational boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chantiers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  reference text unique,
  name text not null,
  address text,
  postal text,
  city text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  manager_name text,
  manager_phone text,
  manager_email text,
  start_date date,
  end_date date,
  status text not null default 'actif'
    check (status in ('prospect','actif','suspendu','termine','annule')),
  priority text not null default 'normal'
    check (priority in ('normal','urgent','tres_urgent')),
  safety_requirements text,
  working_hours text,
  documents_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- INTÉRIMAIRES / DOCUMENTS / CONFORMITÉ
-- =========================================================

create table if not exists public.interimaires (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  address text,
  postal text,
  city text,
  trades text,
  qualification text,
  mobility_km integer default 0,
  availability text not null default 'Immédiate'
    check (availability in ('Immédiate','Dans 1 semaine','Dans 2 semaines','En mission','En formation','Absent','Bloqué')),
  terrain_score numeric(3,2) default 0 check (terrain_score between 0 and 5),
  compliance_status text not null default 'Dossier incomplet'
    check (compliance_status in ('Conforme','Dossier incomplet','CACES à renouveler','Visite médicale expirée','Bloqué')),
  hourly_cost numeric(10,2),
  vehicle boolean not null default false,
  driving_license boolean not null default false,
  notes text,
  agency_id uuid references public.agencies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete cascade,
  interimaire_id uuid references public.interimaires(id) on delete cascade,
  document_type text not null,
  file_name text,
  storage_path text,
  issued_at date,
  expires_at date,
  status text not null default 'à contrôler'
    check (status in ('conforme','à contrôler','expiré','manquant')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(client_id, chantier_id, interimaire_id) >= 1)
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  interimaire_id uuid references public.interimaires(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  chantier_id uuid references public.chantiers(id) on delete set null,
  incident_type text not null,
  description text not null,
  severity text not null default 'moyenne'
    check (severity in ('faible','moyenne','grave','critique')),
  status text not null default 'ouvert'
    check (status in ('ouvert','en cours','résolu','clos')),
  occurred_at date not null default current_date,
  resolved_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- DEMANDES / MATCHING / MISSIONS
-- =========================================================

create table if not exists public.demandes (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  chantier_id uuid references public.chantiers(id) on delete set null,
  trade text not null,
  level text,
  positions integer not null default 1 check (positions > 0),
  start_date date,
  end_date date,
  working_hours text,
  search_radius_km integer default 40,
  urgency text not null default 'Normal'
    check (urgency in ('Normal','Urgent','Très urgent')),
  status text not null default 'Nouvelle'
    check (status in ('Nouvelle','Qualifiée','Recherche','Profils proposés','Validée','Pourvue','Annulée')),
  constraints text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matching_propositions (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes(id) on delete cascade,
  interimaire_id uuid not null references public.interimaires(id) on delete restrict,
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  skills_score numeric(5,2) default 0,
  availability_score numeric(5,2) default 0,
  distance_score numeric(5,2) default 0,
  compliance_score numeric(5,2) default 0,
  reliability_score numeric(5,2) default 0,
  cost_score numeric(5,2) default 0,
  pitch text,
  status text not null default 'proposé'
    check (status in ('proposé','envoyé','accepté','refusé','annulé')),
  sent_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(demande_id, interimaire_id)
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  demande_id uuid references public.demandes(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  chantier_id uuid references public.chantiers(id) on delete set null,
  interimaire_id uuid not null references public.interimaires(id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('prévue','active','terminée','annulée','bloquée')),
  sale_rate numeric(10,2),
  loaded_cost numeric(10,2),
  gross_margin numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PLANNING OPÉRATIONNEL / COMMERCIAL
-- =========================================================

create table if not exists public.planning_actions (
  id uuid primary key default gen_random_uuid(),
  action_type text not null default 'Autre'
    check (action_type in ('Mission','Appel commercial','Rendez-vous terrain','Formation','Relance','Terrain','Autre')),
  action_date date not null,
  action_time time,
  description text not null,
  resource text,
  client_id uuid references public.clients(id) on delete set null,
  chantier_id uuid references public.chantiers(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  status text not null default 'Planifié'
    check (status in ('Planifié','En cours','Terminé','Annulé')),
  planning_kind text not null default 'operationnel'
    check (planning_kind in ('operationnel','commercial')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PROSPECTION / RELANCES / COMMUNICATION
-- =========================================================

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text,
  stage text not null default 'Sourcé'
    check (stage in ('Sourcé','Premier contact','RDV conducteur','Devis','Négociation','Contrat signé','Perdu')),
  potential numeric(12,2) not null default 0,
  probability numeric(5,2) default 0 check (probability between 0 and 100),
  next_action text,
  follow_up_date date,
  client_id uuid references public.clients(id) on delete set null,
  notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.relances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  action_type text not null default 'appel'
    check (action_type in ('appel','email','sms','rendez-vous','autre')),
  subject text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text not null default 'à faire'
    check (status in ('à faire','en cours','terminée','annulée')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  interimaire_id uuid references public.interimaires(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  channel text not null default 'note'
    check (channel in ('email','appel','sms','réunion','note')),
  subject text,
  body text not null,
  urgency text not null default 'normale'
    check (urgency in ('normale','importante','urgente')),
  action_required text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- TARIFS / MARGES
-- =========================================================

create table if not exists public.baremes (
  id uuid primary key default gen_random_uuid(),
  trade text not null,
  level text not null,
  region text default 'Île-de-France',
  sale_rate numeric(10,2) not null,
  loaded_cost numeric(10,2) not null,
  margin numeric(10,2) generated always as (sale_rate - loaded_cost) stored,
  minimum_margin numeric(10,2) not null default 4.50,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.margin_validations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  demande_id uuid references public.demandes(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  sale_rate numeric(10,2) not null,
  loaded_cost numeric(10,2) not null,
  margin numeric(10,2) generated always as (sale_rate - loaded_cost) stored,
  minimum_margin numeric(10,2) not null default 4.50,
  decision text not null default 'à valider'
    check (decision in ('conforme','à valider','refusée')),
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ALERTES / EPI / INTEMPÉRIES
-- =========================================================

create table if not exists public.alertes (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  title text not null,
  description text,
  severity text not null default 'info'
    check (severity in ('info','attention','urgent','bloquant')),
  client_id uuid references public.clients(id) on delete cascade,
  interimaire_id uuid references public.interimaires(id) on delete cascade,
  demande_id uuid references public.demandes(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  due_date date,
  status text not null default 'active'
    check (status in ('active','traitée','ignorée')),
  treated_by uuid references public.profiles(id) on delete set null,
  treated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.epi_bons (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  interimaire_id uuid not null references public.interimaires(id) on delete restrict,
  chantier_id uuid references public.chantiers(id) on delete set null,
  items text not null,
  status text not null default 'à émettre'
    check (status in ('à émettre','émis','envoyé','livré','retourné')),
  issued_at date,
  delivered_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intemperies (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid references public.chantiers(id) on delete set null,
  event_date date not null,
  hours numeric(8,2) not null default 0,
  reason text not null,
  status text not null default 'à transmettre'
    check (status in ('à saisir','à valider','à transmettre','transmis')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- MARCHÉS PUBLICS / INSERTION
-- =========================================================

create table if not exists public.marches_publics (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  title text not null,
  source text,
  contracting_authority text,
  holder text,
  city text,
  estimated_amount numeric(14,2),
  insertion_hours numeric(10,2) default 0,
  start_date date,
  deadline date,
  status text not null default 'à qualifier'
    check (status in ('détecté','à qualifier','à contacter','suivi','gagné','perdu')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insertion_suivi (
  id uuid primary key default gen_random_uuid(),
  marche_id uuid not null references public.marches_publics(id) on delete cascade,
  target_hours numeric(10,2) not null default 0,
  completed_hours numeric(10,2) not null default 0,
  justification text,
  document_id uuid references public.documents(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- =========================================================
-- INDEX
-- =========================================================

create index if not exists idx_clients_company on public.clients(company);
create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_clients_type on public.clients(type);
create index if not exists idx_contacts_client on public.contacts(client_id);
create index if not exists idx_chantiers_client on public.chantiers(client_id);
create index if not exists idx_interimaires_availability on public.interimaires(availability);
create index if not exists idx_demandes_status on public.demandes(status);
create index if not exists idx_demandes_client on public.demandes(client_id);
create index if not exists idx_missions_status on public.missions(status);
create index if not exists idx_planning_date on public.planning_actions(action_date);
create index if not exists idx_prospects_stage on public.prospects(stage);
create index if not exists idx_alertes_status on public.alertes(status);
create index if not exists idx_documents_expiration on public.documents(expires_at);

-- =========================================================
-- TRIGGERS updated_at
-- =========================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'agencies','profiles','clients','contacts','chantiers',
    'interimaires','documents','incidents','demandes',
    'matching_propositions','missions','planning_actions',
    'prospects','relances','communications','baremes',
    'alertes','epi_bons','intemperies','marches_publics',
    'insertion_suivi'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'trg_' || t || '_updated_at', t
    );
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.set_updated_at()',
      'trg_' || t || '_updated_at', t
    );
  end loop;
end $$;

-- =========================================================
-- VUES DASHBOARD
-- =========================================================

create or replace view public.dashboard_kpis as
select
  (select count(*) from public.missions where status in ('prévue','active')) as missions_actives,
  (select count(*) from public.interimaires where availability in ('Immédiate','Dans 1 semaine')) as interimaires_disponibles,
  (select count(*) from public.demandes where status not in ('Pourvue','Annulée')) as demandes_a_traiter,
  (select count(*) from public.alertes where status = 'active') as alertes_actives,
  (select coalesce(avg(margin),0) from public.baremes where active = true) as marge_moyenne;

-- =========================================================
-- RLS
-- =========================================================

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.chantiers enable row level security;
alter table public.interimaires enable row level security;
alter table public.documents enable row level security;
alter table public.incidents enable row level security;
alter table public.demandes enable row level security;
alter table public.matching_propositions enable row level security;
alter table public.missions enable row level security;
alter table public.planning_actions enable row level security;
alter table public.prospects enable row level security;
alter table public.relances enable row level security;
alter table public.communications enable row level security;
alter table public.baremes enable row level security;
alter table public.margin_validations enable row level security;
alter table public.alertes enable row level security;
alter table public.epi_bons enable row level security;
alter table public.intemperies enable row level security;
alter table public.marches_publics enable row level security;
alter table public.insertion_suivi enable row level security;

-- Pour le démarrage : accès complet uniquement aux utilisateurs connectés.
-- Une restriction par agence/rôle pourra être ajoutée plus tard.

do $$
declare
  t text;
  table_names text[] := array[
    'agencies','profiles','clients','contacts','chantiers',
    'interimaires','documents','incidents','demandes',
    'matching_propositions','missions','planning_actions',
    'prospects','relances','communications','baremes',
    'margin_validations','alertes','epi_bons','intemperies',
    'marches_publics','insertion_suivi'
  ];
begin
  foreach t in array table_names
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = t || '_authenticated_all'
    ) then
      execute format(
        'create policy %I on public.%I
         for all to authenticated
         using (true)
         with check (true)',
        t || '_authenticated_all', t
      );
    end if;
  end loop;
end $$;

-- Accès SELECT à la vue dashboard pour les utilisateurs connectés.
grant select on public.dashboard_kpis to authenticated;

-- Aucun accès anonyme aux tables métier.
revoke all on all tables in schema public from anon;

-- =========================================================
-- DONNÉES DE DÉPART FACULTATIVES
-- =========================================================
-- Le script ne crée pas de faux clients automatiquement.
-- Après connexion dans l'application, vous pouvez créer vos premières fiches.
