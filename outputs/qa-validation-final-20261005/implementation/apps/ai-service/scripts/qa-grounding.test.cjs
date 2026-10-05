const test=require('node:test');
const assert=require('node:assert/strict');
const {bindClaims,renderCatalogRow}=require('../dist/modules/qa/grounding');
const sources=[{id:'bag',type:'product',title:'Bag',text:'price: 390; currency: THB; available_qty: 9'}];
test('source binding rejects swapped facts and wrong currency despite shared numeric values',()=>{
  for(const quote of ['price: 9','available_qty: 390','currency: USD']) assert.throws(()=>bindClaims([{source_id:'bag',quote}],sources),/UNSUPPORTED/);
  assert.equal(bindClaims([{source_id:'bag',quote:sources[0].text}],sources).length,1);
});
test('source binding rejects absent sources and malformed claims',()=>{
  assert.throws(()=>bindClaims([{source_id:'invented',quote:'price: 390'}],sources));
  assert.throws(()=>bindClaims([{source_id:'bag',quote:''}],sources));
});
test('database rendering preserves unknown separately from zero',()=>{
  assert.equal(renderCatalogRow({price:null,available_qty:0}),'price: unknown; available_qty: 0');
});
