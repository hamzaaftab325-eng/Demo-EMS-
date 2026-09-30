grant execute on function private.effective_presence_status(
  public.workday_status,timestamptz,timestamptz,timestamptz,integer,integer,integer
) to authenticated;

grant execute on function private.recalculate_workday(uuid,timestamptz)
to authenticated;
