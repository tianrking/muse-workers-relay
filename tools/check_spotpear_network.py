"""Run the on-device read-only relay HTTPS check through the official Muse console."""
import argparse
from pathlib import Path
import re
import time
import serial
parser=argparse.ArgumentParser()
parser.add_argument("--port",default="COM3")
parser.add_argument("--output",default="relay-network-check.log")
args=parser.parse_args()
port=serial.Serial(baudrate=115200,timeout=0.1)
port.dtr=False;port.rts=False;port.port=args.port;port.open()
try:
    time.sleep(0.3);port.reset_input_buffer()
    # USB console may expose boot output; wait for actual DHCP readiness.
    import json
    ready_deadline=time.monotonic()+25
    incoming=bytearray()
    ready=False
    while time.monotonic()<ready_deadline and not ready:
        port.write(b"\n>status\n");port.flush()
        until=time.monotonic()+2
        while time.monotonic()<until:
            incoming.extend(port.read(4096))
            while b"\n" in incoming:
                line,_,incoming=incoming.partition(b"\n")
                marker=line.find(b"@status ")
                if marker>=0:
                    try:
                        state=json.loads(line[marker+8:])
                        ready=state["device"]["wifi"]["state"]=="connected"
                    except (ValueError,KeyError): pass
        if ready: print("Wi-Fi DHCP ready")
    if not ready: raise SystemExit("Wi-Fi not ready; connect the board first")
    port.write(b"\n>spotpear.net\n");port.flush()
    deadline=time.monotonic()+60;data=bytearray()
    while time.monotonic()<deadline:
        data.extend(port.read(4096))
    text=re.sub(r"mgst_[A-Za-z0-9_-]+","[SDK_TOKEN_REDACTED]",data.decode("utf-8","replace"))
    Path(args.output).write_text(text,encoding="utf-8")
    lines=[line for line in text.splitlines() if "spotpear_net" in line or "esp-tls" in line or "crt-bundle" in line]
    print("\n".join(lines) if lines else "No benchmark result; inspect output log")
    raise SystemExit(0 if any("health=200 result=ESP_OK" in line for line in lines) else 1)
finally:
    port.close()
