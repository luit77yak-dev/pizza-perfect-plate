export const STATUSES=['RECEIVED','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED'] as const;
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export type Transition={instance_id:string;order_id:string;expected_status:string;next_status:string;operation_id:string};
export function parseTransition(p:unknown):Transition{
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid transition request');
 const v=p as Record<string,unknown>;
 if(Object.keys(v).length!==5||!uuid(v.instance_id)||!uuid(v.order_id)||!uuid(v.operation_id)
 ||typeof v.expected_status!=='string'||!(STATUSES as readonly string[]).includes(v.expected_status)
 ||typeof v.next_status!=='string'||!(STATUSES as readonly string[]).slice(1).includes(v.next_status))throw Error('Invalid transition request');
 return {instance_id:v.instance_id,order_id:v.order_id,operation_id:v.operation_id,expected_status:v.expected_status,next_status:v.next_status};
}
export function operatorBearer(value:string|null):string{
 if(!value||!/^Bearer [A-Za-z0-9_-]{43}$/.test(value))throw Error('Operational authorization required');
 return value.slice(7);
}
export function lifecycleHttpStatus(code:unknown):number{
 if(code==='42501')return 403;
 if(code==='PT409'||code==='23505')return 409;
 if(code==='22023')return 422;
 return 503;
}
