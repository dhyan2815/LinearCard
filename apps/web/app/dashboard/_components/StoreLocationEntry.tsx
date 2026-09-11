'use client';
import React, { useState } from 'react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MapPin, Target, X, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface StoreLocationEntryProps {
  location: { id?: string; latitude: string; longitude: string; label: string };
  index: number;
  onUpdate: (
    index: number,
    fieldOrUpdates: 'latitude' | 'longitude' | 'label' | Record<string, string>,
    value?: string
  ) => void;
  onRemove: (index: number) => void;
}

export function StoreLocationEntry({ location, index, onUpdate, onRemove }: StoreLocationEntryProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const detectLocation = () => {
    setIsDetecting(true);
    setErrorMessage(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);

        // Atomic update of both coordinates to prevent React state closure overwrite
        onUpdate(index, {
          latitude: lat,
          longitude: lng,
        });

        setIsDetecting(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        let msg = 'Failed to detect location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location access was denied. Please allow location permissions in your browser.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable on this device/network.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please try again or enter manually.';
        }
        setErrorMessage(msg);
        setIsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const hasCoordinates = Boolean(location.latitude && location.longitude);

  return (
    <div className="p-4 bg-canvas rounded-lg border border-border-subtle shadow-sm space-y-4 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-blue" />
          <span className="text-sm font-semibold text-ink-dark">Location {index + 1}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Location Name / Label (optional)</Label>
          <Input
            type="text"
            placeholder="e.g. Mumbai Flagship Store"
            value={location.label || ''}
            onChange={(e) => onUpdate(index, 'label', e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            type="button" 
            variant="secondary" 
            onClick={detectLocation}
            disabled={isDetecting}
            className="w-full flex items-center justify-center gap-2 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 border-brand-blue/20 h-10 font-medium text-xs sm:text-sm"
          >
            {isDetecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Acquiring GPS coordinates...</span>
              </>
            ) : (
              <>
                <Target className="w-4 h-4" />
                <span>{hasCoordinates ? '📍 Re-detect My Location' : '📍 Detect My Location'}</span>
              </>
            )}
          </Button>

          {errorMessage && (
            <div className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 p-2.5 rounded-md border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {hasCoordinates && (
            <div className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-md border border-emerald-500/20 flex items-center justify-between gap-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold shrink-0">Coordinates captured:</span>
                <span className="font-mono text-[11px] truncate">
                  {location.latitude}, {location.longitude}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button 
          type="button" 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-semibold text-ink-muted flex items-center gap-1 hover:text-ink-dark transition-colors"
        >
          {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Advanced: Manual Coordinate Entry
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border-subtle">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input
                type="number"
                step="any"
                min="-90"
                max="90"
                placeholder="e.g. 19.076000"
                value={location.latitude || ''}
                onChange={(e) => onUpdate(index, 'latitude', e.target.value)}
                className="mt-1 font-mono text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input
                type="number"
                step="any"
                min="-180"
                max="180"
                placeholder="e.g. 72.877000"
                value={location.longitude || ''}
                onChange={(e) => onUpdate(index, 'longitude', e.target.value)}
                className="mt-1 font-mono text-sm"
                required
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
