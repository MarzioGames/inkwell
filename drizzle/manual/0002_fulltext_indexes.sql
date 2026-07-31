-- Full-text indexes for faster, more relevant search.
--
-- Drizzle's MySQL migrator doesn't reliably manage FULLTEXT indexes across
-- versions, so this is a plain SQL file to run by hand (once) against your
-- database — it does NOT run automatically with `npm run db:push`.
--
-- Run it with your MySQL client, e.g.:
--   mysql -u <user> -p <database> < drizzle/manual/0002_fulltext_indexes.sql
--
-- Safe to run more than once won't work as-is (CREATE FULLTEXT INDEX errors
-- if it already exists) — each statement checks information_schema first.

SET @db := DATABASE();

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'posts' AND index_name = 'ft_posts_title_content') = 0,
  'ALTER TABLE posts ADD FULLTEXT INDEX ft_posts_title_content (title, content)',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'listings' AND index_name = 'ft_listings_title_book_author_desc') = 0,
  'ALTER TABLE listings ADD FULLTEXT INDEX ft_listings_title_book_author_desc (title, bookTitle, author, description)',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'books' AND index_name = 'ft_books_title_author_desc') = 0,
  'ALTER TABLE books ADD FULLTEXT INDEX ft_books_title_author_desc (title, author, description)',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'communities' AND index_name = 'ft_communities_name_desc') = 0,
  'ALTER TABLE communities ADD FULLTEXT INDEX ft_communities_name_desc (name, description)',
  'SELECT 1'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
