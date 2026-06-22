"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AvatarUpload({
  bucketPath,
  currentUrl,
  onUploaded,
  previewClassName = "w-10 h-10 rounded-full object-cover",
  fallbackText = "?",
  buttonLabel = "Change photo",
}: {
  bucketPath: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  previewClassName?: string;
  fallbackText?: string;
  buttonLabel?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${bucketPath}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (uploadError) {
        setError("Upload failed.");
        return;
      }
      const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
      onUploaded(data.publicUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" className={previewClassName} />
      ) : (
        <div className={`bg-gray-100 text-gray-400 flex items-center justify-center text-xs ${previewClassName}`}>
          {fallbackText}
        </div>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="text-xs underline text-gray-500"
      >
        {uploading ? "Uploading..." : buttonLabel}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
