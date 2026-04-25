// Public relay for Google Sheets OAuth.
// Google's "Web application" OAuth client only accepts https:// redirect URIs,
// but the mobile app expects a `dealish://` deep link. This function takes the
// HTTPS callback from Google and bounces the user to the app via a tiny HTML
// page that fires a `dealish://oauth-google-sheets?code=...` redirect.
//
// Deploy: supabase functions deploy google-oauth-redirect --no-verify-jwt
// Register https://<project>.supabase.co/functions/v1/google-oauth-redirect
// as the Authorized redirect URI in the Google Cloud OAuth client.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const DEEP_LINK_BASE = 'dealish://oauth-google-sheets';

function escapeAttr(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

serve((req) => {
  const reqUrl = new URL(req.url);
  // Forward every Google query param (code, state, scope, error, error_description, etc.).
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
<p>Returning to Dealish…</p>
<p>If you are not redirected automatically, <a href="${targetSafe}">tap here</a>.</p>
<script>window.location.replace(${JSON.stringify(targetStr)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
});
