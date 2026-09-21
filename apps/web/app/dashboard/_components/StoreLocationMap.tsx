'use client';
import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

/**
 * Phase 4.4 — click-to-place picker for a store geofence.
 *
 * Powered by @vis.gl/react-google-maps using the official Google Maps API.
 * The Map requires a Map ID for AdvancedMarker to function (using a fallback ID here,
 * ensure your Google Cloud project supports this or replace with a real Map ID).
 */
function MapUpdater({ lat, lng, hasCoords }: { lat: number; lng: number; hasCoords: boolean }) {
  const map = useMap();
  React.useEffect(() => {
    if (map && hasCoords) {
      map.panTo({ lat, lng });
    }
  }, [lat, lng, hasCoords, map]);
  return null;
}

export default function StoreLocationMap({
  latitude,
  longitude,
  onPick,
}: {
  latitude: string;
  longitude: string;
  onPick: (lat: string, lng: string) => void;
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India-first default
  const center = hasCoords ? { lat, lng } : defaultCenter;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="h-56 w-full rounded-lg border border-border-subtle bg-canvas-muted flex items-center justify-center text-ink-muted text-sm p-4 text-center">
        Google Maps API Key is missing.
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="flex flex-col">
        <div
          className="h-56 w-full rounded-lg border border-border-subtle overflow-hidden z-0 relative bg-canvas-muted"
          style={{ isolation: 'isolate' }}
        >
          <Map
            defaultZoom={hasCoords ? 16 : 4}
            defaultCenter={center}
            mapId="DEMO_MAP_ID" // Replace with an actual map ID from Google Cloud Console if customizing map styles
            disableDefaultUI={true}
            gestureHandling="greedy" // Allows one-finger panning on mobile and normal dragging on desktop
            onClick={(e: any) => {
              const latLng = e.detail?.latLng || e.latLng;
              if (latLng) {
                const clickLat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
                const clickLng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
                onPick(Number(clickLat).toFixed(6), Number(clickLng).toFixed(6));
              }
            }}
          >
            <MapUpdater lat={lat} lng={lng} hasCoords={hasCoords} />
            {hasCoords && (
              <AdvancedMarker position={center}>
                <Pin background={'#2563eb'} borderColor={'#ffffff'} glyphColor={'#ffffff'} />
              </AdvancedMarker>
            )}
          </Map>
        </div>
      </div>
    </APIProvider>
  );
}
