# 🐧 Preparing Build ENV in Linux (Fedora) to build Windows Executables

> **Goal:** Build `.exe` and `.msi` files using Electron on Fedora.

### 1. 🍷 Install Wine & Mono

The specific `wine-mono` package is required for the WiX toolset (used for MSIs) to run.

```bash
sudo dnf install wine wine-mono
```

### 2. 🏛️ Install 32-bit Architecture Support

Wine needs 32-bit libraries to run the Windows compilers (`candle.exe` / `light.exe`).

```bash
sudo dnf install glibc-devel.i686 libgcc.i686 wine.i686 glibc.i686
```

### 3. 🧩 Install MinGW Dependencies

These packages contain the actual `.dll` files that Wine is missing.

```bash
sudo dnf install mingw32-libgcc mingw32-winpthreads
```

### 4. 🚀 Initialize Wine

Run this once to create the `~/.wine` directory. If prompted to install anything, say **Yes**.

```bash
winecfg
```

### 5. ➡️ Copy Missing DLLs to Wine (Crucial Step)

You must manually copy these two libraries into Wine's system folder, or the linker will crash.

```bash
cp /usr/i686-w64-mingw32/sys-root/mingw/bin/libgcc_s_dw2-1.dll ~/.wine/drive_c/windows/syswow64/
cp /usr/i686-w64-mingw32/sys-root/mingw/bin/libwinpthread-1.dll ~/.wine/drive_c/windows/syswow64/
```

### 6. 🧹 Clean Electron Cache

Ensure `electron-builder` downloads fresh copies of the build tools.

```bash
rm -rf ~/.cache/electron-builder/wix
```

### 7. ⚠️ Important Code Change (For MSI Only)

If building an **MSI**, Wine cannot handle standard compression. You **must** set compression to `store` in your `helpers/builder.js` or `package.json`:

```javascript
// For MSI
compression: 'store',
// If the build fails in docker because OOM, use:
compression: debug ? 'store' : 'normal',
```
