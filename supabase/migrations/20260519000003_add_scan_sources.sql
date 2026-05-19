-- Add procomer + cinde to scan_source enum (ported from scan-listings.mjs scrapers).
alter type scan_source add value if not exists 'procomer';
alter type scan_source add value if not exists 'cinde';
