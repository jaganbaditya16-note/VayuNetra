-- Expand VayuNetra report categories from environmental-only
-- to broader civic-development requests.
-- Existing rows are preserved.

begin;

alter table public.vayunetra_reports
  drop constraint if exists vayunetra_reports_category_check;

alter table public.vayunetra_reports
  add constraint vayunetra_reports_category_check
  check (
    category in (
      'industrial',
      'vehicular',
      'burning',
      'dust',
      'air_pollution',
      'water_pollution',
      'waste',
      'noise',
      'roads',
      'mobility',
      'public_transport',
      'water_supply',
      'drainage_flooding',
      'waste_sanitation',
      'education',
      'healthcare',
      'connectivity',
      'electricity',
      'public_spaces',
      'community_facilities',
      'other'
    )
  );

commit;