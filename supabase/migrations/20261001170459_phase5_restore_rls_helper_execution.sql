
grant usage on schema private to authenticated;
grant execute on function private.same_profile_environment(uuid) to authenticated;
notify pgrst, 'reload schema';
