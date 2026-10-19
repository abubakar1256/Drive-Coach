// require avoids TypeScript expanding thousands of gazetteer entries into types.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const compiledResource = resolve(__dirname,"../../../prisma/data/belgian-places.json");
const gazetteer = require(existsSync(compiledResource) ? compiledResource : resolve(__dirname,"../../prisma/data/belgian-places.json")) as { places:Array<{ id:string; name:string; aliases:string[]; latitude:number; longitude:number; region:string; district:string; population:number }> };
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\d]+/gu," ").trim();
const places = gazetteer.places.map(p => ({ ...p, search: [p.name, ...p.aliases].map(normalize) }));
const byId = new Map(places.map(p => [p.id,p]));
export function hometownPlace(id: string) { return byId.get(id); }
export function searchHometowns(query: string) {
  const q = normalize(query.slice(0,80));
  if (q.length < 2) return [];
  return places.filter(p => p.search.some(n => n.includes(q))).sort((a,b) => Number(b.search.includes(q))-Number(a.search.includes(q)) || b.population-a.population || a.id.localeCompare(b.id)).slice(0,12).map(p => ({ id:p.id, name:p.name, region:p.region, district:p.district, source:"GeoNames · CC BY 4.0" }));
}
