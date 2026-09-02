-- DPRO 造園・外構 / shared Supabase dedicated-schema FK indexes
-- Applied migration: 20260902053158 index_dpro_landscape_exterior_foreign_keys
set search_path = dpro_landscape_exterior, extensions, public;
create index if not exists landscape_cases_customer_fk_idx on landscape_cases(customer_id);
create index if not exists landscape_cases_site_fk_idx on landscape_cases(site_id);
create index if not exists landscape_completion_approvals_tenant_fk_idx on landscape_completion_approvals(tenant_id);
create index if not exists landscape_estimate_items_estimate_fk_idx on landscape_estimate_items(estimate_id);
create index if not exists landscape_estimate_items_evidence_photo_point_fk_idx on landscape_estimate_items(evidence_photo_point_id);
create index if not exists landscape_estimate_items_tenant_fk_idx on landscape_estimate_items(tenant_id);
create index if not exists landscape_estimates_tenant_fk_idx on landscape_estimates(tenant_id);
create index if not exists landscape_followups_case_fk_idx on landscape_followups(case_id);
create index if not exists landscape_inquiries_case_fk_idx on landscape_inquiries(case_id);
create index if not exists landscape_inquiries_tenant_fk_idx on landscape_inquiries(tenant_id);
create index if not exists landscape_issues_case_fk_idx on landscape_issues(case_id);
create index if not exists landscape_issues_tenant_fk_idx on landscape_issues(tenant_id);
create index if not exists landscape_notifications_case_fk_idx on landscape_notifications(case_id);
create index if not exists landscape_photo_points_case_fk_idx on landscape_photo_points(case_id);
create index if not exists landscape_photos_case_fk_idx on landscape_photos(case_id);
create index if not exists landscape_photos_photo_point_fk_idx on landscape_photos(photo_point_id);
create index if not exists landscape_schedule_events_case_fk_idx on landscape_schedule_events(case_id);
create index if not exists landscape_sites_customer_fk_idx on landscape_sites(customer_id);
create index if not exists landscape_surveys_case_fk_idx on landscape_surveys(case_id);
create index if not exists landscape_surveys_tenant_fk_idx on landscape_surveys(tenant_id);
create index if not exists landscape_user_access_customer_fk_idx on landscape_user_access(customer_id);
create index if not exists landscape_work_logs_case_fk_idx on landscape_work_logs(case_id);
create index if not exists landscape_work_logs_tenant_fk_idx on landscape_work_logs(tenant_id);
