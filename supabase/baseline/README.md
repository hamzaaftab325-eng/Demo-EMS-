# Supabase baseline

This directory closes the Phase 1 database-version-control gap.

`20261001_phase1_schema_snapshot.sql` is a reference snapshot of the canonical
live EMS schema after the initial backend foundation was established. The live
Supabase project existed before migration tracking was introduced, so this file
must **not** be applied back onto the existing project.

Use it for:

- reviewing the canonical 29-table structure in Git;
- disaster-recovery/schema comparison;
- bootstrapping a fresh environment before reconciling later migrations;
- confirming enum, constraint, index and RLS ownership.

The chronological database changes that were actually applied to the live
project remain under `supabase/migrations/`.

Secrets, service-role keys and database passwords must never be stored here.
