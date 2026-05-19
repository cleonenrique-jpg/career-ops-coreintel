-- Rename interview_prep.pdf_url to file_url (playbook is now generated as .docx).
alter table interview_prep
  rename column pdf_url to file_url;
