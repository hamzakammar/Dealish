// Supabase Edge Function — send-confirmation-email
// Sends a welcome/confirmation reminder email via Resend after user signup.
// This supplements (does NOT replace) Supabase's built-in confirmation link email.
//
// Required environment variable (set in Supabase Dashboard → Settings → Edge Functions):
//   RESEND_API_KEY — your Resend API key
//   RESEND_FROM_EMAIL — verified sender address e.g. "noreply@dealish.ca"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { email, user_id } = await req.json();

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, user_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@dealish.ca";

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Dealish <${fromEmail}>`,
        to: [email],
        subject: "Welcome to Dealish — confirm your email",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="color:#FE902A;margin-bottom:8px">Welcome to Dealish!</h2>
            <p style="color:#333;font-size:16px;line-height:1.5">
              Thanks for signing up. We sent a confirmation link to
              <strong>${email}</strong> — click it to activate your account.
            </p>
            <p style="color:#333;font-size:16px;line-height:1.5">
              Once confirmed you'll be able to discover exclusive deals at
              restaurants near you.
            </p>
            <p style="color:#999;font-size:13px;margin-top:32px">
              If you didn't sign up for Dealish, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error("Resend API error:", errorBody);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorBody }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const result = await emailResponse.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error("Error in send-confirmation-email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
