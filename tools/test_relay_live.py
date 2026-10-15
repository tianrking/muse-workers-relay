"""Live direct/relay checks using the upstream Python Noise client; no executor."""
import asyncio, contextlib, json, logging, sys, time, uuid, urllib.request, urllib.error, base64, io, wave
from urllib.parse import quote
from pathlib import Path
import argparse
ROOT = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--mode',choices=['direct','relay','both'],default='both')
parser.add_argument('--voice-output',action='store_true')
parser.add_argument('--voice-note',action='store_true')
parser.add_argument('--voice-note-file',type=Path,help='PCM16 mono 16 kHz WAV sample')
parser.add_argument('--trace-frames',action='store_true')
parser.add_argument('--credentials',type=Path,default=ROOT/'secrets/pc-relay-credentials.json')
parser.add_argument('--sdk-source',type=Path,default=ROOT.parent/'references/muse-gadget-sdk/linux/src')
parser.add_argument('--report',type=Path,default=ROOT/'relay/pc-live-results.json')
args=parser.parse_args()
sys.path.insert(0,str(args.sdk_source))
import musegadget.link_client as link_client
link_client.APP_ID='hatch-web'
from musegadget.link_client import LinkSession, DeviceDescription
from musegadget.muse_turn import MuseTurn
from musegadget.noise import Header
from websockets.asyncio.client import connect
logging.disable(logging.CRITICAL)
creds=json.loads(args.credentials.read_text())
relay_key=(ROOT/'secrets/relay-key.txt').read_text().strip()
results=[]
def emit(stage, **fields):
    row={'stage':stage,**fields};results.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
def api(base, path, method='GET', body=None, token=None, relay=False):
    headers={'Authorization':'Bearer '+(token or creds['access_token']),'X-API-Version':'1.0.0','User-Agent':'MuseGadget-RelayTest/1.0'}
    if relay:headers['X-Muse-Relay-Key']=relay_key
    data=json.dumps(body).encode() if body is not None else None
    if data is not None:headers['Content-Type']='application/json'
    req=urllib.request.Request(base+path,data=data,headers=headers,method=method)
    start=time.monotonic()
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=20) as resp:
            status=resp.status; raw=resp.read()
    except urllib.error.HTTPError as exc:
        status=exc.code;raw=exc.read()
    try:parsed=json.loads(raw)
    except ValueError:parsed={}
    return status,parsed,round((time.monotonic()-start)*1000)
