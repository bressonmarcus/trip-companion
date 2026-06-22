"use client";

export default function Avatar({
  url,
  name,
  size = 28,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="rounded-full object-cover" style={style} />;
  }
  return (
    <div
      className="rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-medium"
      style={style}
    >
      {initial}
    </div>
  );
}
