'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

export function HeroPass() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Mouse tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for the tilt
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  // Map mouse position to tilt angles (max 10 degrees)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-10, 10]);

  // Shadow moves opposite to the tilt
  const shadowX = useTransform(mouseXSpring, [-0.5, 0.5], [20, -20]);
  const shadowY = useTransform(mouseYSpring, [-0.5, 0.5], [20, -20]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || prefersReducedMotion) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Normalize mouse position between -0.5 and 0.5
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Idle floating animation
  const idleY = {
    initial: { y: 0 },
    animate: { y: [-5, 5, -5] }
  };

  const idleRotate = {
    initial: { rotateZ: 0 },
    animate: { rotateZ: [-1, 1, -1] }
  };

  return (
    <div 
      className="relative w-full max-w-[320px] flex items-center justify-center py-4 mx-auto"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1200 }}
    >
      {/* Container for idle animation */}
      <motion.div
        className="relative flex items-center justify-center w-full"
        initial={prefersReducedMotion ? "initial" : "initial"}
        animate={prefersReducedMotion ? "initial" : "animate"}
        variants={idleY}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <motion.div
          variants={idleRotate}
          transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
          className="relative flex items-center justify-center"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Ambient shadow layer */}
          <motion.div 
            className="absolute inset-0 bg-[#3b096b]/30 rounded-3xl blur-[30px]"
            style={{ 
              x: prefersReducedMotion ? 0 : shadowX,
              y: prefersReducedMotion ? 0 : shadowY,
              translateZ: -50,
              width: 300,
              height: 520
            }}
          />

          {/* Card face */}
          <motion.div
            ref={ref}
            className="relative w-75 h-110 rounded-3xl shadow-2xl transition-all duration-300 ease-out"
            style={{ 
              rotateX: prefersReducedMotion ? 0 : rotateX, 
              rotateY: prefersReducedMotion ? 0 : rotateY,
              transformStyle: "preserve-3d"
            }}
          >
            {/* The physical card layer */}
            <div className="absolute inset-0 flex flex-col bg-zinc-900 rounded-3xl overflow-hidden border border-white/10">
              
              {/* Header Section (Purple) */}
              <div className="bg-linear-to-br from-[#3b096b] to-[#1e0338] px-6 py-6 flex flex-col justify-between h-47.5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border border-white/20 bg-[#a15e21] flex items-center justify-center shadow-inner overflow-hidden">
                     <span className="text-[7px] text-white font-medium text-center leading-tight">BeanHouse<br/>Logo</span>
                  </div>
                  <span className="font-semibold text-white tracking-tight">BeanHouse Coffee</span>
                </div>
                
                <div className="mt-4">
                  <div className="text-white/70 text-xs font-medium mb-0.5">Gold</div>
                  <div className="text-2xl font-medium tracking-tight text-white">Dhyan Patel</div>
                </div>
              </div>

              {/* Stats Section (Dark Gray) */}
              <div className="bg-[#242424] px-6 py-4 flex gap-12 border-b border-black/30">
                <div>
                  <div className="text-[#a1a1aa] text-[11px] font-medium mb-1">Points</div>
                  <div className="text-white font-medium">500</div>
                </div>
                <div>
                  <div className="text-[#a1a1aa] text-[11px] font-medium mb-1">Tier</div>
                  <div className="text-white font-medium">Gold</div>
                </div>
              </div>

              {/* QR Section (White) */}
              <div className="bg-white px-6 py-8 flex flex-col items-center justify-center flex-1">
                 <QRCodeSVG 
                   value="https://linearcard.com/p/demo" 
                   size={160} 
                   level="H" 
                   includeMargin={false}
                 />
              </div>

              {/* Bottom Image Section */}
              <div className="h-22.5 bg-[#3d2314] relative">
                <div 
                  className="absolute inset-0 mix-blend-overlay opacity-80"
                  style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=600&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              </div>
            </div>

            {/* 3D Glass / Reflection Overlays */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/50 to-transparent opacity-60 z-10" />
            <div className="absolute inset-0 rounded-3xl border border-white/5 pointer-events-none z-10" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
