-- Permite auditar la eliminación de usuarios desde el panel admin.
ALTER TYPE admin_action ADD VALUE IF NOT EXISTS 'delete';
