---
name: zepp-simulator
description: Run this app on the Zepp OS simulator and capture the watch screen from a background process, including when the emulator window is hidden or covered. Use when asked to run the app, verify something on the emulator, or take screenshots of it.
---

# Running and capturing the simulator

## Pushing a build to a running emulator

The simulator must already be running with a device booted. Then, from the project
root:

```bash
printf '\n' | zeus dev -t "Amazfit Active 2 (Round)"
```

- The **exact** device name matters, parentheses included. A wrong name silently
  falls back to an arrow-key menu, and a piped newline picks whatever is first -
  which is how a round build once got pushed to a square emulator.
- Pipe a newline for the host prompt or it blocks. Do not pipe a long-running
  `zeus dev` through `tail`: it buffers and the output file stays empty.
- Run it in the background; it keeps watching for changes afterwards.
- Afterwards, restore what Zeus rewrote: `.gitignore` and sometimes `app.json`.

The device's own `console.log` goes to the simulator's `sim-debug.log`, not to the
`zeus dev` output. Two lines there prove the app actually launched:

```
current filepath: /app.js
current filepath: /page/index.js
```

If the device part never launches at all while the settings screen does, the
appId is not registered to the signed-in account - launching is cloud-mediated.

## Capturing the screen

`shot.ps1` in this directory captures the watch screen at device resolution. Three
things make the naive approach fail, and it handles all three:

- The emulator window can be **hidden**, not merely covered - it keeps a valid
  size and position while not being on screen. Enumerating only visible windows
  finds nothing, and reading the desktop at its coordinates returns whatever is
  there instead. So it enumerates every top-level window and matches the title.
- `Process.MainWindowHandle` is often zero for the QEMU window. Do not rely on it.
- A background process may not call `SetForegroundWindow`. It **may** call
  `ShowWindow(SW_SHOWNOACTIVATE)`, and `PrintWindow` with `PW_RENDERFULLCONTENT`
  renders the window without raising it.

```powershell
.\shot.ps1 -Out shot.png -Dev 466
```

`-Dev` is the device resolution (466 or 480). The result is that square, ready to
be turned into a store screenshot.

## Tapping

`tap.ps1` clicks a point in **watch** coordinates. Posting `WM_LBUTTONDOWN` to the
window does not work - QEMU does not take input that way and the click is silently
dropped - so it drives the real mouse, raising the window topmost without stealing
keyboard focus and approaching the target in two steps so the window sees motion
arriving rather than a teleport.

```powershell
.\tap.ps1 -X 233 -Y 315 -Dev 466 -KeepOnTop
```

**Taps are unreliable.** They land perhaps every other time and sometimes stop
landing altogether. Always verify the effect from a capture rather than assuming,
and loop with a check:

```powershell
for ($i = 1; $i -le 5; $i++) {
  .\tap.ps1 -X 233 -Y 315 -Dev 466 -KeepOnTop | Out-Null
  Start-Sleep -Milliseconds 1200
  .\shot.ps1 -Out probe.png -Dev 466 | Out-Null
  # sample a pixel that only changes once the tap landed, and break
}
```

Locate a button by scanning a column for its fill colour rather than guessing from
a rendered image; the guess is usually right and the tap is usually the problem.

If a sequence of taps is needed and they will not land, it is faster to ask the
person at the machine for the one tap that unblocks it than to keep retrying.
