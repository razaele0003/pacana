"use client";
import { useState } from "react";

export function LogPhoto({
  value,
  onChange,
  onBusy,
}: {
  value?: string;
  onChange: (value?: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <fieldset className="log-photo">
      <legend>Photo of what you did (optional)</legend>
      {value && (
        <>
          <a href={value} target="_blank" rel="noreferrer">
            <img src={value} alt="Photo attached to this log" />
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange(undefined)}
          >
            Remove photo
          </button>
        </>
      )}
      <label className="field">
        {value ? "Replace photo" : "Add photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            setBusy(true);
            onBusy(true);
            let url = "";
            try {
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 15 * 1024 * 1024
              )
                throw new Error("Choose a JPG, PNG or WebP photo under 15 MB.");
              url = URL.createObjectURL(file);
              const img = new Image();
              img.src = url;
              await img.decode();
              const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
              const canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.round(img.width * scale));
              canvas.height = Math.max(1, Math.round(img.height * scale));
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Photo processing is unavailable.");
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const data = canvas.toDataURL("image/jpeg", 0.75);
              if (data.length > 1500000)
                throw new Error(
                  "This photo is too detailed. Try a smaller image.",
                );
              onChange(data);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not read this photo.",
              );
            } finally {
              if (url) URL.revokeObjectURL(url);
              setBusy(false);
              onBusy(false);
            }
          }}
        />
      </label>
      <small>
        {busy
          ? "Preparing photo…"
          : "Saved on this device and included in backups. Photos are resized to save space."}
      </small>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
