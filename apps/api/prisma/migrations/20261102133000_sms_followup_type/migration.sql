-- Additive task channel; scheduling a task never sends a business SMS automatically.
ALTER TYPE "FollowUpType" ADD VALUE IF NOT EXISTS 'SMS';
