import serial,time,json
s=serial.Serial(baudrate=115200,timeout=.1);s.dtr=False;s.rts=False;s.port='COM3';s.open()
for cmd in ['wifi.ssid=Muse-PC','wifi.pass=12345678','wifi.connect']:
 s.write(('>'+cmd+'\n').encode());s.flush();time.sleep(.3)
end=time.time()+40
with open('hotspot-switch.log','w',encoding='utf8') as f:
 while time.time()<end:
  b=s.readline()
  if b:f.write(b.decode('utf8','replace'));f.flush()
s.write(b'>status\n');s.flush()
end=time.time()+3
while time.time()<end:
 l=s.readline().decode('utf8','replace')
 if l.startswith('@status '):
  d=json.loads(l[8:])['device'];print(json.dumps({'wifi':d['wifi'],'connection':d['hatch']['state'],'paired':d['link']['paired']}));break
s.close()
