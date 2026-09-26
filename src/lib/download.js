// Attaches the link before clicking (some browsers need this for a reliable
// programmatic download) and delays revoking the object URL until after the
// browser has had time to actually start reading the blob, rather than
// revoking it the instant .click() returns. Skipping either step is a known
// way to end up with a truncated or unplayable file, especially for larger
// blobs like rendered audio.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