async def session_test(mode, vm):
    relay=mode=='relay'; host='muse.w0x7ce.eu' if relay else creds.get('noise_host','hatch.metaaivm.com')
    metrics={}
    async def dial(url, headers):
        if relay:headers['X-Muse-Relay-Key']=relay_key
        start=time.monotonic()
        ws=await connect(url,additional_headers=headers,proxy=None,open_timeout=25,ping_interval=20,ping_timeout=20,max_size=None)
        metrics['upgrade_status']=ws.response.status_code;metrics['upgrade_ms']=round((time.monotonic()-start)*1000)
        return ws
    # Empty capabilities and an always-rejecting executor: this never gives the PC command access.
    device=DeviceDescription('homelink-1e613c','Muse relay protocol test','0.1',{})
    sess=LinkSession(noise_host=host,vm_id=vm['vm_id'],vm_auth_token=vm['vm_auth_token'],device=device,
        run_command=lambda *_:{'ok':False,'error':{'message':'Live protocol test: command execution disabled'}},connect=dial)
    original_handshake=sess._handshake
    async def traced_handshake(ws):
        transport=await original_handshake(ws)
        decrypt=transport.decrypt_frame
        def traced_decrypt(raw):
            frame=decrypt(raw)
            if frame is not None and args.trace_frames:
                emit(mode+'.frame',kind=frame.kind,stream=frame.stream_id,status=getattr(frame.value,'status',None),ended=getattr(frame.value,'end_body',None),data_bytes=len(getattr(frame.value,'data',b'') or getattr(frame.value,'body',b'')))
            return frame
        transport.decrypt_frame=traced_decrypt
        return transport
    sess._handshake=traced_handshake
    stop=asyncio.Event();runner=asyncio.create_task(sess.run(stop));consumer=None
    try:
        await asyncio.wait_for(sess.registered.wait(),35)
        emit(mode+'.control',**metrics,noise=True,registered=True)
        sid=None;turn=MuseTurn();events=[]
        async def consume():
            async for ev in sess.subscribe_chat():
                events.append(ev.get('event',''));turn.feed(ev)
                if ev.get('event')=='task.status':
                    payload=ev.get('payload',{})
                    emit(mode+'.task_status',status=payload.get('status'),fields=sorted(payload.keys()),error=payload.get('error') or payload.get('error_message') or payload.get('error_code'))
        consumer=asyncio.create_task(consume())
        await asyncio.sleep(.2)  # Like the MCU, do not wait for first subscription data before posting.
        marker='PC_'+mode.upper()+'_RELAY_OK'
        emit(mode+'.chat_post_started')
        request_body={'message':'请只回复 '+marker,'output_modality':'voice' if args.voice_output else 'text'}
        if args.voice_note or args.voice_note_file:
            audio=io.BytesIO()
            pcm=b'\x00\x00'*32000
            if args.voice_note_file:
                with wave.open(str(args.voice_note_file),'rb') as source:
                    if source.getsampwidth()!=2:raise ValueError('test WAV must be PCM16')
                    pcm=source.readframes(source.getnframes())
                    if source.getnchannels()!=1 or source.getframerate()!=16000:raise ValueError('test WAV must be PCM16 mono at 16 kHz')
                    if len(pcm)>2*1024*1024:raise ValueError('test WAV exceeds 2 MiB')
            with wave.open(audio,'wb') as wav:
                wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(pcm)
            request_body['items']=[{'type':'file','mime_type':'audio/wav','filename':'voice_note.wav','data_base64':base64.b64encode(audio.getvalue()).decode()}]
            emit(mode+'.voice_note_upload',wav_bytes=len(audio.getvalue()),json_bytes=len(json.dumps(request_body).encode()),kind='supplied speech sample' if args.voice_note_file else 'synthetic silence, transport only')
        emit(mode+'.request_shape',keys=sorted(request_body),modality=request_body['output_modality'])
        ack=await asyncio.wait_for(sess._post_chat(request_body),45)
        if not ack['ok']:raise RuntimeError('chat HTTP '+str(ack['status']))
        turn.acknowledge(ack['response'])
        emit(mode+'.chat_ack',status=ack['status'],response_fields=sorted(ack['response'].keys()) if isinstance(ack['response'],dict) else [])
        deadline=time.monotonic()+35
        while time.monotonic()<deadline:
            if any(marker in reply.text and reply.done for reply in turn.replies.values()):break
            if runner.done():raise RuntimeError('session ended')
            await asyncio.sleep(.2)
        matches=[r for r in turn.replies.values() if marker in r.text]
        emit(mode+'.chat',status=ack['status'],reply_matched=bool(matches),event_count=len(events),event_types=sorted(set(events)),reply_count=len(turn.replies),reply_lengths=[len(r.text) for r in turn.replies.values()],reply_notice=[r.text[:160] for r in turn.replies.values()] if not matches else [])
        if matches:
            for prefix in ('/api/voice/tts-stream','/voice/tts-stream'):
                try:
                    async with sess.stream_http('GET',prefix+'?message_id='+quote(matches[-1].message_id,safe=''),headers=[Header('Accept','audio/mpeg')],max_buffer_bytes=8*1024*1024) as stream:
                        total=0;error=bytearray()
                        async def read_tts():
                            nonlocal total
                            async for chunk in stream:
                                total+=len(chunk)
                                if stream.status>=400 and len(error)<512:error.extend(chunk[:512-len(error)])
                        await asyncio.wait_for(read_tts(),35)
                        emit(mode+'.tts',path=prefix,status=stream.status,bytes=total,error_body=error.decode('utf8','replace') if error else None)
                        if stream.status==200:break
                except Exception as exc:emit(mode+'.tts',path=prefix,error=type(exc).__name__)
        # The MCU's streamed dictation endpoint: a short silent PCM body checks the binary path.
        path='/api/voice/dictation?sample_rate_hz=24000'
        try:
            async with sess.stream_http('POST',path,b'\x00\x00'*24000,headers=[Header('Accept','application/x-ndjson')]) as stream:
                count=0
                error_body=bytearray()
                async def collect():
                    nonlocal count
                    async for chunk in stream:
                        count+=len(chunk)
                        if stream.status>=400 and len(error_body)<512:error_body.extend(chunk[:512-len(error_body)])
                await asyncio.wait_for(collect(),25)
                emit(mode+'.dictation',status=stream.status,response_bytes=count,error_body=error_body.decode('utf8','replace') if error_body else None)
        except Exception as exc:emit(mode+'.dictation',error=type(exc).__name__)
        pong=await sess._ws.ping();await asyncio.wait_for(pong,10)
        emit(mode+'.keepalive',pong=True)
    finally:
        if consumer:
            consumer.cancel()
            with contextlib.suppress(asyncio.CancelledError,Exception):await consumer
        stop.set()
        with contextlib.suppress(asyncio.CancelledError,Exception):await asyncio.wait_for(runner,8)
        if not runner.done():runner.cancel()
async def main():
    for mode,base in [('direct','https://api.muse.ai'),('relay','https://muse.w0x7ce.eu')]:
        if args.mode not in ('both',mode):continue
        try:
            status,data,ms=await asyncio.to_thread(api,base,'/fetch_vms',relay=mode=='relay')
            vms=data.get('vm_list',[])
            emit(mode+'.fetch_vms',status=status,vm_count=len(vms),ms=ms,vm_fields=sorted(vms[0].keys()) if vms else [])
            if status!=200 or not vms:continue
            vm=next((v for v in vms if v.get('default')),vms[0])
            await session_test(mode,vm)
        except Exception as exc:emit(mode+'.error',error=type(exc).__name__)
    modes=['direct','relay'] if args.mode=='both' else [args.mode]
    rows={row['stage']:row for row in results}
    transport_ok=all(rows.get(mode+'.fetch_vms',{}).get('status')==200 and rows.get(mode+'.control',{}).get('upgrade_status')==101 and rows.get(mode+'.chat',{}).get('status')==200 and rows.get(mode+'.keepalive',{}).get('pong') for mode in modes)
    reply_ok=all(rows.get(mode+'.chat',{}).get('reply_matched') for mode in modes)
    audio_ok=all(any(row['stage']==mode+'.tts' and row.get('status')==200 and row.get('bytes',0)>0 for row in results) for mode in modes)
    emit('summary',transport_ok=transport_ok,expected_text_reply_ok=reply_ok,tts_audio_verified=audio_ok)
    args.report.write_text(json.dumps({'results':results},ensure_ascii=False,indent=2),encoding='utf8')
    return bool(transport_ok and (reply_ok if not(args.voice_note or args.voice_note_file) else True) and (audio_ok if args.voice_output else True))
raise SystemExit(0 if asyncio.run(main()) else 1)
