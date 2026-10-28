"""Choose an installed iPhone simulator; never download or use a physical device."""
import json
import os
import pathlib
import plistlib
import re
import subprocess

out = pathlib.Path("safari-results")
out.mkdir(exist_ok=True)
if os.environ.get("QA_PLATFORM") == "ios":
    candidates = list(pathlib.Path("/Applications").glob("Xcode_[0-9]*.app"))
    if candidates:
        preferred = pathlib.Path("/Applications/Xcode_16.4.app")
        newest = (preferred if os.environ.get("QA_IOS_RUNTIME") == "18.5" and preferred.exists()
                  else max(candidates, key=lambda p: tuple(map(int, re.findall(r"\d+", p.name))))).resolve()
        developer = str(newest / "Contents/Developer")
        os.environ["DEVELOPER_DIR"] = developer
        subprocess.run(["sudo", "xcode-select", "--switch", str(newest)], check=True)
        with open(os.environ["GITHUB_ENV"], "a") as env:
            env.write(f"DEVELOPER_DIR={developer}\n")
    subprocess.run(["xcodebuild", "-version"], check=True)
    subprocess.run(["xcode-select", "--print-path"], check=True)
    subprocess.run(["env", "-u", "DEVELOPER_DIR", "xcode-select", "--print-path"], check=True)
    simulator = pathlib.Path(os.environ["DEVELOPER_DIR"]) / "Applications/Simulator.app"
    register = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
    subprocess.run([register, "-f", str(newest)], check=True)
    subprocess.run([register, "-f", str(simulator)], check=True)
    with (simulator / "Contents/Info.plist").open("rb") as info:
        simulator_bundle = plistlib.load(info)["CFBundleIdentifier"]
    print("Registered simulator:", simulator, simulator_bundle, flush=True)
    raw = subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"])
    devices = json.loads(raw)["devices"]
    (out / "available-simulators.json").write_bytes(raw)
    choices = []
    for runtime, entries in devices.items():
        if ".iOS-" not in runtime:
            continue
        version = tuple(map(int, re.findall(r"\d+", runtime.split(".iOS-")[1])))
        requested = os.environ.get("QA_IOS_RUNTIME")
        if requested and version != tuple(map(int, requested.split("."))):
            continue
        for device in entries:
            if device.get("isAvailable") and device["name"].startswith("iPhone"):
                choices.append((version, device["name"] == "iPhone 16", device["name"], runtime, device))
    if not choices:
        raise RuntimeError("No installed iPhone simulator is available")
    _, _, _, runtime, device = max(choices, key=lambda item: item[:3])
    selected = {"runtime": runtime, **device}
    (out / "selected-simulator.json").write_text(json.dumps(selected, indent=2))
    print("Selected simulator:", json.dumps(selected), flush=True)
    if device["state"] != "Booted":
        subprocess.run(["xcrun", "simctl", "boot", device["udid"]], check=True)
    subprocess.run(["xcrun", "simctl", "bootstatus", device["udid"], "-b"], check=True, timeout=360)
    subprocess.run(["open", "-b", simulator_bundle, "--args", "-CurrentDeviceUDID", device["udid"]], check=True)
    subprocess.run(["xcrun", "simctl", "launch", device["udid"], "com.apple.mobilesafari"], check=True, timeout=90)
