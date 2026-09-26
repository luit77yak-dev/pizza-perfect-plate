      .eq("organization_id", organizationId);

    if (updateError) setError(updateError.message);
    else setProducts((current) => current.map((item) => item.id === product.id ? { ...item, image_url: null } : item));
    setImageUploading(null);
  };

  const updateStatus = async (order: Order, nextStatus: OrderStatus) => {
    if (!organizationId || order.status === nextStatus) return;
    setError(null);
    const { error: updateError } = await supabase.rpc("update_order_status", {
      p_order_id: order.id,
      p_organization_id: organizationId,
      p_status: nextStatus,
      p_note: null,
    });

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadOrders();
  };

  const activeOrders = useMemo(
    () => orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status)),
    [orders],
  );

  const todayHighlights = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayOrders = orders.filter((order) => {
      const createdAt = new Date(order.created_at);