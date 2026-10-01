-- Phase 5 least-privilege cleanup.
-- The correction RPC no longer calls this helper directly; only trusted
-- private SECURITY DEFINER helpers use it internally.
revoke execute on function private.same_profile_environment(uuid)
from authenticated;
