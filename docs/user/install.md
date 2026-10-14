# Installing LineWise

Download the installer for your computer from the [download page](../index.md#download) or from
[GitHub Releases](https://github.com/gavenrobertson/linewise/releases). The first time you open it,
Windows or macOS will probably warn you about it. This page explains why, and how to open LineWise
safely.

## Why your computer warns you

LineWise is not code-signed yet. Signing attaches a verified publisher name to an installer, and
it isn't set up for the Windows and macOS builds yet. Without it, Windows and macOS can't tell who
made the file, so they ask you to confirm before running it.

The warning does **not** mean a virus was found. It says the publisher is unknown, the same
warning every unsigned app gets. Each release is built in public by
[GitHub Actions](https://github.com/gavenrobertson/linewise/actions) from the open source code, and
every installer has a published checksum, so you can check that your copy is the one that was
built.

Signed installers are planned. When they arrive, these warnings go away.

## Windows

You may see up to two warnings: one from your browser when the download finishes, and one from
Windows when you run the installer.

**In the browser.** Edge or Chrome may say the file _isn't commonly downloaded_ or is _uncommon_.
Open the downloads list, choose the file's **⋯** menu, then **Keep** (in Edge, then **Show more →
Keep anyway**).

**When you run the installer.** SmartScreen shows a blue _Windows protected your PC_ window:

1. Choose **More info**.
2. Check that the app name is the LineWise installer you downloaded.
3. Choose **Run anyway**.

Windows remembers your choice for that file. You won't see the warning again until you install a
new version.

## macOS

1. Open the `.dmg` and drag **LineWise** into **Applications**.
2. Open LineWise. macOS says it can't verify the app (_Apple could not verify "LineWise" is free of
   malware_). Choose **Done** (or **OK**), not **Move to Trash**.
3. Open **System Settings → Privacy & Security**, scroll down to **Security**, and choose
   **Open Anyway** next to the message about LineWise. Confirm with your password or Touch ID.
4. Open LineWise again and choose **Open**.

You only need to do this once per version.

::: tip Older macOS
Before macOS 15 (Sequoia), you can also Control-click LineWise in Applications, choose **Open**,
then choose **Open** again.
:::

If macOS instead says _"LineWise" is damaged and can't be opened_, the download has been marked as
quarantined. First [check the download](#check-the-download). If the checksum matches, open
**Terminal** and run:

```sh
xattr -dr com.apple.quarantine /Applications/LineWise.app
```

Then open LineWise normally.

## Check the download

Each release page has a `SHA256SUMS.txt` file that lists the SHA-256 hash of every installer.
Compute the hash of your file and compare it with the line for that file. If the two match, your
copy is exactly the file that was built.

On **Windows**, in PowerShell or Command Prompt:

```sh
certutil -hashfile LineWise_1.0.0_x64-setup.exe SHA256
```

On **macOS**, in Terminal:

```sh
shasum -a 256 LineWise_1.0.0_universal.dmg
```

Use the name of the file you downloaded. If the hashes don't match, delete the file and download it
again from GitHub Releases.

## When to stop

Stop and don't open the file if:

- **Microsoft Defender or your antivirus reports a named threat** (for example _Trojan:Win32/…_) or
  quarantines the file. That is a different warning from the unknown-publisher ones above.
- **The checksum doesn't match** `SHA256SUMS.txt`.
- **You got the file somewhere other** than the LineWise download page or GitHub Releases.

A detection in an unsigned app is usually a false positive, but don't guess. Report it on
[GitHub Issues](https://github.com/gavenrobertson/linewise/issues) with the file name, its hash and
the exact message, or privately as described in [SECURITY.md](../../SECURITY.md).
