import React from 'react';
import { FaMapMarkerAlt, FaExternalLinkAlt } from 'react-icons/fa';

export default function LocationSharing({ latitude, longitude, address }) {
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <div className="flex flex-col gap-2 bg-dark-incoming/40 border border-white/5 rounded-xl p-3 max-w-[280px] w-full shadow-lg">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow">
          <FaMapMarkerAlt className="text-lg animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white tracking-wide">Shared Location</h4>
          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
            {address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
          </p>
        </div>
      </div>

      {/* Mock Static Map Canvas panel */}
      <div
        className="h-28 rounded-lg overflow-hidden relative border border-white/5 flex items-center justify-center bg-slate-800"
        style={{
          backgroundImage: `radial-gradient(circle, #334155 10%, transparent 11%)`,
          backgroundSize: '12px 12px'
        }}
      >
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Static Map Preview</span>
        <div className="absolute h-2 w-2 bg-red-500 rounded-full animate-ping"></div>
        <div className="absolute h-2.5 w-2.5 bg-red-600 rounded-full border border-white shadow"></div>
      </div>

      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full text-center py-2 bg-whatsapp-teal text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-whatsapp-teal/95 transition shadow-lg shadow-whatsapp-teal/10"
      >
        View on Google Maps <FaExternalLinkAlt className="text-[10px]" />
      </a>
    </div>
  );
}
