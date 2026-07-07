UPDATE chapters
SET plain_text = CASE
  WHEN trim(plain_text) <> '' THEN plain_text
  ELSE content_markdown
END;

UPDATE chapter_versions
SET plain_text = CASE
  WHEN trim(plain_text) <> '' THEN plain_text
  ELSE content_markdown
END;

ALTER TABLE chapters DROP COLUMN content_json;
ALTER TABLE chapters DROP COLUMN content_markdown;
ALTER TABLE chapter_versions DROP COLUMN content_json;
ALTER TABLE chapter_versions DROP COLUMN content_markdown;
