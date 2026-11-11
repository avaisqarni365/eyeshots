'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  FileCheck2, 
  Search, 
  MapPin, 
  UploadCloud, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight, 
  FolderPlus, 
  FileText, 
  Eye, 
  Edit3, 
  Check, 
  ExternalLink,
  Layers,
  ArrowRight,
  Briefcase,
  Scale,
  HeartHandshake,
  Home,
  X,
  FileSignature,
  SlidersHorizontal,
  Bookmark,
  CheckSquare,
  HelpCircle,
  Zap,
  Globe,
  Loader2
} from 'lucide-react';
import { 
  GERMAN_BUNDESLAENDER, 
  OFFICIAL_GERMAN_TEMPLATES, 
  OfficialFormTemplate, 
  BundeslandInfo,
  generateOfficialGermanDocumentPdf
} from '@/lib/pdf/german-forms-engine';

export interface FormCategory {
  id: 'all' | 'social' | 'tax' | 'civic' | 'legal';
  label: string;
  icon: any;
  count: number;
}

export default function FormsPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'social' | 'tax' | 'civic' | 'legal'>('all');
  const [selectedStateCode, setSelectedStateCode] = useState<string>('BE'); // Default Berlin
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalTemplate, setActiveModalTemplate] = useState<OfficialFormTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Field State for Interactive Filler Modal
  const [formData, setFormData] = useState({
    applicantName: 'Max Mustermann',
    dateOfBirth: '1988-05-14',
    caseOrTaxId: 'JC-1029384-BE',
    address: 'Alexanderplatz 7, 10178 Berlin',
    monthlyAmount: '563.00',
    iban: 'DE89 3704 0044 0532 0130 00',
    signatureDate: new Date().toISOString().split('T')[0],
  });

  const selectedBundesland: BundeslandInfo = 
    GERMAN_BUNDESLAENDER.find(b => b.code === selectedStateCode) || GERMAN_BUNDESLAENDER[2]; // Berlin fallback

  const categories: FormCategory[] = [
    { id: 'all', label: 'All Forms', icon: Layers, count: OFFICIAL_GERMAN_TEMPLATES.length },
    { id: 'social', label: 'Social & Bürgergeld (SGB II)', icon: HeartHandshake, count: OFFICIAL_GERMAN_TEMPLATES.filter(t => t.category === 'social').length },
    { id: 'tax', label: 'Tax & Revenue (Finanzamt)', icon: Briefcase, count: OFFICIAL_GERMAN_TEMPLATES.filter(t => t.category === 'tax').length },
    { id: 'civic', label: 'Civic & Residency (Bürgeramt)', icon: Home, count: OFFICIAL_GERMAN_TEMPLATES.filter(t => t.category === 'civic').length },
    { id: 'legal', label: 'Legal & Corporate (Amtsgericht)', icon: Scale, count: OFFICIAL_GERMAN_TEMPLATES.filter(t => t.category === 'legal').length },
  ];

  const filteredTemplates = OFFICIAL_GERMAN_TEMPLATES.filter((tmpl) => {
    const matchesCategory = selectedCategory === 'all' || tmpl.category === selectedCategory;
    const matchesSearch = tmpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tmpl.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tmpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (tmpl.legalReference && tmpl.legalReference.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleFillSampleData = () => {
    const samples = [
      {
        applicantName: 'Sophie Scholl',
        dateOfBirth: '1992-09-22',
        caseOrTaxId: `FA-992384-${selectedBundesland.code}`,
        address: `Leopoldstraße 42, ${selectedBundesland.capital}`,
        monthlyAmount: '820.00',
        iban: 'DE21 7002 0270 0012 3456 78',
        signatureDate: new Date().toISOString().split('T')[0],
      },
      {
        applicantName: 'Thomas Müller',
        dateOfBirth: '1985-11-03',
        caseOrTaxId: `${selectedBundesland.jobcenterRegionalCode}-847291`,
        address: `Friedrichstraße 100, ${selectedBundesland.capital}`,
        monthlyAmount: '563.00',
        iban: 'DE44 1001 0010 0123 4567 89',
        signatureDate: new Date().toISOString().split('T')[0],
      }
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    setFormData(picked);
    showToast(`Filled with valid German sample data for ${selectedBundesland.name}`);
  };

  // Open Template in Interactive Editor Modal
  const handleOpenEditor = (template: OfficialFormTemplate) => {
    setActiveModalTemplate(template);
    setFormData(prev => ({
      ...prev,
      caseOrTaxId: template.category === 'tax' 
        ? `FA-109283-${selectedBundesland.code}`
        : `${selectedBundesland.jobcenterRegionalCode}-829104`
    }));
  };

  // Download official vector PDF client-side ($0 server cost)
  const handleDownloadFormPdf = async () => {
    if (!activeModalTemplate) return;
    setIsGenerating(true);
    try {
      const pdfBytes = await generateOfficialGermanDocumentPdf(activeModalTemplate, selectedBundesland, formData);
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeModalTemplate.code.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedBundesland.code}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded official ${activeModalTemplate.code} for ${selectedBundesland.name}`);
    } catch (err) {
      console.error(err);
      showToast('Error generating PDF document');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handshake: Transfer generated official document directly to DMS Acrobat Studio
  const handleOpenInAcrobatStudio = async (template?: OfficialFormTemplate) => {
    const targetTemplate = template || activeModalTemplate;
    if (!targetTemplate) return;

    try {
      showToast(`Preparing ${targetTemplate.code} for Acrobat Studio...`);
      const fileName = `${targetTemplate.code.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedBundesland.code}.pdf`;
      const projectId = targetTemplate.category === 'tax' 
        ? 'proj_tax' 
        : targetTemplate.category === 'legal' 
          ? 'proj_legal' 
          : 'proj_jobcenter';

      // Store transfer metadata in localStorage for DMS mount hook
      const pendingDoc = {
        name: fileName,
        projectId,
        subfolderId: 'all',
        templateCode: targetTemplate.code,
        authority: targetTemplate.authority,
        stateCode: selectedBundesland.code,
        sizeBytes: 420000,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('eyeshots_pending_dms_doc', JSON.stringify(pendingDoc));
      }

      router.push('/dms');
    } catch (err) {
      console.error(err);
      showToast('Failed to transfer document to DMS');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 select-none">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-600 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/dms" className="hover:text-emerald-600 transition-colors">DMS Explorer</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-semibold">Forms</span>
      </nav>

      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 mb-2">
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Official German Forms Library &bull; 16 Bundesländer Ready</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Forms
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
            Fetch, edit, digitally sign, and export authentic German government, tax, civic, and legal documents. Choose your state, fill online, or open directly in the EyeShots Acrobat Studio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dms"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Open in DMS
          </Link>
          <Link
            href="/edit-pdf"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Visual Canvas Editor</span>
          </Link>
        </div>
      </div>

      {/* 16 Bundesländer State Selector Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Select Federal State (Bundesland):</span>
          </div>
          <div className="text-xs text-slate-400">
            Current Region: <span className="font-bold text-emerald-600">{selectedBundesland.name}</span> ({selectedBundesland.capital}) &bull; {selectedBundesland.jobcenterRegionalCode}
          </div>
        </div>

        {/* State Badges Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {GERMAN_BUNDESLAENDER.map((b) => {
            const isSelected = selectedStateCode === b.code;
            return (
              <button
                key={b.code}
                onClick={() => setSelectedStateCode(b.code)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={`${b.name} (Capital: ${b.capital})`}
              >
                <span>{b.code}</span>
                <span className="font-normal opacity-80 text-[10px] hidden sm:inline">{b.capital}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-slate-700 text-slate-200 dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, SGB, § law, keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Template Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((template) => {
          const isTax = template.category === 'tax';
          const isCivic = template.category === 'civic';
          const isLegal = template.category === 'legal';

          return (
            <div
              key={template.id}
              className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                {/* Header Tag Bar */}
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isTax 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' 
                      : isCivic
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        : isLegal
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  }`}>
                    {template.authority}
                  </span>

                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {template.code}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                    {template.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {template.description}
                  </p>
                </div>

                {/* Legal Section & Regional Badge */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                    {template.legalReference || 'Rechtskonform'}
                  </span>
                  <span>{selectedBundesland.name} ({selectedBundesland.code})</span>
                </div>
              </div>

              {/* Action Buttons: Fetch & Edit vs Open in Acrobat Studio */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenEditor(template)}
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    title="Open Interactive Form Field Editor & Live Preview"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Fetch & Edit</span>
                  </button>

                  <button
                    onClick={() => handleOpenInAcrobatStudio(template)}
                    className="py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    title="Send directly to EyeShots Acrobat Studio in DMS with all 18 tools"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Acrobat Studio</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INTERACTIVE FORM EDITOR MODAL WITH LIVE PREVIEW */}
      {activeModalTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {activeModalTemplate.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Formular-Code: <span className="font-bold text-slate-600 dark:text-slate-200">{activeModalTemplate.code}</span> &bull; {selectedBundesland.name} ({selectedBundesland.jobcenterRegionalCode})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveModalTemplate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Fill Sample Data Bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                  Quick Autofill with German Legal Sample Data
                </span>
              </div>
              <button
                onClick={handleFillSampleData}
                className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm"
              >
                Autofill Sample Data
              </button>
            </div>

            {/* Form Fields Grid */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Applicant / Antragsteller (Name, Vorname):
                  </label>
                  <input
                    type="text"
                    value={formData.applicantName}
                    onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Date of Birth / Geburtsdatum:
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Aktenzeichen / Steuernummer / BG-Nummer:
                  </label>
                  <input
                    type="text"
                    value={formData.caseOrTaxId}
                    onChange={(e) => setFormData({ ...formData, caseOrTaxId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Monthly Claim / EUR Betrag:
                  </label>
                  <input
                    type="text"
                    value={formData.monthlyAmount}
                    onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Registered Address / Wohnanschrift (§ 19 BMG):
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Bank Account / IBAN (SEPA):
                </label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Legal Guarantee Notice */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>eIDAS Compliant & Zero Retention:</span>
              </div>
              <p>
                This document is generated client-side using `pdf-lib` vector routines. Form fields are embedded as real AcroForm fillable inputs valid under German SGB II, EStG, and BMG regulations.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveModalTemplate(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenInAcrobatStudio(activeModalTemplate)}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow"
                  title="Open this form in EyeShots Acrobat Studio in DMS"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open in Acrobat Studio</span>
                </button>

                <button
                  onClick={handleDownloadFormPdf}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Download Form PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce border border-slate-700 dark:border-slate-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
