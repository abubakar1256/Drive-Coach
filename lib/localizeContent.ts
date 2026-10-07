import type { Locale } from "./i18n";
import type { Centre, RoutePoint } from "./data";

const phrases: Array<[string, string]> = [
  ["Prepare for the roads around Brussels South with a clear view of the junctions and lane changes that deserve your attention.", "Bereid je voor op de wegen rond Brussel-Zuid met een duidelijk overzicht van kruispunten en rijstrookwissels die extra aandacht vragen."],
  ["Build confidence on the mix of residential streets, tram corridors and larger city junctions around Antwerp North.", "Bouw vertrouwen op in de combinatie van woonstraten, tramcorridors en grotere stadskruispunten rond Antwerpen-Noord."],
  ["Practise the calm, precise driving style needed for Ghent East, from roundabouts to changing speed zones.", "Oefen de rustige, precieze rijstijl die je in Gent-Oost nodig hebt, van rotondes tot wisselende snelheidszones."],
  ["Official driving-test centre serving", "Officieel examencentrum voor"],
  ["Official driving-test centre in", "Officieel examencentrum in"],
  ["Busy urban junctions", "Drukke stadskruispunten"], ["Early lane positioning", "Vroeg positie kiezen"], ["School and 30 km/h zones", "School- en 30 km/u-zones"],
  ["Tram corridors", "Tramcorridors"], ["Multi-lane crossings", "Kruispunten met meerdere rijstroken"], ["Residential priority roads", "Woonstraten met voorrang"],
  ["Compact roundabouts", "Compacte rotondes"], ["Changing speed zones", "Wisselende snelheidszones"], ["Open-road observation", "Observeren op open wegen"],
  ["Urban junctions", "Stadskruispunten"], ["Lane positioning", "Positie op de rijstrook"], ["Priority situations", "Voorrangssituaties"], ["Urban roads", "Stedelijke wegen"], ["Roundabouts", "Rotondes"], ["Speed-zone changes", "Wisselende snelheidszones"], ["Busy junctions", "Drukke kruispunten"], ["Official passage points", "Officiële doorgangspunten"], ["Residential roads", "Woonstraten"], ["Rural transitions", "Overgangen naar landelijke wegen"], ["Junctions", "Kruispunten"], ["Speed awareness", "Snelheidsbewustzijn"], ["Cyclist observation", "Fietsers observeren"], ["Lane choice", "Rijstrook kiezen"], ["Speed zones", "Snelheidszones"], ["Lane changes", "Rijstrookwissels"], ["Junction observation", "Kruispunten observeren"], ["Rural roads", "Landelijke wegen"],
  ["Leave the test centre", "Verlaat het examencentrum"], ["Check mirrors and position before joining traffic", "Controleer spiegels en positie voordat je invoegt in het verkeer"], ["Lane change before junction", "Rijstrookwissel vóór het kruispunt"], ["Move over early and keep the junction clear", "Wissel vroeg van rijstrook en houd het kruispunt vrij"], ["Two-lane roundabout", "Rotonde met twee rijstroken"], ["Choose the correct lane for the second exit", "Kies de juiste rijstrook voor de tweede afrit"], ["Residential speed zone", "Snelheidszone in woongebied"], ["Look for cyclists and changing speed limits", "Let op fietsers en veranderende snelheidslimieten"], ["Start on the main road", "Start op de hoofdweg"], ["Scan for cyclists before moving off", "Kijk naar fietsers voordat je vertrekt"], ["Tram crossing", "Tramoversteek"], ["Read the lights and keep the tracks clear", "Lees de lichten en houd de sporen vrij"], ["Traffic light sequence", "Volgorde van verkeerslichten"], ["Stay in lane and anticipate the next light", "Blijf op je rijstrook en anticipeer op het volgende licht"], ["Test centre exit", "Uitrit van het examencentrum"], ["Take time to read the first signs", "Neem de tijd om de eerste borden te lezen"], ["Compact roundabout", "Compacte rotonde"], ["Signal only when leaving the roundabout", "Geef alleen richting aan bij het verlaten van de rotonde"], ["Open-road transition", "Overgang naar een open weg"], ["Adjust speed before the built-up area", "Pas je snelheid aan vóór de bebouwde kom"],
];

export function localizeText(value: string, locale: Locale) {
  if (locale === "en") return value;
  return phrases.reduce((result, [english, dutch]) => result.replaceAll(english, dutch), value);
}

export function localizeCentre(centre: Centre, locale: Locale): Centre {
  if (locale === "en") return centre;
  const routePoints: RoutePoint[] = centre.routePoints.map((point) => ({ ...point, title: localizeText(point.title, locale), detail: localizeText(point.detail, locale) }));
  return { ...centre, description: localizeText(centre.description, locale), highlights: centre.highlights.map((highlight) => localizeText(highlight, locale)), routePoints };
}
