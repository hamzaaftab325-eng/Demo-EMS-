do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scrum_entry_items'
  ) then
    alter publication supabase_realtime add table public.scrum_entry_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scrum_item_progress'
  ) then
    alter publication supabase_realtime add table public.scrum_item_progress;
  end if;
end
$$;
