-- Rename cv_tailored.pdf_url to file_url (CV is now generated as .docx instead of PDF).
alter table cv_tailored
  rename column pdf_url to file_url;
