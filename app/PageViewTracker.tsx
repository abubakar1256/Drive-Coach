"use client";

import { useEffect } from "react";

type EventType = "PAGE_VIEW" | "CENTRE_VIEW" | "ROUTE_VIEW";

type Props = {
  eventType: EventType;
  centreSlug?: string;
  routeSlug?: string;
};

export default function PageViewTracker({ eventType, centreSlug, routeSlug }: Props) {
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
    void fetch(`${api}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, centreSlug, routeSlug }),
      keepalive: true,
    }).catch(() => undefined);
  }, [eventType, centreSlug, routeSlug]);

  return null;
}
