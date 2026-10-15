import sys,json,paramiko
c=json.load(sys.stdin)
s=paramiko.SSHClient()
s.load_system_host_keys()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect(c['host'],port=22,username=c['user'],password=c['password'],timeout=15,auth_timeout=15,banner_timeout=15,look_for_keys=False,allow_agent=False)
for command in ["sudo python3 -c \"from pathlib import Path; p=Path('/var/log/nginx/error.log'); print(''.join(x for x in p.read_text().splitlines()[-400:] if 'SSL' in x or 'handshak' in x)[-8000:])\"","command -v tcpdump","sudo ss -ntp state established '( sport = :443 )'"]:
 _,out,err=s.exec_command(command,timeout=15)
 print(command, '\n',out.read().decode(),err.read().decode())
s.close()
