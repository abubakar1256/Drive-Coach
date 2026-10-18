import { createHash } from "node:crypto";

// Factual junction records transcribed from the PDFs linked by the operator's
// centre pages on 2026-10-18. Source publication != verified coordinates,
// mandatory exam itinerary, instructor approval or permission to enter a site.
const page = "https://www.autoveiligheid.be/rijbewijs/examencentra/examencentrum-";
const pdf = "https://www.autoveiligheid.be/storage/files/";
function source(slug: string, name: string, address: string, file: string, revision: string, rows: string) {
  const seen = new Map<string, number>();
  const points = rows.trim().split("\n").map((row, index) => {
    const [municipality, junction] = row.trim().split("|");
    const key = `${municipality.toLowerCase()}:${junction.toLowerCase().split(/\s+[-–]\s+/).map(s => s.replace(/[^\p{L}\p{N}]/gu, "")).sort().join("|")}`;
    const duplicateOfSequence = seen.get(key) ?? null;
    if (!duplicateOfSequence) seen.set(key, index + 1);
    return { sequence: index + 1, municipality, junction, duplicateOfSequence };
  });
  return { slug, name, address, centreSourceUrl: page + name.toLowerCase(), sourceUrl: pdf + file, sourceRevision: revision, sourceCheckedAt: "2026-10-18T00:00:00.000Z", points };
}
export const officialPassageCatalog = [
  source("alken", "Alken", "Industrieterrein Kolmen 1216, 3570 Alken", "doorgangspunten-1005-1758689674.pdf", "2024-11-01", `
Alken|Meerdegatstraat - Expressweg
Hasselt|Eugeen Leenlaan - Luikersteenweg
Hasselt|Sint-Truidersteenweg - Vorststraat
Hasselt|Lentestraat - Zomerstraat
Hasselt|De Geloesplein
Hasselt|Prins Bisschopssingel - Sint-Truidersteenweg
Hasselt|Boomkensstraat - Kruisherenlaan
Hasselt|Abelenstraat - Boomkensstraat
Hasselt|Slagerslaan - Boerenkrijgsingel
Hasselt|Sint-Hubertusplein
Hasselt|Runkstersteenweg - Boerenkrijgsingel
Hasselt|Notelarenstraat - Jagersstraat
Hasselt|Sint-Martinusplein
Hasselt|Sint-Truidersteenweg - Overmerelaan
Hasselt|Sint-Truidersteenweg - De Berlaymontstraat
Alken|Meerdegatstraat - Kolmenstraat
Hasselt|Schoolstraat - Fonteinstraat
Alken|Groenmolenstraat - Stationsstraat
Hasselt|Kliniekstraat - Prins Bisschopssingel
Hasselt|Luikersteenweg - Daniëlstraat
Alken|Kolmenstraat - Groenmolenstraat
Alken|Meerdegatstraat - Steenweg
Hasselt|Pastorijstraat – Sint-Truidersteenweg
Hasselt|Graaf de Brigodestraat - Sint-Lambrechts-Herkstraat
Hasselt|Rode-Kruisstraat - Lindenhofstraat
Hasselt|Lindenhofstraat - Beukenhofstraat
Hasselt|Steenweg - Stationsstraat
Hasselt|Sint-Lambertusstraat - Sint-Truidersteenweg
Hasselt|Pastorijstraat - Graaf de Brigodestraat
Hasselt|Papenakkerstraat – Gravin de Stembierstraat
Hasselt|Sint-Truidersteenweg - Kruisherenlaan
Hasselt|Sint-Truidersteenweg - Biezenstraat`),
  source("antwerp-geel", "Geel", "Lammerdries 7, Industrieterrein Geel-West, 2440 Geel", "doorgangspunten-1023-1763127051.pdf", "2025-10-31", `
Geel|Herentalseweg - Velveken
Geel|Rauwelkoven - Larumseweg
Geel|Dr. Peetersstraat - Drijhoek
Geel|Larumseweg - Westelijke ring
Geel|Anemoonstraat - Baantveld
Geel|Rauwelkoven - Elsum
Geel|Antwerpseweg - Pas
Geel|Waaiburg - Anemoonstraat
Geel|Elsum - Violetstraat
Geel|Herentalseweg - Hees
Geel|Westelijke Ring - Larumseweg
Geel|Elsum - Meidoornstraat
Geel|Geelseweg - Veldstraat
Herentals|Geelseweg - Aarschotseweg
Herentals|Ringlaan - Augustijnerlaan
Olen|Hoogbuul - Industrielaan
Olen|Bulestraat - Het Bremmeken
Olen|Dorp - Bulestraat
Olen|Neerbuul - Moleneinde
Olen|Schommenstraat - Dr. De Biestraat
Olen|Ven - Het Bremmeken
Olen|Geelseweg - Oevelseweg
Olen|Pastoriestraat - Beilen
Olen|P.Verhaertstraat - Stationsstraat
Olen|Neerbuul - Moleneinde
Olen|Het Bremmeken - Bulestraat
Olen|Dorp - Koning Boudewijnlaan`),
  source("antwerp-north", "Deurne", "Santvoortbeeklaan 34-36, 2100 Deurne", "doorgangspunten-1004-1764336868.pdf", "2025-11-17", `
Merksem|Deurnsebaan - Straalstraat
Wijnegem|Turnhoutsebaan - Dorenboslaan
Deurne|Jan Welterslaan - Oude bosuilbaan
Schoten|Straalstraat - Toekomstlaan
Schoten|Jozef Cogelslei - Deuzeldlaan
Deurne|Eugeen Fahylaan - Ruggeveldlaan
Deurne|Gallifortlei - Ter Heydelaan
Deurne|Keesinglaan - Middelmolenlaan
Wijnegem|Merksemsebaan - Houtlaan
Deurne|Keesinglaan - Belcrowlaan
Deurne|Kruiningenstraat - Bisschoppenhoflaan
Deurne|Bisschoppenhoflaan - Industrielaan
Deurne|Leeuwlantstraat - Kreglingerstraat
Wijnegem|Brouwerslaan - Koolsveldlaan
Deurne|Middelmolenlaan - Kruiningenstraat
Deurne|Middelmolenlaan - Santvoortbeeklaan
Merksem|Oudebareellei - Eethuisstraat
Deurne|Santvoortbeeklaan - Bisschoppenhoflaan
Wijnegem|Merksemsebaan - Deurnesesteenweg
Deurne|Lakborslei - Confortalei
Deurne|Venneborglaan - Alfons Schneiderlaan
Deurne|Ter Rivierenlaan - Boshovestraat
Deurne|Ten Eekhovelei - Lakborslei
Deurne|Ter Heydelaan - Alfons Schneiderlaan
Deurne|Ter Rivierenlaan - Planckenbergstraat
Deurne|Venneborglaan - Boshovestraat
Deurne|Confortalei - Ter Heydelaan
Wijnegem|August van de Wielelei - Houtlaan
Deurne|Schotensesteenweg - Koningsarendlaan`),
  source("antwerp-kontich", "Kontich", "Neerveld 3A, 2550 Kontich", "doorgangspunten-1022-1758689674.pdf", "2024-11-01", `
Kontich|Antwerpsesteenweg - Altenastraat
Kontich|Antwerpsesteenweg - Pluyseghemstraat
Kontich|Antwerpsesteenweg - Koningin Astridlaan
Kontich|Boniverlei - Kontichstraat
Kontich|Ooststatiestraat - Koningin Astridlaan
Kontich|Prins Boudewijnlaan - Groeningenlei
Kontich|Drabstraat - Expressweg
Kontich|Mechelsesteenweg - Kruisschanslei
Kontich|Mechelsesteenweg - Koningin Astridlaan
Kontich|Neerveld - Blauwesteenstraat
Kontich|De Villermontstraat - Boniverlei
Kontich|Neerveld - Singel
Kontich|Mechelsesteenweg - Neerveld
Kontich|Reepkenslei - Mechelsesteenweg
Kontich|Gemeenteplein Kontich
Kontich|Koningin Astridlaan - Vredestraat
Kontich|Koningin Astridlaan - Duffelsesteenweg
Kontich|Heiveldekens - Singel
Kontich|Singel - Duffelsesteenweg
Kontich|Jan Frans Gellyncklaan - Mechelsesteenweg
Kontich|Kauwlei - Ooststatiestraat
Kontich|Duffelsesteenweg - Duffelshoek
Kontich|Kapelstraat - Hoge Akker
Kontich|Edegemsesteenweg - Helenaveldstraat
Kontich|Antwerpsesteenweg - Helenaveldstraat`),
  source("bree", "Bree", "Nieshofstraat 1, 3960 Bree", "doorgangspunten-1033-1781607015.pdf", "2025-11-17", `
Bree|Bruglaan - Rode Kruislaan
Bree|Barrierstraat - Hamonterweg
Bree|Rode Kruislaan - Meeuwerkiezel
Bree|Witte Torenwal - Gerdingerpoort
Bree|Malta - Millenstraat
Bree|Maalbosstraat - Rorenweg
Bree|Rode Kruislaan - Kloosterpoort
Bree|Stift - Toleikstraat
Bree|Barrierstraat - Truyenhofstraat
Bree|Rode Kruislaan - Oppiterkiezel
Bree|Gruitroderkeizel - Rode Kruislaan
Bree|Bocholterkiezel - Sportlaan
Bree|Peerderbaan - Hamonterweg
Bree|Bocholterkiezel - Wolstraat
Bree|Vrijheidslaan - Schutterijstraat
Bocholt|Reppelerweg - Merelstraat
Bocholt|Damburgstraat - Breeërweg
Bocholt|Kloosterstraat - Schuttersstraat
Bree|Witte Torenwal - Malta
Bree|Rotonde Peerderbaan - Hamonterweg
Bree|Boneputstraat - Gruitroderkiezel
Bree|Hamonterweg - Bocholterkiezel
Bocholt|Dorpsstraat - Kaulillerweg
Bocholt|Breeërweg - Kloosterstraat`),
  source("haasrode", "Haasrode", "Ambachtenlaan 10, 3001 Haasrode", "doorgangspunten-1024-1763560723.pdf", "2025-11-17", `
Heverlee|Ambachtenlaan - Neringerweg
Heverlee|Ambachtenlaan - Ondernemingenweg
Heverlee|Hertogstraat - Kerspelstraat
Heverlee|Hertogstraat - Groenstraat
Heverlee|Broekstraat - Ruelensvest
Heverlee|Naamsesteenweg - Tervuursevest
Heverlee|Parkstraat - Naamsevest
Haasrode|Meerdaalboslaan - Expresweg
Heverlee|Expresweg - Bierbeekstraat
Heverlee|Meerdaalboslaan - Tiensesteenweg
Heverlee|Meerdaalboslaan - Brabantlaan
Heverlee|Naamsesteenweg - Prins De Lignestraat
Haasrode|Meerdaalboslaan - Technologielaan
Haasrode|Meerdaalboslaan - Geldenaaksebaan
Heverlee|Hertogstraat - Bierbeekpleindreef
Heverlee|Hertogstraat - Sparrendreef
Heverlee|Naamsesteenweg - Hertogstraat (Het Brood)
Heverlee|Expresweg - E40
Heverlee|Expresweg - Bovenbosstraat`),
];
export function passageFingerprint(point: { municipality: string; junction: string; sourceUrl: string; sourceRevision: string | null }) {
  return createHash("sha256").update(JSON.stringify([point.municipality, point.junction, point.sourceUrl, point.sourceRevision])).digest("hex");
}
