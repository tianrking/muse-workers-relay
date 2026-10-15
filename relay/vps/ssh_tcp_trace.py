import sys,json,paramiko
c=json.load(sys.stdin)
s=paramiko.SSHClient()
s.load_system_host_keys()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect(c['host'],port=22,username=c['user'],password=c['password'],timeout=15,auth_timeout=15,banner_timeout=15,look_for_keys=False,allow_agent=False)
for command in ["sudo timeout 20 tcpdump -i any -nn -tt -s 80 'host 163.179.121.186 and tcp port 443' -c 100"]:
 _,out,err=s.exec_command(command,timeout=25)
 print(command, '\n',out.read().decode(),err.read().decode())
s.close()
