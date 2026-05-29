import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, parseJsonBody, z } from "../_shared/validation.ts";

const RequestSchema = z.object({
  supplierName: z.string().trim().min(1, "supplierName obrigatório").max(100),
  bucket: z.enum(["comercializadoras", "comissoes"]).optional().default("comercializadoras"),
});

// Mapeamento de nomes de comercializadores para pastas no bucket "comercializadoras"
const SUPPLIER_FOLDER_MAP: Record<string, string> = {
  "Alfa Energia": "Alfa",
  "Audax": "Audax",
  "Axpo": "Axpo",
  "EDP": "EDP",
  "EZU Energia": "EZU",
  "Galp": "Galp",
  "Goldenergy": "Goldenergy",
  "Iberdrola": "Iberdrola",
  "Luzboa": "Luzboa",
  "Plenitude": "Plenitude",
  "Portulogos": "Portulogos",
  "yes ENERGY": "yes",
};

// Slug usado no bucket "comissoes" (igual ao slugify do CommissionBulkUpload)
function slugifySupplier(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.log("Invalid or expired token:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.email}`);

    const parsed = await parseJsonBody(req, RequestSchema);
    if (!parsed.ok) return parsed.response;
    const { supplierName, bucket } = parsed.data;

    // Resolver pasta consoante o bucket
    let folderName: string | undefined;
    if (bucket === "comissoes") {
      folderName = slugifySupplier(supplierName);
    } else {
      folderName = SUPPLIER_FOLDER_MAP[supplierName];
    }

    if (!folderName) {
      console.log(`No folder mapping found for supplier: ${supplierName} (bucket=${bucket})`);
      return new Response(
        JSON.stringify({ files: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Looking for PDFs in bucket "${bucket}" folder: ${folderName}`);

    // Função recursiva para listar PDFs em subpastas
    const listPdfsRecursively = async (basePath: string, currentPath: string = ''): Promise<any[]> => {
      const fullPath = currentPath ? `${basePath}/${currentPath}` : basePath;

      const { data: items, error: listError } = await supabaseAdmin.storage
        .from(bucket)
        .list(fullPath, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error(`Storage list error for ${fullPath}:`, listError);
        return [];
      }

      const pdfFiles: any[] = [];
      const folders: string[] = [];

      for (const item of items || []) {
        if (item.name.startsWith('.')) continue;

        if (!item.id) {
          folders.push(item.name);
        } else if (item.name.toLowerCase().endsWith('.pdf')) {
          if (bucket === "comercializadoras" && supplierName === "Plenitude" && /^resumen/i.test(item.name)) continue;
          const relativePath = currentPath ? `${currentPath}/${item.name}` : item.name;
          pdfFiles.push({
            name: item.name,
            path: `${basePath}/${relativePath}`,
            folder: currentPath || null,
            createdAt: item.created_at,
            size: item.metadata?.size
          });
        }
      }

      for (const folder of folders) {
        const subPath = currentPath ? `${currentPath}/${folder}` : folder;
        const subPdfs = await listPdfsRecursively(basePath, subPath);
        pdfFiles.push(...subPdfs);
      }

      return pdfFiles;
    };

    const pdfFiles = await listPdfsRecursively(folderName);

    console.log(`Found ${pdfFiles.length} PDF files for ${supplierName} in bucket "${bucket}"`);

    return new Response(
      JSON.stringify({ files: pdfFiles, bucket }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in list-supplier-pdfs:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
