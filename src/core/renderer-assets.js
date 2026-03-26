function normalizeBundledAssetPath(relativePath) {
  const normalizedPath = String(relativePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  if (!normalizedPath) {
    throw new Error("Bundled asset path is required");
  }

  return normalizedPath;
}

export function toArrayBuffer(binaryPayload) {
  if (binaryPayload instanceof ArrayBuffer) {
    return binaryPayload;
  }

  if (ArrayBuffer.isView(binaryPayload)) {
    return binaryPayload.buffer.slice(
      binaryPayload.byteOffset,
      binaryPayload.byteOffset + binaryPayload.byteLength
    );
  }

  if (binaryPayload?.type === "Buffer" && Array.isArray(binaryPayload.data)) {
    return new Uint8Array(binaryPayload.data).buffer;
  }

  return null;
}

export async function readBundledAssetArrayBuffer(relativePath) {
  if (typeof window.vela?.readBundledAsset !== "function") {
    throw new Error("Bundled asset bridge unavailable");
  }

  const payload = await window.vela.readBundledAsset(
    normalizeBundledAssetPath(relativePath)
  );
  const arrayBuffer = toArrayBuffer(payload);

  if (!arrayBuffer) {
    throw new Error("Unsupported bundled asset payload");
  }

  return arrayBuffer;
}

export async function createBundledAssetObjectUrl(relativePath, mimeType) {
  const arrayBuffer = await readBundledAssetArrayBuffer(relativePath);
  return URL.createObjectURL(
    new Blob([arrayBuffer], {
      type: mimeType || "application/octet-stream"
    })
  );
}

export function resolveRendererAssetUrl(relativePath) {
  return new URL(
    normalizeBundledAssetPath(relativePath),
    window.location.href
  ).href;
}

export function resolveRendererAssetDirectoryUrl(relativePath) {
  const assetUrl = resolveRendererAssetUrl(relativePath);
  return assetUrl.slice(0, assetUrl.lastIndexOf("/") + 1);
}
