"""Bounded Wi-Fi route test. Reads credentials on stdin; never prints them."""
import argparse,json,re,serial,sys,time
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',default='COM3');p.add_argument('--seconds',type=int,default=75);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
network=json.load(sys.stdin)
for field in ('ssid','password'):
 if any(c in network.get(field,'') for c in '\r\n'):raise SystemExit('Invalid network field')
s=serial.Serial(baudrate=115200,timeout=.1);s.dtr=False;s.rts=False;s.port=a.port;s.open()
for cmd in ('wifi.ssid='+network['ssid'],'wifi.pass='+network.get('password',''),'wifi.connect'):
 s.write(('>'+cmd+'\n').encode());s.flush();time.sleep(.3)
end=time.monotonic()+a.seconds;next_status=0;statuses=[];probe_sent=False
with a.output.open('w',encoding='utf8') as log:
 while time.monotonic()<end:
  now=time.monotonic()
  if now>=next_status:s.write(b'>status\n');s.flush();next_status=now+5
  line=s.readline().decode('utf8','replace');line=re.sub(r'mgst_[A-Za-z0-9_-]+','[redacted]',line)
  if line:log.write(line);log.flush()
  if line.startswith('@status '):
   try:
    d=json.loads(line[8:])['device'];row={'wifi':d['wifi'],'state':d['hatch']['state'],'host':d['hatch']['host'],'paired':d['link']['paired']};statuses.append(row)
    if d['wifi']['state']=='connected' and not probe_sent:s.write(b'>spotpear.net\n');s.flush();probe_sent=True
   except (KeyError,ValueError):pass
s.close()
print(json.dumps({'requested_ssid':network['ssid'],'last':statuses[-1] if statuses else None,'samples':len(statuses)},ensure_ascii=False))
