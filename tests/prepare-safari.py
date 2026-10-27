"""Choose an installed iPhone simulator; never download or use a physical device."""
import json
import os
import pathlib
import re
import subprocess

out = pathlib.Path("safari-results")
out.mkdir(exist_ok=True)
if os.environ.get("QA_PLATFORM") == "ios":
    candidates = list(pathlib.Path("/Applications").glob("Xcode_[0-9]*.app"))
    if candidates:
        newest = max(candidates, key=lambda p: tuple(map(int, re.findall(r"\d+", p.name))))
        developer = str(newest / "Contents/Developer")
        os.environ["DEVELOPER_DIR"] = developer
        with open(os.environ["GITHUB_ENV"], "a") as env:
            env.write(f"DEVELOPER_DIR={developer}\n")
    subprocess.run(["xcodebuild", "-version"], check=True)
    raw = subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"])
    devices = json.loads(raw)["devices"]
    (out / "available-simulators.json").write_bytes(raw)
    choices = []
    for runtime, entries in devices.items():
        if ".iOS-" not in runtime:
            continue
        version = tuple(map(int, re.findall(r"\d+", runtime.split(".iOS-")[1])))
        for device in entries:
            if device.get("isAvailable") and device["name"].startswith("iPhone"):
                choices.append((version, "Pro Max" not in device["name"], device["name"], runtime, device))
    if not choices:
        raise RuntimeError("No installed iPhone simulator is available")
    _, _, _, runtime, device = max(choices, key=lambda item: item[:3])
    selected = {"runtime": runtime, **device}
    (out / "selected-simulator.json").write_text(json.dumps(selected, indent=2))
    print("Selected simulator:", json.dumps(selected), flush=True)
    if device["state"] != "Booted":
        subprocess.run(["xcrun", "simctl", "boot", device["udid"]], check=True)
    subprocess.run(["xcrun", "simctl", "bootstatus", device["udid"], "-b"], check=True, timeout=360)
