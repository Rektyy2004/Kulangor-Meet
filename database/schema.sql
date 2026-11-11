-- Run once in the Supabase SQL editor. This database is server-only.
-- The browser never receives a service-role key or direct table access.
create table if not exists public.meeting_sessions (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.meeting_sessions enable row level security;
revoke all on public.meeting_sessions from anon, authenticated;
grant select, insert, update, delete on public.meeting_sessions to service_role;

create or replace function public.add_meeting_participant(p_session_id text, p_participant jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_payload jsonb;
  members jsonb;
  member_count integer;
  palette text[] := array['#e87549','#6086ce','#9b79bf','#e5b74b','#47a495','#d978a1','#719952','#c48e64','#7485c3','#49a9ba','#ce6f68','#a49a50','#59857a','#ab7a9c','#87a1bc','#b67d48','#c09cba','#6298a2','#929765','#767eb1'];
begin
  select payload into current_payload from public.meeting_sessions where id = p_session_id for update;
  if current_payload is null then raise exception 'SESSION_NOT_FOUND'; end if;
  members := current_payload->'participants';
  member_count := jsonb_array_length(members);
  if member_count >= (current_payload->>'capacity')::integer then raise exception 'SESSION_FULL'; end if;
  p_participant := jsonb_set(p_participant, '{color}', to_jsonb(palette[member_count + 1]));
  current_payload := jsonb_set(current_payload, '{participants}', members || jsonb_build_array(p_participant));
  update public.meeting_sessions set payload = current_payload where id = p_session_id;
  return current_payload;
end;
$$;
revoke all on function public.add_meeting_participant(text, jsonb) from public, anon, authenticated;
grant execute on function public.add_meeting_participant(text, jsonb) to service_role;

-- Existing deployments: run this addition to enable location editing.
create or replace function public.update_meeting_participant(p_session_id text,p_participant_id text,p_name text,p_place_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_payload jsonb; member jsonb; member_index integer;
begin
  select payload into current_payload from public.meeting_sessions where id=p_session_id for update;
  if current_payload is null then raise exception 'SESSION_NOT_FOUND'; end if;
  select value,(ordinality-1)::integer into member,member_index
    from jsonb_array_elements(current_payload->'participants') with ordinality
    where value->>'id'=p_participant_id;
  if member is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  member := jsonb_set(jsonb_set(member,'{name}',to_jsonb(p_name)),'{placeId}',to_jsonb(p_place_id));
  current_payload := jsonb_set(current_payload,array['participants',member_index::text],member);
  update public.meeting_sessions set payload=current_payload where id=p_session_id;
  return jsonb_build_object('success',true);
end;
$$;
revoke all on function public.update_meeting_participant(text,text,text,text) from public,anon,authenticated;
grant execute on function public.update_meeting_participant(text,text,text,text) to service_role;
