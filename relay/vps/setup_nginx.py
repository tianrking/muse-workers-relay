from pathlib import Path
import subprocess,time,shutil
p=Path('/etc/nginx/sites-available/nanomuse')
s=p.read_text()
i=s.rfind('\nserver {')
b=s[i:]
assert 'server_name aws.w0x7ce.eu;' in b and 'listen 443' in b
old='    return 301 https://nanomuse.w0x7ce.eu$request_uri;'
assert b.count(old)==1 and 'muse-gadget-relay.inc' not in b
backup=p.with_name(p.name+'.before-muse-relay-'+str(int(time.time())))
shutil.copy2(p,backup)
shutil.copy2('/home/ubuntu/nginx-muse-relay.inc','/etc/nginx/muse-gadget-relay.inc')
b=b.replace(old,'    include /etc/nginx/muse-gadget-relay.inc;\n    location / { return 301 https://nanomuse.w0x7ce.eu$request_uri; }')
p.write_text(s[:i]+b)
r=subprocess.run(['nginx','-t'],capture_output=True,text=True)
print(r.stdout,r.stderr)
if r.returncode:
 shutil.copy2(backup,p)
 raise SystemExit(r.returncode)
subprocess.run(['systemctl','reload','nginx'],check=True)
print('Relay routes installed. Backup:',backup)
