import {test} from "node:test";
import assert from "node:assert/strict";
import {commercialMenuProducts,commercialProductNeedsConfiguration,productOptionGroups,prepareGroupedItem} from "../src/features/storefront/domain/grouped-cart.ts";
const product=(id,kind,metadata={})=>({id,kind,category_id:"menu",active:true,available:true,base_price:10,metadata});
test("mixed segments preserve every configured product, including SIMPLE",()=>{
 const products=[product("pizza","PIZZA"),product("burger","BURGER"),product("acai","SIMPLE"),product("coffee","DRINK"),product("meal","SIMPLE")];
 assert.deepEqual(commercialMenuProducts(products,["menu"]).map(p=>p.id),products.map(p=>p.id));
 assert.equal(commercialMenuProducts([...products,{...products[0],active:false}],["menu"]).length,5);
 assert.equal(commercialMenuProducts(products,[]).length,0);
});
test("options belong to individual products regardless of segment",()=>{
 const a=product("acai","SIMPLE",{options:[{id:"tamanho",name:"Volume",required:true,choices:[{id:"300",name:"300 ml",price:2},{id:"500",name:"500 ml",available:false,price:5}]}]});
 assert.deepEqual(productOptionGroups(a),[{id:"tamanho",name:"Volume",required:true,choices:[{id:"300",name:"300 ml",price:2}]}]);
 assert.deepEqual(productOptionGroups(product("coffee","DRINK")),[]);
 assert.equal(commercialProductNeedsConfiguration(a,[]),true);
 assert.equal(commercialProductNeedsConfiguration(product("plain","PIZZA"),[]),false);
});
test("generic named groups support independent products without pizza metadata",()=>{
 for(const [id,kind,name] of [["acai","SIMPLE","Frutas"],["burger","BURGER","Queijos"],["meal","SIMPLE","Acompanhamentos"],["coffee","DRINK","Leites"]]){
  const p=product(id,kind),g={id:"g-"+id,name,required:true,min_selections:1,max_selections:1,active:true,products:[{product_id:id}],addons:[{id:"a-"+id,name:"Opção",active:true,price_delta:2}]};
  assert.equal(commercialProductNeedsConfiguration(p,[g]),true);
  const item={productId:id,quantity:1,sizeId:null,crustId:null,addons:[{id:"a-"+id}],complements:[],isHalf:false,secondProductId:null,unitPrice:12};
  assert.equal(prepareGroupedItem(item,{products:[p],addonGroups:[g]}).expected_unit_price,12);
  assert.throws(()=>prepareGroupedItem({...item,addons:[]},{products:[p],addonGroups:[g]}));
 }
});
test("unknown preparation metadata remains blocked rather than translated silently",()=>{
 assert.throws(()=>productOptionGroups(product("tea","DRINK",{options:[{id:"temperature",choices:[]}]})));
});
