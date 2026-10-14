"use client";
import { useState } from "react";
import type { Centre } from "../../lib/data";
import { useCurrentLocale } from "../../lib/useLocale";
import MapboxRouteMap from "../routes/MapboxRouteMap";

export default function CentreOverviewMap({ centre }: { centre: Centre }) {
  const [selected, setSelected] = useState(0);
  const nl = useCurrentLocale() === "nl";
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN || !centre.routes || !centre.routeCoordinates.length) return <p>{nl ? "Kaartvoorbeeld nog niet beschikbaar." : "Map preview is not available yet."}</p>;
  return <><MapboxRouteMap centre={centre} selectedIndex={selected} onSelect={setSelected} livePosition={null} liveTrack={[]} tracking={false} /><p className="route-list-note">{nl ? "Voorbeeldpunten van Route A. Open de route voor de volledige gecontroleerde rijroute." : "Preview points from Route A. Open the route for the full checked driving route."}</p></>;
}
