import assert from 'node:assert/strict';
class Storage{constructor(){this.m=new Map()}get length(){return this.m.size}key(i){return[...this.m.keys()][i]??null}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
globalThis.localStorage=new Storage();
const {createWarehouseItem,getWarehouseItems,getWarehouseMovements,getWarehouseOverview,recordStockMovement,reconcileWarehouseItem,deleteWarehouseItem}=await import('../core/warehouse.js');
const created=createWarehouseItem({name:'Уголь',category:'coal',unit:'кг',quantity:10,minimum:3});
assert.equal(created.success,true); assert.equal(getWarehouseOverview().attention.length,0); console.log('✓ позиция склада создаётся и находится в норме');
assert.equal(recordStockMovement(created.item.id,{type:'expense',amount:8,comment:'Смена'}).success,true); assert.equal(getWarehouseOverview().attention[0].stockState,'low'); console.log('✓ расход меняет остаток и поднимает низкий запас');
assert.equal(recordStockMovement(created.item.id,{type:'expense',amount:5}).success,false); assert.equal(getWarehouseItems()[0].quantity,2); console.log('✓ отрицательный остаток запрещён');
assert.equal(recordStockMovement(created.item.id,{type:'income',amount:5}).item.quantity,7); assert.equal(getWarehouseMovements().length,2); console.log('✓ приход и история движений сохраняются атомарно');
assert.equal(reconcileWarehouseItem(created.item.id,1).item.quantity,1); assert.match(getWarehouseMovements()[0].comment,/Инвентаризация/); console.log('✓ инвентаризация создаёт явную корректировку');
assert.equal(deleteWarehouseItem(created.item.id),true); assert.equal(getWarehouseItems().length,0); console.log('✓ позицию можно удалить явно');
