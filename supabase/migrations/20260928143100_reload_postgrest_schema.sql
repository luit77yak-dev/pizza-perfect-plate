-- Ensure the Data API sees the updated get_public_order_status return shape.
NOTIFY pgrst, 'reload schema';
