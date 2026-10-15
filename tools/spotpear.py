"""Build/flash the Spotpear V1 profile with installed IDF 6.1 and redacted output."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["configure", "build", "flash", "monitor", "size"], default="build", nargs="?")
parser.add_argument("--port", default="COM3")
args = parser.parse_args()
install = json.loads(Path("C:/Espressif/tools/eim_idf.json").read_text())
idf = next((item for item in install["idfInstalled"] if item["name"] == "v6.1"), None)
if idf is None:
    raise SystemExit("System ESP-IDF 6.1 installation not found")
version = (Path(idf["path"]) / "tools/cmake/version.cmake").read_text()
if not re.search(r"IDF_VERSION_MAJOR 6", version) or not re.search(r"IDF_VERSION_MINOR 1", version):
    raise SystemExit("This profile requires ESP-IDF 6.1")
token_file = ROOT / "secrets/sdk-token.txt"
token = token_file.read_text().strip() if token_file.exists() else ""
if not re.fullmatch(r"mgst_[A-Za-z0-9_-]{43}", token):
    raise SystemExit("Save a valid SDK token in secrets/sdk-token.txt")
secret_config = ROOT / "secrets/sdkconfig.token"
secret_text = "CONFIG_GADGET_SDK_TOKEN=" + json.dumps(token) + "\n"
if not secret_config.exists() or secret_config.read_text() != secret_text:
    secret_config.write_text(secret_text)
config = ROOT / "build-spotpear/sdkconfig"
if config.exists():
    text = config.read_text()
    line = "CONFIG_GADGET_SDK_TOKEN=" + json.dumps(token)
    text = re.sub(r"^CONFIG_GADGET_SDK_TOKEN=.*$", lambda _: line, text, flags=re.M)
    if config.read_text() != text:
        config.write_text(text)
profile = Path(idf["activationScript"]).read_text(encoding="utf-8-sig")
paths = re.search(r'\$env:PATH = "([^"\r\n]+)', profile).group(1)
env = dict(os.environ)
env.setdefault("PROCESSOR_ARCHITECTURE", "AMD64")
env.setdefault("OS", "Windows_NT")
env["PATH"] = paths.replace(";$env:PATH", ";" + env.get("PATH", ""))
env.update(IDF_PATH=idf["path"], IDF_TOOLS_PATH=idf["idfToolsPath"],
           IDF_PYTHON_ENV_PATH=str(Path(idf["python"]).parent.parent),
           ESP_IDF_VERSION="6.1", PYTHONUTF8="1")
for key, value in re.findall(r'"(ESP_ROM_ELF_DIR|OPENOCD_SCRIPTS)" = "([^"\r\n]+)"', profile):
    env[key] = value
command = [idf["python"], str(Path(idf["path"]) / "tools/idf.py"), "-B", "build-spotpear",
           "-DIDF_TARGET=esp32s3",
           "-DSDKCONFIG_DEFAULTS=sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-spotpear-s3-180-v1;secrets/sdkconfig.token"]
if args.action in ("flash", "monitor"):
    command.extend(["-p", args.port])
command.append("reconfigure" if args.action == "configure" else args.action)
process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
for line in process.stdout:
    sys.stdout.write(re.sub(r"mgst_[A-Za-z0-9_-]+", "[SDK_TOKEN_REDACTED]", line))
    sys.stdout.flush()
raise SystemExit(process.wait())
