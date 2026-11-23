import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey || url.includes("your-project-ref") || publishableKey === "your-publishable-key") {
    throw new Error("Supabase belum dikonfigurasi. Isi URL dan publishable key di file .env.local.");
  }
  return createBrowserClient(url, publishableKey);
}
