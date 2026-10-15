"""Select the local Muse transport backend without printing credentials."""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('mode', choices=['direct', 'relay'])
p.add_argument('--host', default='muse.w0x7ce.eu')
a = p.parse_args()
if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?', a.host):
    p.error('host must be a DNS hostname without scheme, path or port')
key_file = ROOT / 'secrets/relay-key.txt'
key = key_file.read_text().strip() if key_file.exists() else ''
if a.mode == 'relay' and not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', key):
    p.error('save the matching Worker secret in secrets/relay-key.txt first')
if key and not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', key):
    p.error('invalid local relay secret format')
lines = ['#pragma once', '#define MUSE_RELAY_HOST "' + a.host + '"', '#define MUSE_RELAY_KEY "' + key + '"']
if a.mode == 'direct':
    lines.append('#define MUSE_RELAY_DIRECT 1')
path = ROOT / 'secrets/muse-relay.h'
path.parent.mkdir(exist_ok=True)
path.write_text('\n'.join(lines) + '\n', encoding='utf8')
print('Selected ' + a.mode + (' via ' + a.host if a.mode == 'relay' else ' official Muse servers') + '; build/flash with tools/spotpear.py to apply.')
