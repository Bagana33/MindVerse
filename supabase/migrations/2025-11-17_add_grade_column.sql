-- Migration: Add grade column to users table for students
-- Date: 2025-11-17

-- Add grade column to users table
alter table if exists users 
add column if not exists grade text;

-- Add comment
comment on column users.grade is 'Student grade/class: 10, 11, 12, or R (graduating class)';
