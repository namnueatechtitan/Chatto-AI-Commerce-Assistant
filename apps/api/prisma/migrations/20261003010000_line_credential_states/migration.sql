-- Separate committed migration: new enum labels must exist before constraints use them.
ALTER TYPE "ChannelStatus" ADD VALUE IF NOT EXISTS 'configured';
ALTER TYPE "ChannelStatus" ADD VALUE IF NOT EXISTS 'credentials_verified';
ALTER TYPE "ChannelStatus" ADD VALUE IF NOT EXISTS 'webhook_pending';
ALTER TYPE "ChannelStatus" ADD VALUE IF NOT EXISTS 'error';
