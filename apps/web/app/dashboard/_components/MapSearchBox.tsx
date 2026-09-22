'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search } from 'lucide-react';

export default function MapSearchBox({
  onPlaceSelect,
}: {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
}) {
  const map = useMap();
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeAutocomplete, setPlaceAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address'],
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    const listener = placeAutocomplete.addListener('place_changed', () => {
      const place = placeAutocomplete.getPlace();
      
      onPlaceSelect(place);

      if (place.geometry?.location && map) {
        map.panTo(place.geometry.location);
        map.setZoom(16);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [placeAutocomplete, map, onPlaceSelect]);

  return (
    <div className="relative w-full mb-3">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-ink-muted" />
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for a location..."
        className="w-full bg-canvas border border-border-subtle rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-ink"
      />
    </div>
  );
}
