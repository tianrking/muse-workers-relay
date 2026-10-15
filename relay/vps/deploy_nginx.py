import sys,json,paramiko
from pathlib import Path
c=json.load(sys.stdin)
s=paramiko.SSHClient();s.load_system_host_keys();s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect(c['host'],username=c['user'],password=c['password'],timeout=15,auth_timeout=15,look_for_keys=False,allow_agent=False)
f=s.open_sftp()
f.put('relay/vps/nginx-relay.inc','/home/ubuntu/nginx-muse-relay.inc')
f.put('relay/vps/setup_nginx.py','/home/ubuntu/setup_muse_relay.py')
f.close()
for command in ['sudo python3 /home/ubuntu/setup_muse_relay.py','curl -sS --max-time 20 https://aws.w0x7ce.eu/health','curl -sS -o /dev/null -w "%{http_code}" --max-time 15 https://aws.w0x7ce.eu/','curl -sS -o /dev/null -w "%{http_code}" --max-time 15 https://aws.w0x7ce.eu/fetch_vms']:
 _,out,err=s.exec_command(command,timeout=25)
 print(out.read().decode(),err.read().decode())
 if out.channel.recv_exit_status()!=0: raise SystemExit(1)
s.close()
