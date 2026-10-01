revoke all on function private.current_profile_id() from public, anon;
revoke all on function private.current_app_role() from public, anon;

grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
