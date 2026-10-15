"""Run the on-device eight-slide benchmark through the official Muse console."""
import argparse
from pathlib import Path
import re
import time
import serial
parser=argparse.ArgumentParser()
parser.add_argument("--port",default="COM3")
parser.add_argument("--output",default="swipe-benchmark.log")
args=parser.parse_args()
port=serial.Serial(baudrate=115200,timeout=0.1)
port.dtr=False;port.rts=False;port.port=args.port;port.open()
try:
    time.sleep(0.3);port.reset_input_buffer()
    port.write(b"\n>spotpear.bench\n");port.flush()
    deadline=time.monotonic()+12;data=bytearray()
    while time.monotonic()<deadline:
        data.extend(port.read(4096))
    text=re.sub(r"mgst_[A-Za-z0-9_-]+","[SDK_TOKEN_REDACTED]",data.decode("utf-8","replace"))
    Path(args.output).write_text(text,encoding="utf-8")
    lines=[line for line in text.splitlines() if "spotpear_perf" in line]
    print("\n".join(lines) if lines else "No benchmark result; inspect output log")
    raise SystemExit(0 if any("swipe frames=" in line for line in lines) else 1)
finally:
    port.close()
