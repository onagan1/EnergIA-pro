import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { corsHeaders, jsonResponse, z } from "../_shared/validation.ts";

const NetworkTariffSchema = z.object({
  peakPowerPrice: z.number().finite().min(0),
  contractedPowerPrice: z.number().finite().min(0),
  energyPonta: z.number().finite().min(0),
  energyCheia: z.number().finite().min(0),
  energyVazio: z.number().finite().min(0),
  energySuperVazio: z.number().finite().min(0),
});

interface NetworkTariff {
  peakPowerPrice: number;
  contractedPowerPrice: number;
  energyPonta: number;
  energyCheia: number;
  energyVazio: number;
  energySuperVazio: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify user token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !claimsData?.user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${claimsData.user.email}`);

    // Use service role client for storage access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the Excel file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("tarifas")
      .download("s_tarifas_net.xlsx");

    if (downloadError || !fileData) {
      console.error("Error downloading file:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download tariff file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the Excel file
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

    console.log("Sheet names:", workbook.SheetNames);

    const tariffs: Record<string, NetworkTariff> = {
      BTN: {
        peakPowerPrice: 0,
        contractedPowerPrice: 0,
        energyPonta: 0,
        energyCheia: 0,
        energyVazio: 0,
        energySuperVazio: 0,
      },
      BTE: {
        peakPowerPrice: 0,
        contractedPowerPrice: 0,
        energyPonta: 0,
        energyCheia: 0,
        energyVazio: 0,
        energySuperVazio: 0,
      },
      MT: {
        peakPowerPrice: 0,
        contractedPowerPrice: 0,
        energyPonta: 0,
        energyCheia: 0,
        energyVazio: 0,
        energySuperVazio: 0,
      },
      AT: {
        peakPowerPrice: 0,
        contractedPowerPrice: 0,
        energyPonta: 0,
        energyCheia: 0,
        energyVazio: 0,
        energySuperVazio: 0,
      },
      MAT: {
        peakPowerPrice: 0,
        contractedPowerPrice: 0,
        energyPonta: 0,
        energyCheia: 0,
        energyVazio: 0,
        energySuperVazio: 0,
      },
    };

    // Main tariffs are in "Tarifas Acesso" sheet
    const mainSheet = workbook.Sheets["Tarifas Acesso"];
    
    if (!mainSheet) {
      console.log("Main sheet 'Tarifas Acesso' not found, available sheets:", workbook.SheetNames);
      return new Response(
        JSON.stringify({ error: "Tariff sheet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const data = XLSX.utils.sheet_to_json(mainSheet, { header: 1 }) as any[][];
    console.log(`Main sheet has ${data.length} rows`);
    
    // Find the structure - look for voltage level headers
    // Structure per voltage level:
    // Row: "TARIFA DE ACESSO ÀS REDES EM [LEVEL]" | null | "PREÇOS"
    // Row: "Potência" | null | "EUR/(kW.dia)"
    // Row: null | "Horas de ponta" | [value] -> peakPowerPrice
    // Row: null | "Contratada" | [value] -> contractedPowerPrice
    // Row: "Energia ativa" | null | "EUR/kWh"
    // Row: null | "Horas de ponta" | [value] -> energyPonta
    // Row: null | "Horas cheias" | [value] -> energyCheia
    // Row: null | "Horas de vazio normal" | [value] -> energyVazio
    // Row: null | "Horas de super vazio" | [value] -> energySuperVazio
    
    let currentLevel = "";
    let currentSection = ""; // "potencia" or "energia"
    const voltageLevels = ["MAT", "AT", "MT", "BTE"];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const firstCell = String(row[0] || "").trim();
      const secondCell = String(row[1] || "").trim();
      const thirdCell = row[2];
      
      // Check if this row indicates a voltage level section
      for (const level of voltageLevels) {
        if (firstCell.toUpperCase().includes(`ACESSO ÀS REDES EM ${level}`)) {
          currentLevel = level;
          currentSection = "";
          console.log(`Found section for ${level} at row ${i}`);
          break;
        }
      }
      
      if (!currentLevel) continue;
      
      // Check for section headers
      if (firstCell.toLowerCase() === "potência") {
        currentSection = "potencia";
        console.log(`${currentLevel}: Entering Potência section at row ${i}`);
        continue;
      }
      
      if (firstCell.toLowerCase() === "energia ativa") {
        currentSection = "energia";
        console.log(`${currentLevel}: Entering Energia ativa section at row ${i}`);
        continue;
      }
      
      // Skip if we haven't entered a section yet
      if (!currentSection) continue;
      
      // Get numeric value from third column
      const value = typeof thirdCell === "number" ? thirdCell : parseFloat(String(thirdCell).replace(",", "."));
      if (isNaN(value) || value <= 0) continue;
      
      const labelLower = secondCell.toLowerCase();
      
      // Only set values if not already set (first occurrence wins - standard tariff)
      if (currentSection === "potencia") {
        if ((labelLower.includes("horas de ponta") || labelLower === "horas de ponta") && tariffs[currentLevel].peakPowerPrice === 0) {
          tariffs[currentLevel].peakPowerPrice = value;
          console.log(`${currentLevel} peakPowerPrice: ${value} (row ${i})`);
        } else if (labelLower.includes("contratada") && tariffs[currentLevel].contractedPowerPrice === 0) {
          tariffs[currentLevel].contractedPowerPrice = value;
          console.log(`${currentLevel} contractedPowerPrice: ${value} (row ${i})`);
        }
      } else if (currentSection === "energia") {
        if (labelLower === "horas de ponta" && tariffs[currentLevel].energyPonta === 0) {
          tariffs[currentLevel].energyPonta = value;
          console.log(`${currentLevel} energyPonta: ${value} (row ${i})`);
        } else if ((labelLower.includes("cheias") || labelLower === "horas cheias") && tariffs[currentLevel].energyCheia === 0) {
          tariffs[currentLevel].energyCheia = value;
          console.log(`${currentLevel} energyCheia: ${value} (row ${i})`);
        } else if ((labelLower.includes("super vazio") || labelLower === "horas de super vazio") && tariffs[currentLevel].energySuperVazio === 0) {
          tariffs[currentLevel].energySuperVazio = value;
          console.log(`${currentLevel} energySuperVazio: ${value} (row ${i})`);
        } else if ((labelLower.includes("vazio normal") || labelLower === "horas de vazio normal") && tariffs[currentLevel].energyVazio === 0) {
          tariffs[currentLevel].energyVazio = value;
          console.log(`${currentLevel} energyVazio: ${value} (row ${i})`);
        }
      }
    }

    // Validar tariffs extraídos
    const TariffsRecordSchema = z.record(NetworkTariffSchema);
    const tariffsValidation = TariffsRecordSchema.safeParse(tariffs);
    if (!tariffsValidation.success) {
      console.error("Tariffs schema invalid:", tariffsValidation.error.flatten());
      return jsonResponse(
        { error: "Formato de tarifas inválido", fields: tariffsValidation.error.flatten().fieldErrors },
        500,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tariffs: tariffsValidation.data,
        message: "Network tariffs extracted successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing tariffs:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process tariffs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
