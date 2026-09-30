create extension if not exists pg_cron;

select cron.schedule(
  'ems-phase5-presence-maintenance',
  '* * * * *',
  'select private.phase5_presence_maintenance();'
);

select cron.schedule(
  'ems-phase5-daily-attendance-maintenance',
  '15 * * * *',
  'select private.phase5_daily_attendance_maintenance();'
);
