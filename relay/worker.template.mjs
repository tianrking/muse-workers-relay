// Personal Muse transport relay. No Muse credentials or payloads are logged.
const API_PATHS = new Map([['/fetch_vms','GET'],['/device_token/mint','POST'],['/device_token/refresh','POST']]);
export default {
 async fetch(request, env) {
  const RELAY_KEY = env?.MUSE_RELAY_KEY;
  if (!RELAY_KEY) return new Response('Relay secret not configured',{status:503});
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET')
   return Response.json({service:'muse-personal-relay',version:2,build:'2026-10-15'},{headers:{'Cache-Control':'no-store'}});
  if (request.headers.get('X-Muse-Relay-Key') !== RELAY_KEY)
   return new Response('Unauthorized',{status:401});
  let target;
  if (url.pathname === '/v1/noise') {
   if(request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
    return new Response('WebSocket required',{status:426});
   const ids=url.searchParams.getAll('vm_id');
   if(ids.length!==1 || !/^[a-zA-Z0-9_-]{1,128}$/.test(ids[0]) || [...url.searchParams.keys()].some(k=>k!=='vm_id'))
    return new Response('Invalid VM id',{status:400});
   target=new URL('https://hatch.metaaivm.com/v1/noise');
   target.search=url.search;
  } else if (API_PATHS.has(url.pathname) && !url.search) {
   if(request.method !== API_PATHS.get(url.pathname)) return new Response('Method not allowed',{status:405});
   target=new URL(url.pathname,'https://api.muse.ai');
  } else return new Response('Not found',{status:404});
  if(!request.headers.get('Authorization')?.startsWith('Bearer ')) return new Response('Muse authorization required',{status:401});
  const headers=new Headers();
  for(const name of ['Authorization','Content-Type','X-API-Version','Upgrade','Connection','Sec-WebSocket-Key','Sec-WebSocket-Version','Sec-WebSocket-Protocol']) {
   const value=request.headers.get(name); if(value!==null) headers.set(name,value);
  }
  try {
   const upstream=await fetch(new Request(target,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual',duplex:'half'}));
   if(upstream.status===101) return upstream;
   const out=new Headers(upstream.headers); out.set('Cache-Control','no-store');out.delete('Set-Cookie');
   return new Response(upstream.body,{status:upstream.status,headers:out});
  } catch { return new Response('Upstream unavailable',{status:502}); }
 }
};
