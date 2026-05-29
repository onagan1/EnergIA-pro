// Mapeamento entre nomes de preset de comercializadores e pastas no storage
export const SUPPLIER_FOLDER_MAP: Record<string, string> = {
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

export function getSupplierFolder(supplierName: string): string | null {
  return SUPPLIER_FOLDER_MAP[supplierName] || null;
}
