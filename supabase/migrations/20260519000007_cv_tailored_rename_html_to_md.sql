-- Rename cv_tailored.html_content to content_md (we now render the tailored CV as markdown for inline preview).
alter table cv_tailored
  rename column html_content to content_md;
