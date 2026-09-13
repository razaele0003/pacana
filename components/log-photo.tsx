"use client";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const supportedPhotos = ["image/jpeg", "image/png", "image/webp"];

async function preparePhoto(
  image: CanvasImageSource,
  width: number,
  height: number,
) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const photo = canvas.toDataURL("image/jpeg", 0.75);
  if (photo.length > 1500000)
    throw new Error("This photo is too detailed. Try a smaller image.");
  return photo;
}

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stopCamera = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOpen(false);
  };
  useEffect(() => {
    if (cameraOpen && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {});
    }
  }, [cameraOpen]);
  useEffect(
    () => () => stream.current?.getTracks().forEach((track) => track.stop()),
    [],
  );
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera capture is not available here. Upload a photo instead.");
      return;
    }
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraOpen(true);
    } catch {
      setError(
        "Pacana could not open your camera. Allow camera access, then try again or upload a photo.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const capturePhoto = async () => {
    const feed = video.current;
    if (!feed || !feed.videoWidth || !feed.videoHeight) {
      setError("The camera is not ready yet. Try again in a moment.");
      return;
    }
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      onChange(await preparePhoto(feed, feed.videoWidth, feed.videoHeight));
      stopCamera();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not capture this photo.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    setError("");
    setBusy(true);
    onBusy(true);
    let url = "";
    try {
      if (!supportedPhotos.includes(file.type) || file.size > 15 * 1024 * 1024)
        throw new Error("Choose a JPG, PNG or WebP photo under 15 MB.");
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      onChange(await preparePhoto(image, image.width, image.height));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not read this photo.",
      );
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
      onBusy(false);
    }
  };
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
            disabled={busy || cameraOpen}
            onClick={() => onChange(undefined)}
          >
            <Trash2 size={16} /> Remove photo
          </button>
        </>
      )}
      {cameraOpen ? (
        <div className="camera-capture">
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="Camera preview"
          />
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={capturePhoto}
            >
              <Camera size={17} /> Capture photo
            </button>
            <button type="button" disabled={busy} onClick={stopCamera}>
              <X size={17} /> Cancel camera
            </button>
          </div>
        </div>
      ) : (
        <div className="photo-actions">
          <label className="photo-action">
            <ImagePlus size={17} /> {value ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void uploadPhoto(file);
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startCamera()}
          >
            <Camera size={17} /> Take photo
          </button>
        </div>
      )}
      <small>
        {busy
          ? "Preparing photo…"
          : "Upload a photo or take one with your camera. Photos are saved on this device and included in backups."}
      </small>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
