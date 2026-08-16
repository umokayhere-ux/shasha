"use client";

import { useRef, useState } from "react";

const MAX_EDGE = 192;

/**
 * Downscales the chosen image in the browser before upload.
 *
 * A phone camera roll PNG can be several megabytes; stored inline that would be
 * loaded by every catalogue query. Resizing to a small square first keeps the
 * stored value to a few KB and avoids the server-side size limit entirely.
 */
async function toResizedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process this image");
  ctx.drawImage(bitmap, 0, 0, width, height);

  // PNG keeps transparency, which most network marks rely on.
  return canvas.toDataURL("image/png");
}

export function LogoUploader({
  networkId,
  networkName,
  currentLogo,
}: {
  networkId: string;
  networkName: string;
  currentLogo: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(currentLogo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/networks/${networkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: value }),
    });
    const json = await res.json();
    setBusy(false);

    if (!json.ok) {
      const details = json.details as Record<string, string[]> | undefined;
      setError(details ? (Object.values(details)[0]?.[0] ?? json.error) : json.error);
      return;
    }
    setLogo(json.data.logoUrl);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      setError("Choose a PNG, JPEG or WebP image.");
      return;
    }
    try {
      setBusy(true);
      const dataUrl = await toResizedDataUrl(file);
      await save(dataUrl);
    } catch {
      setBusy(false);
      setError("Could not read that image. Try another file.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URIs are not routed through the image optimizer
          <img src={logo} alt={`${networkName} logo`} className="h-full w-full object-contain" />
        ) : (
          <span className="muted text-[10px] font-bold">none</span>
        )}
      </span>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPick}
          className="hidden"
          id={`logo-${networkId}`}
        />
        <div className="flex gap-2">
          <label
            htmlFor={`logo-${networkId}`}
            className="btn-ghost !min-h-9 cursor-pointer !px-3 !text-xs"
          >
            {busy ? "Saving…" : logo ? "Replace" : "Upload"}
          </label>
          {logo && (
            <button
              onClick={() => save("")}
              disabled={busy}
              className="btn-ghost !min-h-9 !px-3 !text-xs"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
