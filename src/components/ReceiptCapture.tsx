"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ScanResult = {
  merchant: string | null;
  date: string | null;
  total: number | null;
  items: { name: string; price: number }[];
  itemsSum: number;
  mismatch: boolean;
  mismatchDiff: number;
  imageUrl: string | null;
};

export default function ReceiptCapture({
  tripId,
  onScanned,
}: {
  tripId: string;
  onScanned: (result: ScanResult) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const [scanRes, imageUrl] = await Promise.all([
        fetch("/api/receipts/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        }).then((res) => res.json().then((json) => ({ ok: res.ok, json }))),
        uploadReceiptImage(tripId, file),
      ]);
      if (!scanRes.ok) {
        setError(scanRes.json.error ?? "Could not read this receipt.");
        return;
      }
      onScanned({ ...scanRes.json, imageUrl });
    } catch {
      setError("Something went wrong reading the receipt.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="bg-black text-white rounded py-3 disabled:opacity-50"
      >
        {loading ? "Reading receipt..." : "Scan a receipt"}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(",");
      resolve({ base64, mediaType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadReceiptImage(tripId: string, file: File): Promise<string | null> {
  try {
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${tripId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, {
      contentType: file.type || "image/jpeg",
    });
    if (error) {
      console.error("Receipt image upload failed:", error.message);
      return null;
    }
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Receipt image upload failed:", err);
    return null;
  }
}
