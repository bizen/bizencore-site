(() => {
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const host = 'https://github.com/bizen/bizencore-os/releases/download/';
  const checkedRelease = value => {
    if (!value || value.published !== true || value.channel !== 'production' || value.platform !== 'darwin' ||
      value.arch !== 'arm64' || value.updateMethod !== 'manual' || !versionPattern.test(value.version) ||
      !/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.size) || value.size <= 0 ||
      value.developerIdSigned !== false || value.notarized !== false || value.adHocSigned !== true ||
      !/^[a-f0-9]{40}$/.test(value.sourceCommit)) return null;
    const prefix = `${host}desktop-v${value.version}/`;
    if (value.downloadUrl !== `${prefix}bizencore-terminal-${value.version}-darwin-arm64.zip` ||
      value.checksumUrl !== `${prefix}SHA256SUMS` ||
      value.notesUrl !== `https://github.com/bizen/bizencore-os/releases/tag/desktop-v${value.version}`) return null;
    return value;
  };
  const getRelease = async () => {
    const response = await fetch(new URL('./desktop/latest.json', location.href), { credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const length = Number(response.headers.get('content-length'));
    if (length > 16_384) return null;
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 16_384) return null;
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return checkedRelease(JSON.parse(new TextDecoder().decode(body)));
  };
  getRelease().then(release => {
    if (!release) return;
    const download = document.getElementById('download');
    download.href = release.downloadUrl;
    download.setAttribute('aria-disabled', 'false');
    document.getElementById('download-label').textContent = 'macOS版をダウンロード';
    document.getElementById('release-status').textContent = `v${release.version} β · ${(release.size / 1_000_000).toFixed(1)} MB · Apple Silicon`;
    document.getElementById('release-detail').hidden = false;
    document.getElementById('release-version').textContent = `v${release.version} / 手動更新 / Apple未公証`;
    document.getElementById('checksums').href = release.checksumUrl;
    document.getElementById('release-notes').href = release.notesUrl;
    document.getElementById('checksum').textContent = `SHA-256 ${release.sha256}`;
  }).catch(() => { /* Missing, unpublished and unreachable releases never enable a download. */ });
})();
