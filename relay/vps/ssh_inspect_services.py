import sys,json,paramiko
c=json.load(sys.stdin)
s=paramiko.SSHClient()
s.load_system_host_keys()
s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect(c['host'],port=22,username=c['user'],password=c['password'],timeout=15,auth_timeout=15,banner_timeout=15,look_for_keys=False,allow_agent=False)
for command in ["sudo ss -lntp","ls -l /etc/nginx/sites-enabled","node --version; command -v certbot","getent ahostsv4 aws.w0x7ce.eu","curl -fsS --max-time 10 https://checkip.amazonaws.com","sudo nginx -T 2>/dev/null | python3 -c \"import sys; print(''.join(x for x in sys.stdin if any(k in x for k in ['server_name','ssl_certificate ' ,'proxy_pass','location ','# configuration file'])))\""]:
 _,out,err=s.exec_command(command,timeout=15)
 print(command, '\n',out.read().decode(),err.read().decode())
s.close()
