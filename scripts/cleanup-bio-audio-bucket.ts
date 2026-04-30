/**
 * One-shot cleanup for the legacy `bio-audio` storage bucket.
 *
 * Supabase blocks direct DELETE on storage.objects/storage.buckets via a
 * trigger (storage.protect_delete), so migration 007 cannot drop the legacy
 * bucket inline. Run this script once after applying migration 007.
 *
 * Usage:  npx tsx scripts/cleanup-bio-audio-bucket.ts
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const BUCKET = 'bio-audio';

async function main() {
  // List all objects in the legacy bucket. The default `list('')` returns
  // top-level entries only; objects live under `${userId}/...` so we have to
  // page each user folder. We iterate by listing the root, then descending
  // into each "folder" (prefix).
  const queue: string[] = [''];
  const allPaths: string[] = [];

  while (queue.length > 0) {
    const prefix = queue.shift()!;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    if (error) {
      // Bucket may already be gone — that's fine.
      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        console.log(`[cleanup] Bucket ${BUCKET} not found — nothing to do.`);
        return;
      }
      throw error;
    }
    for (const entry of data ?? []) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder entry has no `id` (or has `metadata: null`) in supabase-js.
      const isFolder = entry.id === null;
      if (isFolder) {
        queue.push(fullPath);
      } else {
        allPaths.push(fullPath);
      }
    }
  }

  if (allPaths.length > 0) {
    console.log(`[cleanup] Removing ${allPaths.length} object(s) from ${BUCKET}...`);
    // Storage API supports batched remove (up to 1000 paths per call).
    for (let i = 0; i < allPaths.length; i += 1000) {
      const batch = allPaths.slice(i, i + 1000);
      const { error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) throw error;
    }
  } else {
    console.log(`[cleanup] No objects in ${BUCKET}.`);
  }

  console.log(`[cleanup] Deleting bucket ${BUCKET}...`);
  const { error: deleteErr } = await supabase.storage.deleteBucket(BUCKET);
  if (deleteErr) {
    if (deleteErr.message.includes('not found')) {
      console.log(`[cleanup] Bucket ${BUCKET} was already gone.`);
    } else {
      throw deleteErr;
    }
  } else {
    console.log(`[cleanup] Done — ${BUCKET} bucket removed.`);
  }
}

main().catch((err) => {
  console.error('[cleanup] Failed:', err);
  process.exit(1);
});
