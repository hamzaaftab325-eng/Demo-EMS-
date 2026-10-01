drop trigger if exists profiles_cleanup_deleted_demo_auth
on public.profiles;

drop function if exists private.cleanup_deleted_demo_auth_user();
