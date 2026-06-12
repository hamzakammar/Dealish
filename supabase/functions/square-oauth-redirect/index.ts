// Public relay for Square OAuth.
// Square only accepts https:// redirect URIs, but the mobile app expects a
// dealish:// deep link. This function bounces the user back to the app.
//
// Deploy: supabase functions deploy square-oauth-redirect --no-verify-jwt
// Register https://<project>.supabase.co/functions/v1/square-oauth-redirect
// as the OAuth Redirect URL in the Square Developer Console.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const DEEP_LINK_BASE = 'dealish://oauth-square';

function escapeAttr(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

serve((req) => {
  const reqUrl = new URL(req.url);
  const target = new URL(DEEP_LINK_BASE);
  reqUrl.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  const targetStr = target.toString();
  const targetSafe = escapeAttr(targetStr);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Returning to Dealish…</title>
<meta http-equiv="refresh" content="0;url=${targetSafe}">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; text-align: center; color: #333; }
  a { color: #FE902A; }
</style>
</head>
<body>
<p>Connecting Square to Dealish…</p>
<p>If you are not redirected automatically, <a href="${targetSafe}">tap here</a>.</p>
<script>window.location.replace(${JSON.stringify(targetStr)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
});
