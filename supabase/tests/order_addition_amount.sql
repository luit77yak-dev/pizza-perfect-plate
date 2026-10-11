begin;
do $test$
declare
 org uuid:=gen_random_uuid();
 org_other uuid:=gen_random_uuid();
 sys uuid:=gen_random_uuid();
 inst uuid:=gen_random_uuid();
 other_inst uuid:=gen_random_uuid();
 product uuid:=gen_random_uuid();
 foreign_product uuid:=gen_random_uuid();
 amount numeric;
begin
 insert into public.neroxa_organizations(id,legal_name) values(org,'Price Test'),(org_other,'Other Test');
 insert into public.neroxa_systems(id,slug,name,system_type) values(sys,'price-test','Price Test','DELIVERY');
 insert into public.neroxa_system_instances(id,organization_id,system_id,name,slug,system_type)
 values(inst,org,sys,'Price A','price-a','DELIVERY'),(other_inst,org_other,sys,'Price B','price-b','DELIVERY');
 insert into public.neroxa_storefront_products(id,instance_id,name,slug,price,active)
 values(product,inst,'Pizza','pizza',12.50,true),(foreign_product,other_inst,'Other','other',90,true);
 select public.neroxa_calculate_addition_amount(inst,jsonb_build_array(jsonb_build_object('product_id',product,'quantity',2,'unit_price',0)))
 into amount;
 if amount<>25 then raise exception 'FAIL: catalog price not used'; end if;
 begin
   perform public.neroxa_calculate_addition_amount(inst,jsonb_build_array(jsonb_build_object('product_id',foreign_product,'quantity',1)));
   raise exception 'FAIL: foreign store item accepted';
 exception when raise_exception then
   if sqlerrm <> 'Product unavailable in this restaurant' then raise; end if;
 end;
 begin
   perform public.neroxa_calculate_addition_amount(inst,jsonb_build_array(jsonb_build_object('product_id',product,'quantity',0)));
   raise exception 'FAIL: zero quantity accepted';
 exception when raise_exception then
   if sqlerrm <> 'Invalid item quantity' then raise; end if;
 end;
 begin
   perform public.neroxa_calculate_addition_amount(inst,'[]'::jsonb);
   raise exception 'FAIL: empty items accepted';
 exception when raise_exception then
   if sqlerrm <> 'Invalid addition items' then raise; end if;
 end;
 if has_function_privilege('anon','public.neroxa_calculate_addition_amount(uuid,jsonb)','EXECUTE') then
   raise exception 'FAIL: public pricing helper exposed';
 end if;
end;
$test$;
rollback;
