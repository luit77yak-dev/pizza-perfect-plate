-- Neroxa Master commercial foundation

create type public.neroxa_proposal_status as enum ('DRAFT','SENT','NEGOTIATION','ACCEPTED','REJECTED','EXPIRED','CANCELLED');
create type public.neroxa_proposal_item_type as enum ('ONE_TIME','RECURRING');
create type public.neroxa_contract_status as enum ('DRAFT','ACTIVE','SUSPENDED','TERMINATED','EXPIRED');

create table if not exists public.neroxa_proposals (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.neroxa_clients(id) on delete restrict,
 status public.neroxa_proposal_status not null default 'DRAFT',
 title text not null,
 notes text,
 valid_until date,
 sent_at timestamptz,
 accepted_at timestamptz,
 rejected_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists neroxa_proposals_client_id_idx on public.neroxa_proposals(client_id);
create index if not exists neroxa_proposals_status_idx on public.neroxa_proposals(status);
create index if not exists neroxa_proposals_updated_at_idx on public.neroxa_proposals(updated_at desc);

create table if not exists public.neroxa_proposal_items (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null references public.neroxa_proposals(id) on delete cascade,
 item_type public.neroxa_proposal_item_type not null,
 name text not null,
 description text,
 quantity numeric(12,2) not null default 1 check (quantity > 0),
 unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
 sort_order integer not null default 0,
 created_at timestamptz not null default now()
);
create index if not exists neroxa_proposal_items_proposal_idx on public.neroxa_proposal_items(proposal_id,sort_order,created_at);

create table if not exists public.neroxa_contracts (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.neroxa_clients(id) on delete restrict,
 proposal_id uuid references public.neroxa_proposals(id) on delete restrict,
 status public.neroxa_contract_status not null default 'DRAFT',
 contract_number text unique,
 title text not null,
 started_at date,
 ended_at date,
 signed_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists neroxa_contracts_client_id_idx on public.neroxa_contracts(client_id);
create index if not exists neroxa_contracts_status_idx on public.neroxa_contracts(status);
create index if not exists neroxa_contracts_updated_at_idx on public.neroxa_contracts(updated_at desc);

create table if not exists public.neroxa_contract_versions (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.neroxa_contracts(id) on delete cascade,
 version_number integer not null check (version_number > 0),
 summary text,
 terms jsonb not null default '{}'::jsonb,
 recurring_value numeric(12,2) not null default 0 check (recurring_value >= 0),
 setup_value numeric(12,2) not null default 0 check (setup_value >= 0),
 valid_from date,
 valid_until date,
 signed_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(contract_id,version_number)
);
create index if not exists neroxa_contract_versions_contract_idx on public.neroxa_contract_versions(contract_id,version_number desc);

create trigger neroxa_proposals_set_updated_at before update on public.neroxa_proposals for each row execute function public.set_updated_at();
create trigger neroxa_contracts_set_updated_at before update on public.neroxa_contracts for each row execute function public.set_updated_at();

alter table public.neroxa_proposals enable row level security;
alter table public.neroxa_proposal_items enable row level security;
alter table public.neroxa_contracts enable row level security;
alter table public.neroxa_contract_versions enable row level security;

revoke all on table public.neroxa_proposals,public.neroxa_proposal_items,public.neroxa_contracts,public.neroxa_contract_versions from anon,authenticated;
grant select on table public.neroxa_proposals,public.neroxa_proposal_items,public.neroxa_contracts,public.neroxa_contract_versions to authenticated;

insert into public.neroxa_permissions(key,name,description) values
 ('commercial.read','Visualizar comercial','Consultar leads, propostas e contratos.'),
 ('commercial.write','Gerenciar comercial','Criar e atualizar propostas e contratos.')
on conflict(key) do nothing;

insert into public.neroxa_role_permissions(role_id,permission_id)
select r.id,p.id from public.neroxa_roles r join public.neroxa_permissions p on p.key in ('commercial.read','commercial.write')
where r.key='super_admin' on conflict do nothing;
insert into public.neroxa_role_permissions(role_id,permission_id)
select r.id,p.id from public.neroxa_roles r join public.neroxa_permissions p on p.key='commercial.read'
where r.key in ('admin','finance') on conflict do nothing;

create policy neroxa_proposals_staff_read on public.neroxa_proposals for select to authenticated using(public.has_neroxa_permission('commercial.read'));
create policy neroxa_proposal_items_staff_read on public.neroxa_proposal_items for select to authenticated using(public.has_neroxa_permission('commercial.read'));
create policy neroxa_contracts_staff_read on public.neroxa_contracts for select to authenticated using(public.has_neroxa_permission('commercial.read'));
create policy neroxa_contract_versions_staff_read on public.neroxa_contract_versions for select to authenticated using(public.has_neroxa_permission('commercial.read'));

create or replace function public.create_neroxa_proposal(p_client_id uuid,p_title text,p_notes text default null,p_valid_until date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_title text:=nullif(trim(coalesce(p_title,'')),'');
begin
 if not public.has_neroxa_permission('commercial.write') then raise exception 'not authorized'; end if;
 if v_title is null then raise exception 'proposal title is required'; end if;
 if not exists(select 1 from public.neroxa_clients c where c.id=p_client_id and c.status<>'CANCELLED') then raise exception 'active client record not found'; end if;
 insert into public.neroxa_proposals(client_id,title,notes,valid_until,created_by) values(p_client_id,v_title,nullif(trim(coalesce(p_notes,'')),''),p_valid_until,auth.uid()) returning id into v_id;
 perform public.record_neroxa_audit('PROPOSAL_CREATED','neroxa_proposal',v_id,null,null,jsonb_build_object('client_id',p_client_id,'title',v_title,'status','DRAFT'),null);
 return v_id;
end $$;

create or replace function public.add_neroxa_proposal_item(p_proposal_id uuid,p_item_type public.neroxa_proposal_item_type,p_name text,p_description text default null,p_quantity numeric default 1,p_unit_price numeric default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_name text:=nullif(trim(coalesce(p_name,'')),'');
begin
 if not public.has_neroxa_permission('commercial.write') then raise exception 'not authorized'; end if;
 if v_name is null then raise exception 'proposal item name is required'; end if;
 if p_quantity<=0 or p_unit_price<0 then raise exception 'invalid proposal item values'; end if;
 if not exists(select 1 from public.neroxa_proposals p where p.id=p_proposal_id and p.status in ('DRAFT','SENT','NEGOTIATION')) then raise exception 'proposal not found or not editable'; end if;
 insert into public.neroxa_proposal_items(proposal_id,item_type,name,description,quantity,unit_price,sort_order)
 select p_proposal_id,p_item_type,v_name,nullif(trim(coalesce(p_description,'')),''),p_quantity,p_unit_price,coalesce(max(i.sort_order),-1)+1 from public.neroxa_proposal_items i where i.proposal_id=p_proposal_id returning id into v_id;
 perform public.record_neroxa_audit('PROPOSAL_ITEM_ADDED','neroxa_proposal_item',v_id,null,null,jsonb_build_object('proposal_id',p_proposal_id,'name',v_name,'item_type',p_item_type,'quantity',p_quantity,'unit_price',p_unit_price),null);
 return v_id;
end $$;

create or replace function public.transition_neroxa_proposal_status(p_proposal_id uuid,p_new_status public.neroxa_proposal_status)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_current public.neroxa_proposal_status; v_before jsonb; v_after jsonb; v_client uuid; ok boolean:=false;
begin
 if not public.has_neroxa_permission('commercial.write') then raise exception 'not authorized'; end if;
 select p.status,p.client_id,to_jsonb(p) into v_current,v_client,v_before from public.neroxa_proposals p where p.id=p_proposal_id;
 if v_before is null then raise exception 'proposal not found'; end if;
 if v_current=p_new_status then return true; end if;
 ok:=(v_current='DRAFT' and p_new_status in ('SENT','CANCELLED'))
  or (v_current='SENT' and p_new_status in ('NEGOTIATION','ACCEPTED','REJECTED','EXPIRED','CANCELLED'))
  or (v_current='NEGOTIATION' and p_new_status in ('SENT','ACCEPTED','REJECTED','EXPIRED','CANCELLED'));
 if not ok then raise exception 'invalid proposal status transition from % to %',v_current,p_new_status; end if;
 update public.neroxa_proposals set status=p_new_status,sent_at=case when p_new_status='SENT' and sent_at is null then now() else sent_at end,accepted_at=case when p_new_status='ACCEPTED' then now() else accepted_at end,rejected_at=case when p_new_status='REJECTED' then now() else rejected_at end where id=p_proposal_id;
 select to_jsonb(p) into v_after from public.neroxa_proposals p where p.id=p_proposal_id;
 perform public.record_neroxa_audit('PROPOSAL_STATUS_CHANGED','neroxa_proposal',p_proposal_id,null,v_before,v_after,jsonb_build_object('client_id',v_client,'from_status',v_current,'to_status',p_new_status));
 return true;
end $$;

create or replace function public.create_neroxa_contract(p_client_id uuid,p_title text,p_proposal_id uuid default null,p_contract_number text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_title text:=nullif(trim(coalesce(p_title,'')),'');
begin
 if not public.has_neroxa_permission('commercial.write') then raise exception 'not authorized'; end if;
 if v_title is null then raise exception 'contract title is required'; end if;
 if not exists(select 1 from public.neroxa_clients c where c.id=p_client_id and c.status<>'CANCELLED') then raise exception 'active client record not found'; end if;
 if p_proposal_id is not null and not exists(select 1 from public.neroxa_proposals p where p.id=p_proposal_id and p.client_id=p_client_id and p.status='ACCEPTED') then raise exception 'contract proposal must be accepted and belong to client'; end if;
 insert into public.neroxa_contracts(client_id,proposal_id,contract_number,title,created_by) values(p_client_id,p_proposal_id,nullif(trim(coalesce(p_contract_number,'')),''),v_title,auth.uid()) returning id into v_id;
 perform public.record_neroxa_audit('CONTRACT_CREATED','neroxa_contract',v_id,null,null,jsonb_build_object('client_id',p_client_id,'proposal_id',p_proposal_id,'status','DRAFT'),null);
 return v_id;
end $$;

create or replace function public.create_neroxa_contract_version(p_contract_id uuid,p_summary text default null,p_terms jsonb default '{}'::jsonb,p_recurring_value numeric default 0,p_setup_value numeric default 0,p_valid_from date default null,p_valid_until date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_next integer; v_client uuid;
begin
 if not public.has_neroxa_permission('commercial.write') then raise exception 'not authorized'; end if;
 if p_recurring_value<0 or p_setup_value<0 then raise exception 'contract values cannot be negative'; end if;
 select c.client_id into v_client from public.neroxa_contracts c where c.id=p_contract_id and c.status<>'TERMINATED';
 if not found then raise exception 'contract not found or terminated'; end if;
 select coalesce(max(version_number),0)+1 into v_next from public.neroxa_contract_versions where contract_id=p_contract_id;
 insert into public.neroxa_contract_versions(contract_id,version_number,summary,terms,recurring_value,setup_value,valid_from,valid_until,created_by)
 values(p_contract_id,v_next,nullif(trim(coalesce(p_summary,'')),''),coalesce(p_terms,'{}'::jsonb),p_recurring_value,p_setup_value,p_valid_from,p_valid_until,auth.uid()) returning id into v_id;
 perform public.record_neroxa_audit('CONTRACT_VERSION_CREATED','neroxa_contract_version',v_id,null,null,jsonb_build_object('contract_id',p_contract_id,'client_id',v_client,'version_number',v_next,'recurring_value',p_recurring_value,'setup_value',p_setup_value),null);
 return v_id;
end $$;

create or replace function public.transition_neroxa_contract_status(p_contract_id uuid,p_new_status public.neroxa_contract_status)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_current public.neroxa_contract_status; v_before jsonb; v_after jsonb; v_client uuid; ok boolean:=false;
begin
 if not public.has_neroxa_permission('commercial.write') then raise exception 'not authorized'; end if;
 select c.status,c.client_id,to_jsonb(c) into v_current,v_client,v_before from public.neroxa_contracts c where c.id=p_contract_id;
 if v_before is null then raise exception 'contract not found'; end if;
 if v_current=p_new_status then return true; end if;
 ok:=(v_current='DRAFT' and p_new_status in ('ACTIVE','EXPIRED','TERMINATED'))
  or (v_current='ACTIVE' and p_new_status in ('SUSPENDED','TERMINATED','EXPIRED'))
  or (v_current='SUSPENDED' and p_new_status in ('ACTIVE','TERMINATED','EXPIRED'));
 if not ok then raise exception 'invalid contract status transition from % to %',v_current,p_new_status; end if;
 update public.neroxa_contracts set status=p_new_status,signed_at=case when p_new_status='ACTIVE' and signed_at is null then now() else signed_at end,started_at=case when p_new_status='ACTIVE' and started_at is null then current_date else started_at end where id=p_contract_id;
 select to_jsonb(c) into v_after from public.neroxa_contracts c where c.id=p_contract_id;
 perform public.record_neroxa_audit('CONTRACT_STATUS_CHANGED','neroxa_contract',p_contract_id,null,v_before,v_after,jsonb_build_object('client_id',v_client,'from_status',v_current,'to_status',p_new_status));
 return true;
end $$;

revoke all on function public.create_neroxa_proposal(uuid,text,text,date) from public,anon;
grant execute on function public.create_neroxa_proposal(uuid,text,text,date) to authenticated;
revoke all on function public.add_neroxa_proposal_item(uuid,public.neroxa_proposal_item_type,text,text,numeric,numeric) from public,anon;
grant execute on function public.add_neroxa_proposal_item(uuid,public.neroxa_proposal_item_type,text,text,numeric,numeric) to authenticated;
revoke all on function public.transition_neroxa_proposal_status(uuid,public.neroxa_proposal_status) from public,anon;
grant execute on function public.transition_neroxa_proposal_status(uuid,public.neroxa_proposal_status) to authenticated;
revoke all on function public.create_neroxa_contract(uuid,text,uuid,text) from public,anon;
grant execute on function public.create_neroxa_contract(uuid,text,uuid,text) to authenticated;
revoke all on function public.create_neroxa_contract_version(uuid,text,jsonb,numeric,numeric,date,date) from public,anon;
grant execute on function public.create_neroxa_contract_version(uuid,text,jsonb,numeric,numeric,date,date) to authenticated;
revoke all on function public.transition_neroxa_contract_status(uuid,public.neroxa_contract_status) from public,anon;
grant execute on function public.transition_neroxa_contract_status(uuid,public.neroxa_contract_status) to authenticated;
