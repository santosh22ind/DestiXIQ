// Lookup for the 8 country codes among the curated MVP destinations
// (mvp.md §3). US State Dept / GDELT use FIPS 10-4 codes, which differ
// from ISO for the UK and Australia — that's the reason this exists
// rather than deriving everything from destinations.country_code.
export const COUNTRY_INFO: Record<
  string,
  { name: string; fips: string; ukFcdoSlug?: string }
> = {
  US: { name: "United States", fips: "US" },
  CA: { name: "Canada", fips: "CA", ukFcdoSlug: "canada" },
  IN: { name: "India", fips: "IN", ukFcdoSlug: "india" },
  GB: { name: "United Kingdom", fips: "UK" },
  FR: { name: "France", fips: "FR", ukFcdoSlug: "france" },
  AU: { name: "Australia", fips: "AS", ukFcdoSlug: "australia" },
  BR: { name: "Brazil", fips: "BR", ukFcdoSlug: "brazil" },
  AR: { name: "Argentina", fips: "AR", ukFcdoSlug: "argentina" },
};

export const DESTINATION_AIRPORTS: Record<string, string[]> = {
  "New York": ["JFK", "LGA", "EWR"],
  "Los Angeles": ["LAX"],
  Toronto: ["YYZ"],
  Delhi: ["DEL"],
  Mumbai: ["BOM"],
  London: ["LHR"],
  Paris: ["CDG"],
  Sydney: ["SYD"],
  "São Paulo": ["GRU"],
  "Buenos Aires": ["EZE"],
};
