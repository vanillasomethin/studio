#!/usr/bin/env python3
"""Per-store NVS provisioning for the RuView (WiFi CSI) ESP32-S3 node.

Writes the substitution values referenced by ruview-store.cfg into the
device's NVS partition over serial, using esptool's NVS partition tooling.
This is what makes "one firmware image, many stores" possible — the
compiled image never changes, only the NVS blob does.

Usage:
    python3 provision.py \\
        --port /dev/ttyUSB0 \\
        --store-id store_mangaluru_001 \\
        --wifi-ssid "Kirana-Store-WiFi" \\
        --wifi-password "..." \\
        --mqtt-host "abc123.s1.eu.hivemq.cloud" \\
        --mqtt-username "alive-footfall-worker" \\
        --mqtt-password "..." \\
        --ota-password "..."

Requires: pip install esptool nvs_partition_gen (bundled with ESP-IDF).
"""

import argparse
import csv
import subprocess
import sys
import tempfile
from pathlib import Path

NVS_NAMESPACE = "ruview_cfg"

# Maps CLI args -> NVS key (must match the keys the RuView firmware reads
# at boot — see ruview-store.cfg for the corresponding ${...} placeholders).
NVS_KEYS = {
    "store_id":      "store_id",
    "wifi_ssid":      "wifi_ssid",
    "wifi_password":  "wifi_pass",
    "mqtt_host":      "mqtt_host",
    "mqtt_username":  "mqtt_user",
    "mqtt_password":  "mqtt_pass",
    "ota_password":   "ota_pass",
}


def build_csv(args, out_path: Path) -> None:
    rows = [("key", "type", "encoding", "value"), (NVS_NAMESPACE, "namespace", "", "")]
    for arg_name, nvs_key in NVS_KEYS.items():
        rows.append((nvs_key, "data", "string", getattr(args, arg_name)))

    # Derived MQTT topics — written so firmware doesn't need to do string
    # substitution itself.
    store_id = args.store_id
    derived = {
        "topic_flow":   f"alive/{store_id}/retail/customer_flow",
        "topic_shelf":  f"alive/{store_id}/retail/shelf_interaction",
        "topic_queue":  f"alive/{store_id}/retail/queue",
        "topic_hb":     f"alive/{store_id}/device/ruview_heartbeat",
        "node_id":      f"{store_id}_ruview",
    }
    for key, value in derived.items():
        rows.append((key, "data", "string", value))

    with out_path.open("w", newline="") as f:
        csv.writer(f).writerows(rows)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", required=True, help="Serial port, e.g. /dev/ttyUSB0")
    p.add_argument("--store-id", required=True)
    p.add_argument("--wifi-ssid", required=True)
    p.add_argument("--wifi-password", required=True)
    p.add_argument("--mqtt-host", required=True)
    p.add_argument("--mqtt-username", required=True)
    p.add_argument("--mqtt-password", required=True)
    p.add_argument("--ota-password", required=True)
    p.add_argument("--nvs-offset", default="0x9000", help="NVS partition offset (default 0x9000)")
    p.add_argument("--nvs-size", default="0x6000", help="NVS partition size (default 0x6000)")
    args = p.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        csv_path = Path(tmp) / "nvs.csv"
        bin_path = Path(tmp) / "nvs.bin"
        build_csv(args, csv_path)

        print(f"[provision] generating NVS partition for store_id={args.store_id}")
        subprocess.run(
            [
                "python3", "-m", "nvs_partition_gen", "generate",
                str(csv_path), str(bin_path), args.nvs_size,
            ],
            check=True,
        )

        print(f"[provision] flashing NVS partition to {args.port} @ {args.nvs_offset}")
        subprocess.run(
            [
                "esptool.py", "--port", args.port, "write_flash",
                args.nvs_offset, str(bin_path),
            ],
            check=True,
        )

    print(f"[provision] done — {args.store_id} provisioned. Reset the board to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
