"""Capture a bounded serial log without changing flash or serial control lines."""
import argparse
import time
from pathlib import Path
import serial

parser = argparse.ArgumentParser()
parser.add_argument("port")
parser.add_argument("--seconds", type=float, default=30)
parser.add_argument("--output", default="boot.log")
parser.add_argument("--reset", action="store_true", help="Reset the MCU after opening the port")
args = parser.parse_args()
port = serial.Serial(baudrate=115200, timeout=0.25)
port.dtr = False
port.rts = False
port.port = args.port
port.open()
if args.reset:
    from esptool.reset import HardReset
    HardReset(port, uses_usb=True)()
try:
    deadline = time.monotonic() + args.seconds
    with Path(args.output).open("wb") as output:
        while time.monotonic() < deadline:
            chunk = port.read(4096)
            if chunk:
                output.write(chunk)
                output.flush()
finally:
    port.close()
