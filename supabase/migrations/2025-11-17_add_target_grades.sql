-- Migration: Add target_grades to lessons and contests
-- Date: 2025-11-17

-- Add target_grades column to lessons table
alter table if exists lessons 
add column if not exists target_grades text[];

-- Add target_grades column to contests table  
alter table if exists contests
add column if not exists target_grades text[];

-- Add comments
comment on column lessons.target_grades is 'Target student grades: array of "10", "11", "12", or empty for all grades';
comment on column contests.target_grades is 'Target student grades: array of "10", "11", "12", or empty for all grades';
