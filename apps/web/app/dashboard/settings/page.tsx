'use client';
import React from 'react';
import { SettingsView } from '../_components/SettingsView';

export default function SettingsPage() {
  return (
    <div className="min-h-full pb-12">
      <div className="max-w-[1600px] mx-auto">
        <SettingsView />
      </div>
    </div>
  );
}
