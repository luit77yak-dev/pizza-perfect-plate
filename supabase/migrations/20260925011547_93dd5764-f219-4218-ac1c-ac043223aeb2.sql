-- The product-images bucket is public, so files are already served through
-- public URLs without needing a permissive SELECT policy on storage.objects.
-- Dropping this policy removes the unbound read rule flagged by the scanner
-- while public image URLs keep working and staff write policies stay intact.
DROP POLICY IF EXISTS "product images are publicly readable" ON storage.objects;