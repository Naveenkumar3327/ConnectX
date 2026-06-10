import React, { useContext, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPhone, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaDesktop } from 'react-icons/fa';
import { CallContext } from '../../context/CallContext.jsx';

export default function CallOverlay() {
  const {
    callState,
    callType,
    partner,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    isScreenSharing,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useContext(CallContext);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Play streams in video tags when they are set
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  if (callState === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl aspect-[4/3] rounded-2xl border border-white/10 bg-slate-900 overflow-hidden shadow-2xl flex flex-col justify-between p-6"
        >
          {/* Header info */}
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[10px] uppercase font-bold text-whatsapp-light tracking-widest bg-whatsapp-teal/10 border border-whatsapp-teal/20 px-2 py-0.5 rounded-full">
                🔒 E2EE {callType} Call
              </span>
              <h3 className="text-xl font-extrabold text-white mt-2">{partner?.fullName}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">@{partner?.username}</p>
            </div>
            <span className="text-xs font-semibold text-slate-400 capitalize animate-pulse">
              {callState === 'calling' && 'ringing...'}
              {callState === 'incoming' && 'incoming call...'}
              {callState === 'connected' && 'connected'}
            </span>
          </div>

          {/* Core Calling Layout Area */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {/* If connected and video type: render peer camera tags */}
            {callState === 'connected' && callType === 'video' ? (
              <div className="relative h-full w-full rounded-xl overflow-hidden bg-slate-950 border border-white/5 shadow-inner">
                {/* Remote Stream Video */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />

                {/* Local Camera stream picture-in-picture */}
                {!isCameraOff && (
                  <div className="absolute bottom-4 right-4 h-32 aspect-[4/3] rounded-lg border border-white/10 overflow-hidden bg-slate-900 shadow-lg">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover transform scale-x-[-1]"
                    />
                  </div>
                )}
              </div>
            ) : (
              // Audio call / Dialing state layouts
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <img
                    src={partner?.profilePicture || 'https://via.placeholder.com/150'}
                    alt={partner?.username}
                    className={`h-24 w-24 rounded-full object-cover border-4 border-whatsapp-teal/30 shadow-xl ${
                      callState === 'calling' || callState === 'incoming' ? 'animate-pulse' : ''
                    }`}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150'; }}
                  />
                  {callState === 'connected' && (
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white border-2 border-slate-900 shadow">
                      ✓
                    </div>
                  )}
                </div>

                {callState === 'connected' && (
                  <div className="flex items-center gap-1.5 h-6">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="w-1 bg-whatsapp-light rounded-full wave-bar"
                        style={{
                          height: `${8 + Math.random() * 14}px`,
                          animationDelay: `${idx * 0.15}s`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex justify-center items-center gap-4 z-10 mt-auto">
            {callState === 'incoming' ? (
              // Actions: accept or reject
              <div className="flex gap-4">
                <button
                  onClick={acceptCall}
                  className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95"
                >
                  <FaPhone className="text-lg" />
                </button>
                <button
                  onClick={rejectCall}
                  className="h-12 w-12 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition shadow-lg shadow-red-600/20 hover:scale-105 active:scale-95"
                >
                  <FaPhoneSlash className="text-lg" />
                </button>
              </div>
            ) : (
              // Connected / Outgoing toolbar
              <div className="flex items-center gap-4 bg-slate-950/60 border border-white/5 px-4 py-2.5 rounded-full backdrop-blur-md">
                {/* Mute Mic */}
                <button
                  onClick={toggleMute}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition ${
                    isMuted ? 'bg-red-600 text-white shadow shadow-red-600/20' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Mute microphone"
                >
                  {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                </button>

                {/* Camera Toggle */}
                {callType === 'video' && (
                  <button
                    onClick={toggleCamera}
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition ${
                      isCameraOff ? 'bg-red-600 text-white shadow shadow-red-600/20' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Camera switch"
                  >
                    {isCameraOff ? <FaVideoSlash /> : <FaVideo />}
                  </button>
                )}

                {/* Screen Sharing Toggle */}
                {callState === 'connected' && (
                  <button
                    onClick={toggleScreenShare}
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition ${
                      isScreenSharing ? 'bg-whatsapp-teal text-white shadow shadow-whatsapp-teal/20' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    title="Screen Share"
                  >
                    <FaDesktop />
                  </button>
                )}

                {/* Hang up call */}
                <button
                  onClick={endCall}
                  className="h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition shadow hover:scale-105 active:scale-95"
                  title="End call"
                >
                  <FaPhoneSlash />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
