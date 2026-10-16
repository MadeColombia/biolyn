// A picture from another server (like a profile photo in Supabase
// storage) as a data URL, for pictures we draw on the server. A slow or
// missing picture gives null instead of breaking the whole picture.
export async function pictureDataUrl(
  url: string | null,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpe?g|webp|gif)/.test(type)) return null;
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${data}`;
  } catch {
    return null;
  }
}
