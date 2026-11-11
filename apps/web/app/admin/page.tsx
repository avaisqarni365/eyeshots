'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  CreditCard, 
  Cpu, 
  Key, 
  ShieldCheck, 
  Server, 
  Activity, 
  CheckCircle2, 
  Zap, 
  ChevronRight, 
  TrendingUp, 
  Database,
  ArrowUpRight,
  HardDrive
} from 'lucide-react';

export default function CentralAdminPage() {
  const [plans, setPlans] = useState([
    { id: 'free', name: 'Free Privacy Sandbox', price: '$0', users: 1420, quota: '25 MB / file', apiAccess: 'Disabled' },
    { id: 'pro', name: 'Professional Individual', price: '$12/mo', users: 485, quota: '200 MB / file', apiAccess: 'Enabled (1k/hr)' },
    { id: 'team', name: 'Enterprise Legal & Accounting', price: '$49/mo', users: 112, quota: '1 GB / file', apiAccess: 'Enabled (Unlimited)' },
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-600">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dms" className="hover:text-emerald-600">DMS</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Central Admin</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200 dark:border-purple-800/60 mb-2">
            <Server className="w-3.5 h-3.5 text-purple-500" />
            Cluster Node Orchestrator &bull; Centralized Subscription Control
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Central Admin & Subscription Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
            Monitor cluster health, manage subscription plans and pricing, and oversee B2B accounting and legal API keys.
          </p>
        </div>

        <Link
          href="/dms"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Return to DMS</span>
        </Link>
      </div>

      {/* Cluster Health & Revenue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Monthly Recurring (MRR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">$11,348</div>
          <p className="text-[11px] text-emerald-600 font-semibold">+18.2% from last month</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Active Subscribers</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">2,017</div>
          <p className="text-[11px] text-slate-400">112 Enterprise Accounting & Legal</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Cluster Node Health</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">6 / 6 Online</div>
          <p className="text-[11px] text-slate-400">Avg CPU: 18.4% &bull; RAM: 1.4 GB</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px]">B2B API Keys Issued</span>
            <Key className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">238</div>
          <p className="text-[11px] text-purple-600 font-semibold">ERP & Accounting Gateways</p>
        </div>
      </div>

      {/* Subscription Plans Management */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Subscription Tiers & Quota Policies
            </h3>
            <p className="text-xs text-slate-400">
              Configure file size limits, API gateway rate limits, and monthly pricing.
            </p>
          </div>
          <button
            onClick={() => alert('Plan editor open')}
            className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold hover:bg-slate-50"
          >
            Edit Plans
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {plans.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">{p.name}</h4>
                  <div className="text-xl font-extrabold text-emerald-600 mt-1">{p.price}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold">
                  {p.users} users
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-500 border-t pt-3">
                <div className="flex justify-between">
                  <span>Upload Limit:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{p.quota}</span>
                </div>
                <div className="flex justify-between">
                  <span>B2B API Access:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{p.apiAccess}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
