---
name: zepp-store-assets
description: Produce the screenshots and icon the Zepp App Store accepts, and fill in the submission form. Use when preparing a store submission, fixing a rejected one, or asked to make screenshots suitable for Amazfit.
---

# Zepp store assets

## What the store demands

From the Zepp documentation, and from a rejection this app actually received:

- **Screenshots**: 360x360 PNG, 1 to 10 of them. "The background of screenshots
  should be transparent and not have a fill color." For a round device the picture
  is centred with no margins around it.
- **Icon**: 240x240 PNG, "a circular image with a transparent background, ensuring
  no padding around it".

The rejection was worded **"Please remove the four corners of the preview image"**
and it meant the screenshots, not the icon. A capture taken from the emulator
carries that device's backdrop in the corners, which is exactly the fill colour the
reviewer refuses.

## Producing them

Capture at device resolution with the `zepp-simulator` skill, scale to 360x360,
then clear the corners with `mask-store.ps1` in this directory:

```powershell
.\mask-store.ps1 -Path store-screenshot-1-start-360.png -Shape round
```

- `-Shape round` keeps the inscribed disc and clears everything outside it.
- `-Shape portrait` is for a square device, whose screen is a portrait rectangle
  centred with equal margins; the band comes from `-DeviceWidth`/`-DeviceHeight`
  (390x450) rather than from scanning, because a scan cannot tell the app's own
  black background from the black backdrop around it.

It keeps the untouched original in an `unmasked/` folder beside the file, and
refuses to cut when the corners are not flat backdrop - a wrong shape would eat
the picture.

Verify afterwards: all four corners at alpha 0, the disc edges still opaque.

## Filling in the form

Field-by-field values live in `tmp/store/` (git-ignored) as `ZEPP_FORM.md`, kept
current with the shipped version. The parts that catch people out:

- **App Classification** is `Games`, **Service Category** is `Common`.
- **Privacy Statement** is a free-text field, **not** a URL. Nothing needs hosting.
- **Call Permission** is `None`: the app declares only `data:os.device.info` and
  `device:os.local_storage`, and nothing on that list applies.
- **Includes SDK** is `No` - there are no runtime dependencies at all.
- Limits: App Name 30, App Introduction 40, App Details 600, New Version
  Introduction 200. Count them before pasting; the form truncates silently.
- Adding a listing language opens a second block that must be filled in full,
  screenshots included. An empty block is a rejection.
- **Version No.** and **Supported Devices** fill themselves once the `.zab` is
  uploaded.

Resubmitting costs one of six weekly review attempts, so check the whole form
before pressing Submit rather than after.

## Keep the screenshots honest

They must match the version being submitted. After a change to the interface the
old screenshots are grounds for rejection on their own - the reviewer compares
them with the app.
