#!/usr/bin/env python3
"""Offline Muse Linux credential export for Mori; no network or service changes."""
import argparse
import json
import os
from pathlib import Path
import sys


def read_object(path):
    with path.open("r", encoding="utf-8") as stream:
        raw = stream.read(65537)
    if len(raw) > 65536:
        raise ValueError("Configuration exceeds 64 KiB")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Configuration must be a JSON object")
    return data


def credential(value, name, required=False):
    item = value.get(name, "")
    if not isinstance(item, str) or len(item) > 16000:
        raise ValueError("Invalid field: " + name)
    item = item.strip()
    if required and not item:
        raise ValueError("Missing field: " + name)
    return item


def export(state_dir, output):
    pairing = read_object(state_dir / "pairing.json")
    identity = read_object(state_dir / "identity.json")
    access = credential(pairing, "access_token", True)
    if access.startswith("mgst_"):
        raise ValueError("SDK token is not a device access token; pair first")
    result = {
        "credential_source": "linux",
        "access_token": access,
        "refresh_token": credential(pairing, "refresh_token", True),
        "device_id": credential(identity, "device_id", True),
    }
    username = credential(pairing, "username")
    if username:
        result["username"] = username
    # Exclusive creation: never overwrite an existing credential file or follow a symlink.
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(output, flags, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        # A sudo export remains readable by the invoking desktop user only.
        if hasattr(os, "geteuid") and os.geteuid() == 0 and os.environ.get("SUDO_UID"):
            os.chown(output, int(os.environ["SUDO_UID"]), int(os.environ["SUDO_GID"]))
    except BaseException:
        Path(output).unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", type=Path, default=Path("/var/lib/musegadget"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        export(args.state_dir, args.output)
    except (OSError, ValueError, KeyError) as error:
        # Do not echo JSON content or any credential value.
        print("Export failed: " + type(error).__name__ + ". Check pairing, file access and output path (must not exist).", file=sys.stderr)
        return 1
    print("Exported Mori configuration. Import it in Account settings; keep this file private.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
