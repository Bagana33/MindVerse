#!/bin/bash
# Run this script to apply the posts table migration to Supabase

echo "🔧 Applying migration: Add title and description columns to posts table"
echo ""
echo "Please run the following SQL in your Supabase SQL Editor:"
echo ""
cat supabase/migrations/2025-11-20_add_post_columns.sql
echo ""
echo "✅ After running the migration, posts will have title and description columns."
echo "✅ Existing posts will be backfilled with their text content."
