-- Run once in the production Supabase SQL Editor.
-- The first card for an instructor creates a sales workspace in a BEFORE INSERT trigger.
-- This RLS helper must see that row within the same INSERT statement.
begin;
alter function scheduler.is_sales_workspace_member(uuid) volatile;
commit;

select proname, provolatile
from pg_proc
where oid = 'scheduler.is_sales_workspace_member(uuid)'::regprocedure;
-- Expected: is_sales_workspace_member | v
