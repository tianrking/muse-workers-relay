// Browser port of Meta Muse gadget protocol (Apache-2.0), upstream 8e613f77.
// Noise XX, AES-GCM and X25519 use the browser's native Web Crypto implementation.
const enc=new TextEncoder(), dec=new TextDecoder();
const bytes=value=>typeof value==='string'?enc.encode(value):new Uint8Array(value);
const cat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const vi=value=>{let n=BigInt(value),out=[];do{let b=Number(n&127n);n>>=7n;out.push(b|(n?128:0));}while(n);return Uint8Array.from(out);};
const num=(field,value)=>cat(vi(field*8),vi(value));
const blob=(field,value)=>{const b=bytes(value);return cat(vi(field*8+2),vi(b.length),b);};
function fields(data){
 const out=new Map();let p=0;
 const read=()=>{let n=0n;for(let i=0;i<10;i++){if(p>=data.length)throw Error('协议数据不完整');const b=data[p++];if(i===9&&b>1)throw Error('协议整数无效');n|=BigInt(b&127)<<BigInt(i*7);if(!(b&128))return n;}throw Error('协议整数过长');};
 while(p<data.length){const key=Number(read()),f=key>>3,w=key&7;if(!f)throw Error('协议字段无效');let value;
  if(w===0)value=read();else if(w===2){const n=Number(read());if(n>data.length-p)throw Error('协议长度无效');value=data.slice(p,p+n);p+=n;}
  else if(w===1||w===5){p+=w===1?8:4;if(p>data.length)throw Error('协议字段截断');continue;}else throw Error('协议类型无效');
  if(!out.has(f))out.set(f,[]);out.get(f).push(value);
 }return out;
}
const last=(f,n,fallback)=>f.get(n)?.at(-1)??fallback;
const integer=(f,n,fallback=0)=>Number(last(f,n,BigInt(fallback)));
const raw=(f,n)=>last(f,n,new Uint8Array());
const sha=async data=>new Uint8Array(await crypto.subtle.digest('SHA-256',data));
const hmac=async(key,data)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']),data));
async function hkdf(key,input){const tmp=await hmac(key,input),a=await hmac(tmp,Uint8Array.of(1));return [a,await hmac(tmp,cat(a,Uint8Array.of(2)))];}
class Cipher{
 constructor(key){this.key=key;this.nonce=0;this.dead=false;}
 async apply(data,ad,decrypt=false){
  if(this.dead||this.nonce>=Number.MAX_SAFE_INTEGER)throw Error('加密连接已失效');
  if(!this.key)return data;
  const iv=new Uint8Array(12);new DataView(iv.buffer).setBigUint64(4,BigInt(this.nonce++),false);
  try{const key=await crypto.subtle.importKey('raw',this.key,'AES-GCM',false,[decrypt?'decrypt':'encrypt']);return new Uint8Array(await crypto.subtle[decrypt?'decrypt':'encrypt']({name:'AES-GCM',iv,additionalData:ad,tagLength:128},key,data));}
  catch{this.dead=true;throw Error('Muse 加密校验失败');}
 }
}
async function keypair(){const key=await crypto.subtle.generateKey('X25519',true,['deriveBits']);return {private:key.privateKey,public:new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey))};}
async function dh(privateKey,publicBytes){if(publicBytes.length!==32)throw Error('无效的 Muse 公钥');const publicKey=await crypto.subtle.importKey('raw',publicBytes,'X25519',false,[]);const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'X25519',public:publicKey},privateKey,256));if(shared.every(v=>v===0))throw Error('无效的 Muse 公钥');return shared;}
export class NoiseInitiator{
 async start(){this.h=new Uint8Array(32);this.h.set(enc.encode('Noise_XX_25519_AESGCM_SHA256'));this.ck=this.h.slice();this.cipher=new Cipher();await this.mixHash(new Uint8Array());this.e=await keypair();await this.mixHash(this.e.public);await this.encryptHash(new Uint8Array());return this.e.public;}
 async mixHash(data){this.h=await sha(cat(this.h,data));}
 async mixKey(data){const [ck,key]=await hkdf(this.ck,data);this.ck=ck;this.cipher=new Cipher(key);}
 async encryptHash(data){const out=await this.cipher.apply(data,this.h);await this.mixHash(out);return out;}
 async decryptHash(data){const out=await this.cipher.apply(data,this.h,true);await this.mixHash(data);return out;}
 async finish(message){if(message.length<96)throw Error('Muse 握手消息过短');const re=message.slice(0,32);await this.mixHash(re);await this.mixKey(await dh(this.e.private,re));const rs=await this.decryptHash(message.slice(32,80));await this.mixKey(await dh(this.e.private,rs));await this.decryptHash(message.slice(80));const s=await keypair(),encryptedStatic=await this.encryptHash(s.public);await this.mixKey(await dh(s.private,re));const m3=cat(encryptedStatic,await this.encryptHash(new Uint8Array()));const [send,recv]=await hkdf(this.ck,new Uint8Array());this.e=null;this.ck=null;return {message:m3,send:new Cipher(send),recv:new Cipher(recv)};}
}
function deferred(ms=35000){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});const timer=setTimeout(()=>reject(Error('Muse 响应超时，请重新连接')),ms);promise.catch(()=>{});return {promise,resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};}
export class MuseClient{
 constructor({base=location.origin,onState=()=>{},onReply=()=>{}}={}){this.base=base;this.onState=onState;this.onReply=onReply;this.ready=false;this.streams=new Map();this.assemblies=new Map();this.nextId=1;this.sendChain=Promise.resolve();this.readChain=Promise.resolve();this.control=new Uint8Array();this.subText='';this.turn=null;}
 state(text){this.onState(text);}
 async connect(credentials){
  this.close();this.credentials=credentials;this.state('正在验证账号…');
  const response=await fetch(this.base+'/fetch_vms',{headers:{Authorization:'Bearer '+credentials.access_token,'X-Muse-Relay-Key':credentials.relay_key,'X-API-Version':'1.0.0'},cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error(response.status===401?'授权失效或中转密钥不正确':'Muse 账号暂时不可用');
  const data=await response.json(),vm=data.vm_list?.find(v=>v.default)||data.vm_list?.[0];if(!vm)throw Error('账号中没有可用的 Muse');
  this.chatSession=crypto.randomUUID();this.retired=new Set();this.nextId=1;this.control=new Uint8Array();this.subText='';this.sendChain=Promise.resolve();this.readChain=Promise.resolve();this.assemblies.clear();
  const auth=btoa(JSON.stringify({key:credentials.relay_key,token:vm.vm_auth_token})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const url=new URL('/web/noise?vm_id='+encodeURIComponent(vm.vm_id),this.base);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(url,['muse-v1','muse-auth.'+auth]);this.ws=ws;ws.binaryType='arraybuffer';const opened=deferred(25000),message2=deferred(25000);let phase='handshake';
  ws.onopen=()=>opened.resolve();ws.onerror=()=>{opened.reject(Error('无法连接中转'));message2.reject(Error('Muse 握手连接失败'));};
  ws.onclose=()=>{opened.reject(Error('连接已关闭'));message2.reject(Error('连接已关闭'));if(this.ws===ws){this.ready=false;this.failPending(Error('Muse 已断开，请重新连接'));this.state('连接已断开');}};
  ws.onmessage=event=>{if(typeof event.data==='string')return;if(phase==='handshake'){phase='waiting';message2.resolve(new Uint8Array(event.data));return;}this.readChain=this.readChain.then(()=>this.receive(new Uint8Array(event.data))).catch(error=>{this.state(error.message||'加密连接异常，请重新连接');this.close();});};
  await opened.promise;this.state('正在建立加密连接…');const noise=new NoiseInitiator();ws.send(await noise.start());const keys=await noise.finish(await message2.promise);this.sendCipher=keys.send;this.recvCipher=keys.recv;phase='transport';ws.send(keys.message);
  this.registered=deferred();this.controlId=this.request('POST','/link-control',new Uint8Array(),false,[],()=>{});await this.sendChain;
  this.registerId=crypto.randomUUID();await this.controlSend({type:'req',id:this.registerId,method:'link.register',params:{node_id:'muse-web-playground',display_name:'Muse Little Room',platform:'web',version:'0.1',device_family:'homehub',model_id:'web',is_wakeup_supported:false,commands_v2:{}}});await this.registered.promise;
  this.subDecoder=new TextDecoder();this.subscriptionId=this.request('POST','/chat/subscribe',enc.encode('{}'),true,[['Content-Type','application/json'],['Accept','application/x-ndjson']],(body,end,status)=>{if(status>=400)throw Error('Muse 拒绝聊天订阅');this.subText+=this.subDecoder.decode(body,{stream:!end});if(this.subText.length>262144)throw Error('Muse 事件过大');let at;while((at=this.subText.indexOf('\n'))>=0){const line=this.subText.slice(0,at);this.subText=this.subText.slice(at+1);if(line.trim())this.chatEvent(JSON.parse(line));}});
  await this.sendChain;this.ready=true;this.state('已连接 Muse');
 }
 failPending(error){this.registered?.reject(error);for(const s of this.streams.values())s.wait?.reject(error);this.streams.clear();this.turn?.wait.reject(error);this.turn=null;}
 close(){this.ready=false;this.failPending(Error('连接已结束'));if(this.ws){this.ws.onclose=null;this.ws.close();this.ws=null;}clearInterval(this.turnTimer);}
 async sendFrame(frame){const envelope=blob(2,frame),id=crypto.getRandomValues(new Uint32Array(1))[0],count=Math.max(1,Math.ceil(envelope.length/65489));for(let index=0;index<count;index++){const plain=cat(num(1,id),num(2,index),num(3,count),blob(4,envelope.slice(index*65489,(index+1)*65489)));this.ws.send(await this.sendCipher.apply(plain,new Uint8Array()));}}
 enqueue(frame){this.sendChain=this.sendChain.then(()=>this.sendFrame(frame));return this.sendChain;}
 request(method,path,body,end,headers,callback,wait){const id=this.nextId++;this.streams.set(id,{callback,wait,parts:[],bytes:0,status:0});const app=cat(blob(1,method),blob(2,path),...headers.map(([k,v])=>blob(3,cat(blob(1,k),blob(2,v)))),blob(4,body),num(5,end?1:0));this.enqueue(cat(num(1,id),blob(2,app)));return id;}
 controlSend(value){const data=enc.encode(JSON.stringify(value)),prefix=new Uint8Array(4);new DataView(prefix.buffer).setUint32(0,data.length,true);return this.enqueue(cat(num(1,this.controlId),blob(4,blob(1,cat(prefix,data)))));}
 async receive(ciphertext){
  const plain=await this.recvCipher.apply(ciphertext,new Uint8Array(),true),f=fields(plain),id=String(last(f,1,0n)),index=integer(f,2),total=integer(f,3,1),payload=raw(f,4);
  if(total<1||total>256||index>=total||payload.length>65489)throw Error('Muse 分片无效');
  for(const [k,a]of this.assemblies)if(Date.now()-a.created>60000)this.assemblies.delete(k);
  let assembly=this.assemblies.get(id);if(!assembly){if(this.assemblies.size>=16)throw Error('Muse 分片过多');assembly={total,parts:new Map(),size:0,created:Date.now()};this.assemblies.set(id,assembly);}
  if(assembly.total!==total||assembly.parts.has(index)||(assembly.size+=payload.length)>16777216)throw Error('Muse 分片异常');assembly.parts.set(index,payload);if(assembly.parts.size<total)return;this.assemblies.delete(id);
  const env=fields(cat(...Array.from({length:total},(_,i)=>assembly.parts.get(i)))),frame=fields(raw(env,1)),sid=integer(frame,1),stream=this.streams.get(sid);if(!stream)return;
  if(frame.has(5)){stream.wait?.reject(Error('Muse 关闭了消息流'));if(sid===this.controlId)throw Error('Muse 已断开');this.streams.delete(sid);return;}
  let body,end;
  if(frame.has(3)){const response=fields(raw(frame,3));stream.status=integer(response,1);body=raw(response,3);end=!!integer(response,4);if(stream.status>=400){stream.wait?.reject(Error('Muse 请求失败：'+stream.status));if(sid===this.controlId)throw Error('Muse 注册被拒绝');}}
  else if(frame.has(4)){const chunk=fields(raw(frame,4));body=raw(chunk,1);end=!!integer(chunk,2);}else return;
  if(sid===this.controlId){this.control=cat(this.control,body);if(this.control.length>1048576)throw Error('控制消息过大');while(this.control.length>=4){const length=new DataView(this.control.buffer,this.control.byteOffset,4).getUint32(0,true);if(length>1048576)throw Error('控制消息过大');if(this.control.length<length+4)break;const msg=JSON.parse(dec.decode(this.control.slice(4,length+4)));this.control=this.control.slice(length+4);if(msg.id===this.registerId){if(msg.error||msg.ok===false)this.registered.reject(Error('Muse 注册失败'));else this.registered.resolve();}if(msg.method==='link.invoke')await this.controlSend({method:'link.result',id:msg.id,ok:false,error:{message:'Web playground does not execute commands'}});}}
  else if(stream.callback)stream.callback(body,end,stream.status);
  else if(stream.wait){stream.bytes+=body.length;if(stream.bytes>1048576)throw Error('Muse 响应过大');stream.parts.push(body);if(end){if(stream.status>=400)stream.wait.reject(Error('Muse 请求失败'));else stream.wait.resolve(JSON.parse(dec.decode(cat(...stream.parts))));}}
  if(end){this.streams.delete(sid);if(sid===this.controlId)throw Error('Muse 连接结束');}
 }
 async chat(message){
  if(!this.ready)throw Error('请先连接 Muse');if(this.turn)throw Error('Muse 正在回复，请稍等');if(!message.trim()||message.length>2000)throw Error('请输入 1–2000 字');
  const turn={wait:deferred(90000),parents:new Set(),replies:new Map(),pending:[],ack:false};this.turn=turn;this.state('Muse 在想啦…');
  try{const ackWait=deferred();this.request('POST','/chat/stream',enc.encode(JSON.stringify({message:message.trim(),output_modality:'text'})),true,[['Content-Type','application/json'],['x-app-id','hatch-web'],['x-request-id',crypto.randomUUID()]],null,ackWait);await this.sendChain;const ack=await ackWait.promise;const result=ack.result||ack;for(const key of ['message_id','reply_to_message_id'])if(result[key])turn.parents.add(result[key]);if(!turn.parents.size)throw Error('Muse 未确认消息');turn.session=result.session_id;turn.ack=true;this.state('正在等待 Muse 回复…');for(const ev of turn.pending)this.chatEvent(ev);turn.pending=[];await turn.wait.promise;this.state('已连接 Muse');}
  finally{clearTimeout(turn.finishTimer);for(const id of turn.replies.keys())this.retired.add(id);for(const id of turn.parents)this.retired.add(id);while(this.retired.size>2048)this.retired.delete(this.retired.values().next().value);if(this.turn===turn)this.turn=null;}
 }
 chatEvent(event){
  const turn=this.turn;if(!turn||event.type!=='event')return;if(!turn.ack){if(turn.pending.length>=64)throw Error('Muse 待处理事件过多');turn.pending.push(event);return;}
  const p=event.payload||{},session=p.session_id||event.session_id;if(session&&turn.session&&session!==turn.session)return;
  const id=p.message_id||event.message_id||p.id,parent=p.reply_to_message_id||p.parent_message_id;
  if(!['delta.message_start','delta.text_append','delta.message_done','message.assistant'].includes(event.event)||p.role==='user'||!id)return;
  if(this.retired.has(id))return;let reply=turn.replies.get(id);if(!reply&&parent&&!turn.parents.has(parent)&&!turn.replies.has(parent))return;if(!reply&&!parent&&session!==turn.session)return;
  if(!reply){if(turn.replies.size>=32)throw Error('Muse 回复过多');reply={id,text:'',done:false};turn.replies.set(id,reply);}
  if(event.event==='delta.text_append'&&typeof p.text==='string'&&!reply.done)reply.text+=p.text;
  if(['delta.message_done','message.assistant'].includes(event.event)){const final=p.display_text??(typeof p.transcript==='string'?p.transcript:undefined)??(typeof p.content==='string'?p.content:undefined);if(typeof final==='string')reply.text=final;reply.done=true;}
  if(reply.text.length>65536)throw Error('Muse 回复过长');this.onReply({...reply});
  clearTimeout(turn.finishTimer);if([...turn.replies.values()].every(r=>r.done)&&[...turn.replies.values()].some(r=>r.text))turn.finishTimer=setTimeout(()=>turn.wait.resolve(),1500);
 }
}
