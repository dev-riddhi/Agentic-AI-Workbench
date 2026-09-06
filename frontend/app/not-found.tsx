"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bot, Sparkles, ArrowRight, ShieldCheck, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full bg-[#050508] text-white flex flex-col justify-between overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Starfield Particles */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/5 w-1 h-1 bg-white rounded-full opacity-60 animate-ping" />
        <div className="absolute top-1/3 left-1/2 w-1.5 h-1.5 bg-yellow-200 rounded-full opacity-75 animate-pulse" />
        <div className="absolute top-2/3 left-1/6 w-1 h-1 bg-cyan-300 rounded-full opacity-50" />
        <div className="absolute top-3/4 left-3/4 w-1 h-1 bg-pink-300 rounded-full opacity-60 animate-ping" />
        <div className="absolute top-1/5 right-1/4 w-2 h-2 bg-yellow-100 rounded-full opacity-80 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-white rounded-full opacity-40" />
        <div className="absolute top-12 left-1/3 w-1 h-1 bg-violet-300 rounded-full opacity-70" />
      </div>

      {/* Top Cosmic Navigation Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400 shadow-[0_0_15px_-2px_rgba(6,182,212,0.3)] transition-all">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white text-base">
              Agentic<span className="text-cyan-400">Workbench</span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Sovereign Local AI
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <Link href="/agents" className="hover:text-white transition-colors">
            Agents
          </Link>
          <Link href="/models" className="hover:text-white transition-colors">
            Models
          </Link>
          <Link href="/documents" className="hover:text-white transition-colors">
            Knowledge
          </Link>
          <Link href="/runtime" className="hover:text-white transition-colors">
            Runtime
          </Link>
        </nav>

        {/* Top Right Action Pill */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium text-zinc-200 border border-violet-500/40 hover:border-cyan-400/60 bg-zinc-950/60 hover:bg-zinc-900 shadow-[0_0_16px_-2px_rgba(139,92,246,0.25)] hover:shadow-[0_0_20px_-2px_rgba(6,182,212,0.4)] transition-all duration-200 backdrop-blur-md"
        >
          <span>Enter Console</span>
          <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
        </Link>
      </header>

      {/* Main 404 Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Column: 404 Typography & Action */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl"
        >
          {/* Big 404 Header */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-[0.2em] uppercase text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.2)]">
            404-error
          </h1>

          {/* Subtitle */}
          <h2 className="text-xl sm:text-2xl font-bold tracking-widest uppercase text-zinc-200 mt-4 mb-3">
            PAGE NOT FOUND
          </h2>

          {/* Description */}
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
            Your search has ventured beyond the known universe. The coordinate or telemetry route you requested does not exist within the sovereign perimeter.
          </p>

          {/* Pill Action Button matching the attached design */}
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-8 py-3 rounded-full text-sm font-semibold text-zinc-100 bg-zinc-950/80 border border-violet-500/50 hover:border-cyan-400 shadow-[0_0_22px_-2px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_-1px_rgba(6,182,212,0.5)] transition-all duration-200 backdrop-blur-md tracking-wide"
            >
              Back To Home
            </Link>
          </motion.div>

          {/* Diagnostic badge */}
          <div className="flex items-center gap-2 mt-8 text-xs font-mono text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Air-Gapped Sovereign Node: 127.0.0.1 (0.0 KB Egress)</span>
          </div>
        </motion.div>

        {/* Right Column: Floating Astronaut in Deep Cosmic Nebula */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 relative flex items-center justify-center w-full max-w-md lg:max-w-lg"
        >
          {/* Deep Nebula Cosmic Glow Sphere */}
          <div className="absolute w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-gradient-to-tr from-cyan-600/30 via-indigo-600/25 to-purple-600/20 blur-3xl pointer-events-none animate-pulse-slow" />

          {/* Floating Weightless Astronaut */}
          <motion.div
            animate={{
              y: [-12, 14, -12],
              rotate: [-2.5, 3, -2.5],
            }}
            transition={{
              repeat: Infinity,
              duration: 7,
              ease: "easeInOut",
            }}
            className="relative z-10 w-72 sm:w-88 h-72 sm:h-88 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800/40 backdrop-blur-sm"
          >
            <Image
              src="/images/astronaut-404.jpg"
              alt="Astronaut reading in deep space - Page Not Found"
              fill
              priority
              className="object-cover"
            />
          </motion.div>

          {/* Additional Floating Cosmic Asteroids / Stars */}
          <motion.div
            animate={{ y: [6, -10, 6], rotate: [0, 45, 0] }}
            transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
            className="absolute -top-4 -right-4 w-10 h-10 rounded-xl bg-zinc-900/60 border border-violet-500/30 backdrop-blur-md flex items-center justify-center shadow-lg"
          >
            <Compass className="w-5 h-5 text-cyan-400" />
          </motion.div>

          <motion.div
            animate={{ y: [-8, 8, -8], rotate: [0, -30, 0] }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
            className="absolute -bottom-4 -left-4 w-9 h-9 rounded-xl bg-zinc-900/60 border border-pink-500/30 backdrop-blur-md flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-600 border-t border-zinc-900/80">
        <div>&copy; 2026 Sovereign Agentic AI Workbench</div>
        <div className="flex items-center gap-4">
          <Link href="/agents" className="hover:text-zinc-400 transition-colors">
            Fleet Overview
          </Link>
          <span>&bull;</span>
          <Link href="/runtime" className="hover:text-zinc-400 transition-colors">
            System Diagnostics
          </Link>
        </div>
      </footer>
    </div>
  );
}
