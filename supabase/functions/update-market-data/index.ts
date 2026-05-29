import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdmin(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum ficheiro enviado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return new Response(
        JSON.stringify({ success: false, error: "Ficheiro deve ser .xlsx" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: "Ficheiro excede 25 MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    console.log(`Received market data file: ${fileBytes.length} bytes, name: ${file.name}`);

    if (fileBytes.length < 500) {
      return new Response(
        JSON.stringify({ success: false, error: "Ficheiro demasiado pequeno para ser válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const results: { bucket: string; success: boolean; error?: string }[] = [];

    // Upload to erc-data bucket
    const { error: ercError } = await supabase.storage
      .from("erc-data")
      .upload("erc_isp_latest.xlsx", fileBytes, { contentType, upsert: true });

    results.push({
      bucket: "erc-data",
      success: !ercError,
      error: ercError?.message,
    });

    // Upload to mfrr-data bucket
    const { error: mfrrError } = await supabase.storage
      .from("mfrr-data")
      .upload("mfrr_latest.xlsx", fileBytes, { contentType, upsert: true });

    results.push({
      bucket: "mfrr-data",
      success: !mfrrError,
      error: mfrrError?.message,
    });

    const allSuccess = results.every((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      console.error("Some uploads failed:", failures);
    }

    console.log("Market data upload results:", results);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        message: allSuccess
          ? "Ficheiro ERC e mFRR atualizado com sucesso"
          : "Upload parcial: ver logs do servidor",
        size: fileBytes.length,
        fileName: file.name,
        updatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating market data:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno ao atualizar ficheiros" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
