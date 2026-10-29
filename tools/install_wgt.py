"""Installs a signed .wgt on a Samsung TV in Developer Mode, over sdb (adb protocol, port 26101).

The TV only accepts sdb from the "Host PC IP" set in its Developer Mode popup, so set it to
this computer's IP (and reboot the TV) before running; set it back to 127.0.0.1 afterwards
for TizenBrew.

  install_wgt.py TV_IP FILE.wgt PACKAGE_ID
"""
import os
import sys

sys.path.insert(0, os.path.expanduser("~/tvctl-lib"))
from adb_shell.adb_device import AdbDeviceTcp  # noqa: E402

REMOTE_DIR = "/home/owner/share/tmp/sdk_tools"


def main():
    ip, wgt, package_id = sys.argv[1:4]
    dev = AdbDeviceTcp(ip, 26101, default_transport_timeout_s=30)
    dev.connect(auth_timeout_s=5)
    print("connecte a", ip)
    remote = "%s/%s" % (REMOTE_DIR, os.path.basename(wgt))
    dev.push(wgt, remote)
    print("envoye", remote)
    # vd_appinstall wraps wascmd on Samsung TVs; the leading 0 is the sdb shell user flag TizenBrew's installer uses too.
    out = dev.shell("0 vd_appinstall %s %s" % (package_id, remote), timeout_s=120)
    print(out)
    dev.close()
    return 0 if "fail" not in out.lower() else 1


if __name__ == "__main__":
    sys.exit(main())
