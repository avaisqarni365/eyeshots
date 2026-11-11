'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  FolderPlus, 
  FileText, 
  Search, 
  Plus, 
  Folder, 
  FolderOpen,
  Clock, 
  ShieldCheck, 
  Tag, 
  MoreVertical, 
  Edit3, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Mic, 
  Play, 
  Languages, 
  Share2, 
  Layers, 
  Briefcase,
  Lock,
  ArrowUp,
  ArrowDown,
  Copy,
  Scissors,
  Clipboard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GripVertical,
  LayoutGrid,
  List,
  FileCheck2,
  Building2,
  HardDrive,
  RefreshCw,
  UploadCloud,
  FileCode,
  File,
  Eye,
  CornerDownRight,
  Sparkles,
  CopyPlus,
  FileEdit,
  X,
  Check,
  SlidersHorizontal,
  Settings2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { AcrobatPdfStudio } from '@/components/dms/AcrobatPdfStudio';
import { FileDropzone } from '@/components/FileDropzone';

export interface DMSFile {
  id: string;
  name: string;
  projectId: string;
  subfolderId: string; // 'root' or specific category subfolder id
  type: 'pdf' | 'form' | 'markdown' | 'scan';
  sizeBytes: number;
  status: 'Draft' | 'Signed' | 'Verified' | 'Amt-Bereit';
  voiceNotesCount: number;
  order: number;
  lastModified: string;
}

export interface DMSSubfolder {
  id: string;
  name: string;
  projectId: string;
}

export interface DMSProject {
  id: string;
  name: string;
  description: string;
  category: 'accounting' | 'legal' | 'jobcenter' | 'general';
  isVaulted: boolean;
  subfolders: DMSSubfolder[];
  createdAt: string;
}

const INITIAL_PROJECTS: DMSProject[] = [
  {
    id: 'proj_jobcenter',
    name: 'Jobcenter Berlin - Bürgergeld 2026',
    description: 'SGB II Erstantrag, Weiterbewilligung, Mietbescheinigung & Nachweise',
    category: 'jobcenter',
    isVaulted: false,
    createdAt: '2026-11-01',
    subfolders: [
      { id: 'sub_ha', name: '01_Hauptantrag_HA', projectId: 'proj_jobcenter' },
      { id: 'sub_kdu', name: '02_Kosten_der_Unterkunft_KdU', projectId: 'proj_jobcenter' },
      { id: 'sub_nachweise', name: '03_Einkommensnachweise_Kontoauszuege', projectId: 'proj_jobcenter' },
      { id: 'sub_bescheide', name: '04_Bewilligungsbescheide', projectId: 'proj_jobcenter' },
    ],
  },
  {
    id: 'proj_tax',
    name: 'Finanzamt München - Steuererklärung 2026',
    description: 'Einkommensteuer ESt 1 A, Anlage N, Rechnungen & Belege',
    category: 'accounting',
    isVaulted: false,
    createdAt: '2026-10-28',
    subfolders: [
      { id: 'sub_steuer', name: '01_Steuererklaerung_Formulare', projectId: 'proj_tax' },
      { id: 'sub_rechnungen', name: '02_Ausgaben_Rechnungen_Belege', projectId: 'proj_tax' },
      { id: 'sub_bank', name: '03_Bankauszuege_Jahresabschluss', projectId: 'proj_tax' },
    ],
  },
  {
    id: 'proj_legal',
    name: 'Court Discovery Case #402 - Corporate NDA',
    description: 'Litigation exhibits with Bates numbering and cryptographic signatures',
    category: 'legal',
    isVaulted: true,
    createdAt: '2026-10-15',
    subfolders: [
      { id: 'sub_exhibits', name: 'Exhibits_A_Through_F', projectId: 'proj_legal' },
      { id: 'sub_transcripts', name: 'Deposition_Transcripts', projectId: 'proj_legal' },
    ],
  },
];

const INITIAL_FILES: DMSFile[] = [
  // Jobcenter Project
  { id: 'f1', name: 'Hauptantrag_HA_Buergergeld_Ausgefuellt.pdf', projectId: 'proj_jobcenter', subfolderId: 'sub_ha', type: 'form', sizeBytes: 1420000, status: 'Amt-Bereit', voiceNotesCount: 2, order: 1, lastModified: 'Heute 10:15' },
  { id: 'f2', name: 'Anlage_WBA_Weiterbewilligung_Entwurf.pdf', projectId: 'proj_jobcenter', subfolderId: 'sub_ha', type: 'form', sizeBytes: 980000, status: 'Draft', voiceNotesCount: 0, order: 2, lastModified: 'Gestern' },
  { id: 'f3', name: 'Anlage_KdU_Mietbescheinigung_Vermieter.pdf', projectId: 'proj_jobcenter', subfolderId: 'sub_kdu', type: 'pdf', sizeBytes: 850000, status: 'Verified', voiceNotesCount: 1, order: 1, lastModified: 'Heute 11:30' },
  { id: 'f4', name: 'Heizkostenabrechnung_2025_Gas.pdf', projectId: 'proj_jobcenter', subfolderId: 'sub_kdu', type: 'scan', sizeBytes: 2100000, status: 'Verified', voiceNotesCount: 0, order: 2, lastModified: 'Vor 2 Tagen' },
  { id: 'f5', name: 'Kontoauszuege_Letzte_3_Monate_Gezwaerzt.pdf', projectId: 'proj_jobcenter', subfolderId: 'sub_nachweise', type: 'pdf', sizeBytes: 3400000, status: 'Verified', voiceNotesCount: 1, order: 1, lastModified: 'Gestern 16:40' },
  { id: 'f6', name: 'Erklaerung_Unterkunft_Jobcenter.md', projectId: 'proj_jobcenter', subfolderId: 'sub_kdu', type: 'markdown', sizeBytes: 24000, status: 'Draft', voiceNotesCount: 0, order: 3, lastModified: 'Heute 09:20' },

  // Tax Project
  { id: 'f7', name: 'ESt_1_A_Mantelbogen_2026.pdf', projectId: 'proj_tax', subfolderId: 'sub_steuer', type: 'form', sizeBytes: 1200000, status: 'Amt-Bereit', voiceNotesCount: 1, order: 1, lastModified: 'Gestern 14:00' },
  { id: 'f8', name: 'Anlage_N_Homeoffice_Werbungskosten.pdf', projectId: 'proj_tax', subfolderId: 'sub_steuer', type: 'form', sizeBytes: 740000, status: 'Draft', voiceNotesCount: 0, order: 2, lastModified: 'Gestern 15:30' },
  { id: 'f9', name: 'Hardware_Kaufbeleg_Laptop_Monitor.pdf', projectId: 'proj_tax', subfolderId: 'sub_rechnungen', type: 'scan', sizeBytes: 620000, status: 'Verified', voiceNotesCount: 0, order: 1, lastModified: '28. Okt' },

  // Legal Project
  { id: 'f10', name: 'Exhibit_A_Signed_Mutual_NDA_Bates_0001.pdf', projectId: 'proj_legal', subfolderId: 'sub_exhibits', type: 'pdf', sizeBytes: 4200000, status: 'Signed', voiceNotesCount: 3, order: 1, lastModified: '15. Okt' },
  { id: 'f11', name: 'Exhibit_B_Audit_Trail_Certificate.pdf', projectId: 'proj_legal', subfolderId: 'sub_exhibits', type: 'pdf', sizeBytes: 890000, status: 'Verified', voiceNotesCount: 1, order: 2, lastModified: '16. Okt' },
];

export default function CompleteDmsWindowsExplorer() {
  const [projects, setProjects] = useState<DMSProject[]>(INITIAL_PROJECTS);
  const [files, setFiles] = useState<DMSFile[]>(INITIAL_FILES);

  // Active navigation state
  const [activeProjectId, setActiveProjectId] = useState<string>('proj_jobcenter');
  const [activeSubfolderId, setActiveSubfolderId] = useState<string>('all'); // 'all' or subfolderId
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    proj_jobcenter: true,
    proj_tax: true,
    proj_legal: true,
  });

  // Windows Explorer View & Search
  const [viewMode, setViewMode] = useState<'details' | 'grid' | 'large'>('details');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Clipboard (Copy / Cut / Paste)
  const [clipboard, setClipboard] = useState<{
    fileId: string;
    action: 'copy' | 'cut';
  } | null>(null);

  // Rename Modal State
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState<string>('');

  // Customize & Operations Toolbar State
  const [showOperationsToolbar, setShowOperationsToolbar] = useState<boolean>(true);

  // Acrobat PDF Studio State (Right Side)
  const [studioViewMode, setStudioViewMode] = useState<'studio' | 'inspector'>('studio');
  const [isStudioMaximized, setIsStudioMaximized] = useState<boolean>(false);

  // Dynamic Splitter & Pane Width State (3 Resizable Windows)
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(270); // px, min 170, max 450
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(560); // px, min 380, max 850
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [activeSplitter, setActiveSplitter] = useState<'left' | 'right' | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Edit Document Modal State
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editTargetFile, setEditTargetFile] = useState<DMSFile | null>(null);
  const [editFormState, setEditFormState] = useState<{
    name: string;
    status: DMSFile['status'];
    subfolderId: string;
    type: DMSFile['type'];
  }>({
    name: '',
    status: 'Draft',
    subfolderId: 'root',
    type: 'pdf',
  });

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag and drop state for Center Explorer
  const [isExplorerDragging, setIsExplorerDragging] = useState(false);
  const explorerDragCounter = useRef(0);
  const [dropHoverSubfolderId, setDropHoverSubfolderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Mouse drag handler for dynamic horizontal pane resizing
  useEffect(() => {
    if (!activeSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();

      if (activeSplitter === 'left') {
        const newLeft = e.clientX - rect.left;
        const maxLeft = Math.min(480, rect.width - (selectedFileId ? 520 : 300));
        const clamped = Math.max(170, Math.min(maxLeft, newLeft));
        setLeftPaneWidth(clamped);
      } else if (activeSplitter === 'right') {
        const newRight = rect.right - e.clientX;
        const currentLeft = isLeftCollapsed ? 40 : leftPaneWidth;
        const maxRight = Math.min(850, rect.width - currentLeft - 280);
        const clamped = Math.max(380, Math.min(maxRight, newRight));
        setRightPaneWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      setActiveSplitter(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [activeSplitter, selectedFileId, isLeftCollapsed, leftPaneWidth]);

  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeSubfolder = activeProject?.subfolders.find((s) => s.id === activeSubfolderId);

  // Filter & sort files
  const displayedFiles = files
    .filter((f) => {
      const matchProject = f.projectId === activeProjectId;
      const matchSubfolder = activeSubfolderId === 'all' || f.subfolderId === activeSubfolderId;
      const matchSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchProject && matchSubfolder && matchSearch;
    })
    .sort((a, b) => a.order - b.order);

  const selectedFile = files.find((f) => f.id === selectedFileId);

  // Expand / collapse tree project
  const toggleProjectExpand = (projId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projId]: !prev[projId] }));
  };

  // 1. PROJECT OPERATIONS
  const handleAddProject = () => {
    const name = prompt('Project Name (e.g. Jobcenter Bürgergeld 2026, Tax Year 2026):', 'Neues Projekt');
    if (!name) return;
    const newProj: DMSProject = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name,
      description: 'Custom document workspace',
      category: 'general',
      isVaulted: false,
      createdAt: new Date().toISOString().split('T')[0],
      subfolders: [
        { id: 'sub_' + Math.random().toString(36).substring(2, 7), name: '01_Allgemein', projectId: '' },
      ],
    };
    newProj.subfolders[0].projectId = newProj.id;
    setProjects([newProj, ...projects]);
    setActiveProjectId(newProj.id);
    setActiveSubfolderId('all');
  };

  const handleRenameProject = (projId: string) => {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;
    const newName = prompt('Rename Project:', proj.name);
    if (newName && newName.trim()) {
      setProjects(projects.map((p) => (p.id === projId ? { ...p, name: newName.trim() } : p)));
    }
  };

  const handleDeleteProject = (projId: string) => {
    if (confirm('Delete this project and all its subfolders and documents?')) {
      setProjects(projects.filter((p) => p.id !== projId));
      setFiles(files.filter((f) => f.projectId !== projId));
      if (activeProjectId === projId) {
        const remaining = projects.filter((p) => p.id !== projId);
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
          setActiveSubfolderId('all');
        }
      }
    }
  };

  // 2. SUBFOLDER (CATEGORY) OPERATIONS
  const handleAddSubfolder = () => {
    const name = prompt('Category Folder Name (e.g. 01_Hauptantrag, Rechnungen, KdU):', 'Neuer Ordner');
    if (!name) return;
    const newSub: DMSSubfolder = {
      id: 'sub_' + Math.random().toString(36).substring(2, 8),
      name: name.trim(),
      projectId: activeProjectId,
    };
    setProjects(
      projects.map((p) => (p.id === activeProjectId ? { ...p, subfolders: [...p.subfolders, newSub] } : p))
    );
    setActiveSubfolderId(newSub.id);
  };

  const handleRenameSubfolder = (subId: string) => {
    const sub = activeProject.subfolders.find((s) => s.id === subId);
    if (!sub) return;
    const newName = prompt('Rename Category Folder:', sub.name);
    if (newName && newName.trim()) {
      setProjects(
        projects.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                subfolders: p.subfolders.map((s) => (s.id === subId ? { ...s, name: newName.trim() } : s)),
              }
            : p
        )
      );
    }
  };

  const handleDeleteSubfolder = (subId: string) => {
    if (confirm('Delete category folder? Documents inside will be moved to project root.')) {
      setProjects(
        projects.map((p) =>
          p.id === activeProjectId
            ? { ...p, subfolders: p.subfolders.filter((s) => s.id !== subId) }
            : p
        )
      );
      setFiles(files.map((f) => (f.subfolderId === subId ? { ...f, subfolderId: 'root' } : f)));
      if (activeSubfolderId === subId) setActiveSubfolderId('all');
    }
  };

  // 3. DOCUMENT ORDER OPERATIONS (Move Up / Down)
  const moveFileOrder = (fileId: string, direction: 'up' | 'down') => {
    const list = [...displayedFiles];
    const index = list.findIndex((f) => f.id === fileId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === list.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentFile = list[index];
    const targetFile = list[targetIndex];

    const currentOrder = currentFile.order;
    currentFile.order = targetFile.order;
    targetFile.order = currentOrder;

    setFiles([...files]);
  };

  // 4. WINDOWS CLIPBOARD (COPY, CUT, PASTE)
  const handleCopyFile = (fileId: string) => {
    setClipboard({ fileId, action: 'copy' });
  };

  const handleCutFile = (fileId: string) => {
    setClipboard({ fileId, action: 'cut' });
  };

  const handlePasteFile = () => {
    if (!clipboard) return;
    const sourceFile = files.find((f) => f.id === clipboard.fileId);
    if (!sourceFile) return;

    const targetSubfolder = activeSubfolderId === 'all' ? (activeProject.subfolders[0]?.id || 'root') : activeSubfolderId;

    if (clipboard.action === 'cut') {
      // Move file to current project & subfolder
      setFiles(
        files.map((f) =>
          f.id === clipboard.fileId
            ? { ...f, projectId: activeProjectId, subfolderId: targetSubfolder }
            : f
        )
      );
      setClipboard(null);
    } else {
      // Copy: duplicate file in current location
      const newFile: DMSFile = {
        ...sourceFile,
        id: 'f_' + Math.random().toString(36).substring(2, 9),
        name: 'Copy_of_' + sourceFile.name,
        projectId: activeProjectId,
        subfolderId: targetSubfolder,
        order: files.length + 1,
        lastModified: 'Gerade eben',
      };
      setFiles([...files, newFile]);
      setSelectedFileId(newFile.id);
    }
  };

  // 5. UPLOAD TO CURRENT FOLDER
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const uploaded = Array.from(e.target.files);
    const targetSubfolder = activeSubfolderId === 'all' ? (activeProject.subfolders[0]?.id || 'root') : activeSubfolderId;

    const newDocs: DMSFile[] = uploaded.map((f, idx) => ({
      id: 'f_' + Math.random().toString(36).substring(2, 9),
      name: f.name,
      projectId: activeProjectId,
      subfolderId: targetSubfolder,
      type: f.name.endsWith('.md') ? 'markdown' : f.name.includes('scan') ? 'scan' : 'pdf',
      sizeBytes: f.size,
      status: 'Draft',
      voiceNotesCount: 0,
      order: files.length + idx + 1,
      lastModified: 'Gerade eben',
    }));

    setFiles([...files, ...newDocs]);
    if (newDocs.length > 0) setSelectedFileId(newDocs[0].id);
  };

  // Drag & Drop handler for adding files directly to a folder
  const handleDropFiles = (droppedFiles: File[], targetFolderId?: string) => {
    const valid = droppedFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') || f.name.endsWith('.md') || f.name.endsWith('.doc') || f.name.endsWith('.docx')
    );
    if (valid.length === 0) {
      showToast('Please drop valid PDF or document files.');
      return;
    }
    const targetSub = targetFolderId || (activeSubfolderId === 'all' ? (activeProject.subfolders[0]?.id || 'root') : activeSubfolderId);
    const newDocs: DMSFile[] = valid.map((f, idx) => ({
      id: 'f_' + Math.random().toString(36).substring(2, 9),
      name: f.name,
      projectId: activeProjectId,
      subfolderId: targetSub,
      type: f.name.endsWith('.md') ? 'markdown' : f.name.includes('scan') ? 'scan' : 'pdf',
      sizeBytes: f.size,
      status: 'Draft',
      voiceNotesCount: 0,
      order: files.length + idx + 1,
      lastModified: 'Just now',
    }));

    setFiles((prev) => [...prev, ...newDocs]);
    if (newDocs.length > 0) setSelectedFileId(newDocs[0].id);
    showToast(`Added ${newDocs.length} dropped document(s) to folder`);
  };

  const handleDeleteFile = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (confirm(`Delete document "${file?.name || fileId}"?`)) {
      setFiles(files.filter((f) => f.id !== fileId));
      if (selectedFileId === fileId) setSelectedFileId(null);
      showToast('Document deleted');
    }
  };

  // 6. RENAME DOCUMENT OPERATION
  const handleStartRename = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    setRenameTargetId(fileId);
    setRenameInputValue(file.name);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = () => {
    if (!renameTargetId || !renameInputValue.trim()) return;
    const trimmed = renameInputValue.trim();
    setFiles(
      files.map((f) =>
        f.id === renameTargetId ? { ...f, name: trimmed, lastModified: 'Just now' } : f
      )
    );
    setRenameModalOpen(false);
    showToast(`Renamed to "${trimmed}"`);
  };

  // 7. DUPLICATE DOCUMENT OPERATION
  const handleDuplicateFile = (fileId: string) => {
    const target = files.find((f) => f.id === fileId);
    if (!target) return;

    // Smart duplicate naming: 'Document.pdf' -> 'Document_Copy.pdf' or 'Document_Copy_2.pdf'
    let newName = '';
    const lastDotIndex = target.name.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const base = target.name.substring(0, lastDotIndex);
      const ext = target.name.substring(lastDotIndex);
      if (base.includes('_Copy')) {
        const match = base.match(/_Copy_(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10) + 1;
          newName = base.replace(/_Copy_\d+$/, `_Copy_${num}`) + ext;
        } else {
          newName = `${base}_2${ext}`;
        }
      } else {
        newName = `${base}_Copy${ext}`;
      }
    } else {
      newName = `${target.name}_Copy`;
    }

    const newFile: DMSFile = {
      ...target,
      id: 'f_' + Math.random().toString(36).substring(2, 9),
      name: newName,
      status: target.status === 'Signed' ? 'Draft' : target.status,
      order: target.order + 1,
      lastModified: 'Just now',
    };

    const targetIdx = files.findIndex((f) => f.id === fileId);
    const updatedFiles = [...files];
    updatedFiles.splice(targetIdx + 1, 0, newFile);

    setFiles(updatedFiles);
    setSelectedFileId(newFile.id);
    showToast(`Duplicated as "${newName}"`);
  };

  // 8. EDIT DOCUMENT & METADATA OPERATION
  const handleOpenEditModal = (fileId: string) => {
    const target = files.find((f) => f.id === fileId);
    if (!target) return;
    setEditTargetFile(target);
    setEditFormState({
      name: target.name,
      status: target.status,
      subfolderId: target.subfolderId,
      type: target.type,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editTargetFile || !editFormState.name.trim()) return;
    const trimmedName = editFormState.name.trim();

    setFiles(
      files.map((f) =>
        f.id === editTargetFile.id
          ? {
              ...f,
              name: trimmedName,
              status: editFormState.status,
              subfolderId: editFormState.subfolderId,
              type: editFormState.type,
              lastModified: 'Just now',
            }
          : f
      )
    );
    setEditModalOpen(false);
    showToast(`Saved changes to "${trimmedName}"`);
  };

  // 9. DUPLICATE CATEGORY SUBFOLDER
  const handleDuplicateSubfolder = (subId: string) => {
    const sub = activeProject.subfolders.find((s) => s.id === subId);
    if (!sub) return;
    const newSubId = 'sub_' + Math.random().toString(36).substring(2, 8);
    const newSub: DMSSubfolder = {
      id: newSubId,
      name: `${sub.name}_Copy`,
      projectId: activeProjectId,
    };
    const subFiles = files.filter((f) => f.projectId === activeProjectId && f.subfolderId === subId);
    const clonedFiles: DMSFile[] = subFiles.map((f, idx) => ({
      ...f,
      id: 'f_' + Math.random().toString(36).substring(2, 9),
      name: 'Copy_of_' + f.name,
      subfolderId: newSubId,
      order: files.length + idx + 1,
      lastModified: 'Just now',
    }));

    setProjects(
      projects.map((p) =>
        p.id === activeProjectId ? { ...p, subfolders: [...p.subfolders, newSub] } : p
      )
    );
    setFiles([...files, ...clonedFiles]);
    setActiveSubfolderId(newSubId);
    showToast(`Duplicated folder "${sub.name}" and ${clonedFiles.length} file(s)`);
  };

  // Keyboard Shortcuts (F2: Rename, Ctrl+D: Duplicate, Enter: Edit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (!selectedFileId) return;

      if (e.key === 'F2') {
        e.preventDefault();
        handleStartRename(selectedFileId);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleDuplicateFile(selectedFileId);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleOpenEditModal(selectedFileId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileId, files]);

  // Check if a German document was passed from Forms Hub
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingDocStr = localStorage.getItem('eyeshots_pending_dms_doc');
    if (pendingDocStr) {
      try {
        const pendingDoc = JSON.parse(pendingDocStr);
        localStorage.removeItem('eyeshots_pending_dms_doc');
        const newFile: DMSFile = {
          id: 'doc_' + Math.random().toString(36).substring(2, 9),
          name: pendingDoc.name || 'Official_German_Form.pdf',
          projectId: pendingDoc.projectId || 'proj_jobcenter',
          subfolderId: pendingDoc.subfolderId || 'all',
          type: 'form',
          sizeBytes: pendingDoc.sizeBytes || 485000,
          status: 'Amt-Bereit',
          voiceNotesCount: 0,
          order: 1,
          lastModified: 'Gerade eben',
        };
        setFiles(prev => [newFile, ...prev]);
        setSelectedFileId(newFile.id);
        setActiveProjectId(newFile.projectId);
        setActiveSubfolderId(newFile.subfolderId);
        setStudioViewMode('studio');
        showToast(`Imported ${newFile.name} from German Forms Library into Acrobat Studio`);
      } catch (e) {
        console.error('Error importing pending doc:', e);
      }
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-4 select-none">
      {/* Top Windows Ribbon & Action Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  EyeShots Central DMS & Windows Explorer
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Pro Desktop Tier
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Full hierarchical file and folder management for German Jobcenter, Tax & Legal Discovery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/forms"
              className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Forms</span>
            </Link>

            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Admin Console
            </Link>
          </div>
        </div>

        {/* Windows Explorer Command Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Create & Upload Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleAddProject}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            <button
              onClick={handleAddSubfolder}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              <span>New Category Folder</span>
            </button>

            <button
              onClick={() => fileUploadInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
              <span>Upload Document</span>
            </button>
            <input
              ref={fileUploadInputRef}
              type="file"
              multiple
              accept=".pdf,.md,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            {/* Cut, Copy, Paste */}
            <button
              onClick={() => selectedFileId && handleCutFile(selectedFileId)}
              disabled={!selectedFileId}
              className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600 flex items-center gap-1"
              title="Cut (Move) Document"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Cut</span>
            </button>

            <button
              onClick={() => selectedFileId && handleCopyFile(selectedFileId)}
              disabled={!selectedFileId}
              className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600 flex items-center gap-1"
              title="Copy Document"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>

            <button
              onClick={handlePasteFile}
              disabled={!clipboard}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                clipboard
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold ring-2 ring-purple-400'
                  : 'hover:bg-slate-100 disabled:opacity-40 text-slate-600'
              }`}
              title="Paste Document"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste {clipboard ? `(${clipboard.action})` : ''}</span>
            </button>

            {/* Direct Rename, Duplicate & Edit Actions */}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            <button
              onClick={() => selectedFileId && handleStartRename(selectedFileId)}
              disabled={!selectedFileId}
              className="px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-40 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1.5 transition-colors"
              title="Rename Document (F2)"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Rename</span>
            </button>

            <button
              onClick={() => selectedFileId && handleDuplicateFile(selectedFileId)}
              disabled={!selectedFileId}
              className="px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 disabled:opacity-40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors"
              title="Duplicate Document (Ctrl+D)"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>

            <button
              onClick={() => selectedFileId && handleOpenEditModal(selectedFileId)}
              disabled={!selectedFileId}
              className="px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 disabled:opacity-40 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors"
              title="Edit Document & Metadata (Enter)"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {/* Customize Operations Button */}
            <button
              onClick={() => {
                setShowOperationsToolbar(prev => !prev);
                if (!selectedFileId && displayedFiles.length > 0) {
                  setSelectedFileId(displayedFiles[0].id);
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                showOperationsToolbar
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 ring-1 ring-amber-300'
                  : 'hover:bg-slate-100 text-slate-700 dark:text-slate-200'
              }`}
              title="Toggle Customize & Operations Toolbar"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              <span>Customize</span>
            </button>

            {/* Reorder Up / Down */}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            <button
              onClick={() => selectedFileId && moveFileOrder(selectedFileId, 'up')}
              disabled={!selectedFileId}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600"
              title="Move Document Up"
            >
              <ArrowUp className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              onClick={() => selectedFileId && moveFileOrder(selectedFileId, 'down')}
              disabled={!selectedFileId}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-600"
              title="Move Document Down"
            >
              <ArrowDown className="w-4 h-4 text-emerald-600" />
            </button>
          </div>

          {/* View Mode & Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search in project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs w-44 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('details')}
                className={`p-1 rounded ${viewMode === 'details' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                title="Details List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                title="Grid Tiles"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Split Layout Reset Pill */}
            <button
              onClick={() => {
                setLeftPaneWidth(270);
                setRightPaneWidth(560);
                setIsLeftCollapsed(false);
                setIsRightCollapsed(false);
                setIsStudioMaximized(false);
                showToast('Reset 3-window layout to standard proportions (270px | Auto | 560px)');
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-[11px] text-slate-500 font-medium flex items-center gap-1 transition-colors"
              title="Reset 3-window split layout to default proportions"
            >
              <RefreshCw className="w-3 h-3 text-emerald-600" />
              <span className="hidden md:inline">Reset Panes</span>
            </button>
          </div>
        </div>

        {/* Address Bar Breadcrumb */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">EyeShots DMS</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-bold text-slate-800 dark:text-white">{activeProject.name}</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-semibold text-emerald-600">
            {activeSubfolderId === 'all' ? 'All Category Folders' : activeSubfolder?.name}
          </span>
        </div>
      </div>

      {/* Dynamic 3-Pane Split Interface: Left Tree, Center Explorer, Right Acrobat Studio */}
      <div 
        ref={splitContainerRef}
        className="flex flex-row w-full h-[780px] gap-0 relative rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 p-1.5 shadow-sm"
      >
        {/* 1. LEFT TREE NAVIGATION (Dynamic Resizable Width) */}
        {!isStudioMaximized && !isLeftCollapsed && (
          <div 
            style={{ width: `${leftPaneWidth}px` }}
            className="shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-3.5 overflow-y-auto space-y-4"
          >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            <span>Project Workspace Tree</span>
            <span>{projects.length}</span>
          </div>

          <div className="space-y-2">
            {projects.map((proj) => {
              const isExpanded = expandedProjects[proj.id];
              const isSelected = activeProjectId === proj.id;
              const projFilesCount = files.filter((f) => f.projectId === proj.id).length;

              return (
                <div key={proj.id} className="space-y-1">
                  {/* Project Main Header Node */}
                  <div
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      setActiveSubfolderId('all');
                    }}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 ring-1 ring-emerald-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProjectExpand(proj.id);
                        }}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span className="truncate">{proj.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {projFilesCount}
                      </span>
                    </div>
                  </div>

                  {/* Subfolders (Categories) Tree */}
                  {isExpanded && (
                    <div className="ml-5 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-1 pt-0.5">
                      {proj.subfolders.map((sub) => {
                        const isSubSelected = activeProjectId === proj.id && activeSubfolderId === sub.id;
                        const subCount = files.filter((f) => f.projectId === proj.id && f.subfolderId === sub.id).length;

                        return (
                          <div
                            key={sub.id}
                            onClick={() => {
                              setActiveProjectId(proj.id);
                              setActiveSubfolderId(sub.id);
                            }}
                            className={`group flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer text-xs transition-colors ${
                              isSubSelected
                                ? 'bg-emerald-100 text-emerald-900 font-bold dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate pr-1">
                              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate">{sub.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-slate-400">{subCount}</span>
                              <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRenameSubfolder(sub.id);
                                  }}
                                  className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600"
                                  title="Rename Category"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateSubfolder(sub.id);
                                  }}
                                  className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded text-emerald-600"
                                  title="Duplicate Category & Contents"
                                >
                                  <CopyPlus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubfolder(sub.id);
                                  }}
                                  className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500"
                                  title="Delete Category"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

        {/* Left Collapsed Strip (Quick Restore) */}
        {!isStudioMaximized && isLeftCollapsed && (
          <div className="shrink-0 w-9 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-3 gap-3 shadow-sm justify-between">
            <button
              onClick={() => setIsLeftCollapsed(false)}
              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 rounded-lg transition-colors"
              title="Expand Project Workspace Tree"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-bold tracking-wider text-slate-400 rotate-180 uppercase select-none [writing-mode:vertical-rl]">
              Workspace Tree
            </div>
            <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-bold">
              {projects.length}
            </div>
          </div>
        )}

        {/* Splitter 1: Left <-> Center (Draggable) */}
        {!isStudioMaximized && (
          <div
            className="group relative flex items-center justify-center w-3.5 shrink-0 cursor-col-resize select-none z-10 mx-0.5"
            onMouseDown={() => setActiveSplitter('left')}
            onDoubleClick={() => { setLeftPaneWidth(270); setIsLeftCollapsed(false); }}
            title="Drag to resize Project Tree • Double-click to reset (270px) • Click button to collapse/expand"
          >
            {/* Visual splitter line & hover glow */}
            <div className={`w-1 h-full rounded-full transition-all duration-150 ${
              activeSplitter === 'left' ? 'bg-emerald-500 w-1.5 shadow-md shadow-emerald-500/40' : 'bg-slate-200/60 dark:bg-slate-800 group-hover:bg-emerald-400'
            }`} />

            {/* Center handle pill with collapse toggle */}
            <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLeftCollapsed(prev => !prev);
                }}
                className="w-4 h-5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:border-emerald-400 transition-all"
                title={isLeftCollapsed ? "Expand Workspace Tree" : "Collapse Workspace Tree"}
              >
                {isLeftCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
              </button>
              <GripVertical className="w-2.5 h-2.5 text-slate-400" />
            </div>
          </div>
        )}

        {/* 2. CENTER EXPLORER WINDOW (Takes all available space) */}
        {!isStudioMaximized && (
          <div 
            onDragEnter={(e) => {
              e.preventDefault();
              explorerDragCounter.current += 1;
              if (e.dataTransfer?.items?.length) setIsExplorerDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              explorerDragCounter.current -= 1;
              if (explorerDragCounter.current <= 0) {
                setIsExplorerDragging(false);
                explorerDragCounter.current = 0;
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsExplorerDragging(false);
              explorerDragCounter.current = 0;
              if (e.dataTransfer?.files?.length) {
                handleDropFiles(Array.from(e.dataTransfer.files));
              }
            }}
            className="relative flex-1 min-w-[280px] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            {/* Drag Overlay */}
            {isExplorerDragging && (
              <div className="absolute inset-0 z-50 bg-emerald-600/90 dark:bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center animate-fade-in pointer-events-none">
                <UploadCloud className="w-16 h-16 animate-bounce mb-3" />
                <h3 className="text-xl font-extrabold">Drop PDF Documents Here</h3>
                <p className="text-xs text-emerald-100 mt-1 max-w-xs">
                  Files will be immediately imported into &quot;{activeSubfolder?.name || activeProject.name}&quot;
                </p>
              </div>
            )}

            {/* Header of Active View with Customize Button */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-white">
                {displayedFiles.length} Document{displayedFiles.length !== 1 ? 's' : ''} in view
              </span>
              <span className="text-slate-400">&bull; Select to inspect, copy, or reorder</span>
            </div>

            {/* Customize Button & Order Badge */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowOperationsToolbar(prev => !prev);
                  if (!selectedFileId && displayedFiles.length > 0) {
                    setSelectedFileId(displayedFiles[0].id);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs shadow-sm ${
                  showOperationsToolbar
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 ring-2 ring-emerald-400'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                }`}
                title="Toggle Customize & Operations Toolbar Above Document List"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Customize</span>
              </button>

              <div className="flex items-center gap-1 text-[11px] text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700 hidden sm:flex">
                <span>Order:</span>
                <span className="font-semibold text-emerald-600">Manual Drag</span>
              </div>
            </div>
          </div>

          {/* Contextual Operations Bar: Appears above files when Customize is active or file is selected */}
          {showOperationsToolbar && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-emerald-50/40 dark:from-slate-800/90 dark:via-indigo-950/40 dark:to-emerald-950/30 border-b border-slate-200 dark:border-slate-700 animate-fade-in flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 max-w-[280px] truncate">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                  Target:
                </span>
                {selectedFile ? (
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white truncate">
                    {selectedFile.name}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    (Click any document below to operate)
                  </span>
                )}
              </div>

              {/* Operations Buttons (Edit, Rename, Duplicate and rest) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. EDIT BUTTON */}
                <button
                  onClick={() => {
                    const targetId = selectedFileId || (displayedFiles[0]?.id);
                    if (targetId) handleOpenEditModal(targetId);
                  }}
                  disabled={displayedFiles.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all hover:scale-[1.02]"
                  title="Edit Document & Metadata"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                {/* 2. RENAME BUTTON */}
                <button
                  onClick={() => {
                    const targetId = selectedFileId || (displayedFiles[0]?.id);
                    if (targetId) handleStartRename(targetId);
                  }}
                  disabled={displayedFiles.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all hover:scale-[1.02]"
                  title="Rename Document (F2)"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>

                {/* 3. DUPLICATE BUTTON */}
                <button
                  onClick={() => {
                    const targetId = selectedFileId || (displayedFiles[0]?.id);
                    if (targetId) handleDuplicateFile(targetId);
                  }}
                  disabled={displayedFiles.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all hover:scale-[1.02]"
                  title="Duplicate Document (Ctrl+D)"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>

                {/* 4. OPEN IN VISUAL EDITOR */}
                <Link
                  href="/edit-pdf"
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1 shadow-sm"
                  title="Open in Visual Canvas Editor"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Visual Editor</span>
                </Link>

                {/* 5. REORDER (MOVE UP / DOWN) */}
                <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl">
                  <button
                    onClick={() => selectedFileId && moveFileOrder(selectedFileId, 'up')}
                    disabled={!selectedFileId || displayedFiles.findIndex(f => f.id === selectedFileId) === 0}
                    className="p-1 hover:bg-slate-100 disabled:opacity-20 text-slate-600 rounded"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                  <button
                    onClick={() => selectedFileId && moveFileOrder(selectedFileId, 'down')}
                    disabled={!selectedFileId || displayedFiles.findIndex(f => f.id === selectedFileId) === displayedFiles.length - 1}
                    className="p-1 hover:bg-slate-100 disabled:opacity-20 text-slate-600 rounded"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                </div>

                {/* 6. DELETE BUTTON */}
                <button
                  onClick={() => {
                    if (selectedFileId) handleDeleteFile(selectedFileId);
                  }}
                  disabled={!selectedFileId}
                  className="p-1.5 rounded-xl hover:bg-red-50 text-red-500 hover:text-red-600 border border-transparent hover:border-red-200 disabled:opacity-20 transition-colors"
                  title="Delete Document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Files List View: Empty state dropzone OR Windows Details Table OR Grid View */}
          {displayedFiles.length === 0 ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center">
              <FileDropzone
                onFilesSelected={handleDropFiles}
                multiple={true}
                title="Drag & drop PDF files into this folder"
                description={`Drop PDF documents directly into "${activeSubfolder?.name || activeProject.name}" to organize, edit, and inspect`}
                badge="📂 Instant Central DMS Ingestion"
                compact={false}
                variant="emerald"
                className="max-w-lg mx-auto"
              />
            </div>
          ) : viewMode === 'details' ? (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 border-b text-[10px] uppercase font-bold text-slate-400 tracking-wider sticky top-0 z-10 backdrop-blur">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-2">Type</th>
                    <th className="py-2.5 px-2">Size</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2">Voice Memos</th>
                    <th className="py-2.5 px-3">Modified</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedFiles.map((file, idx) => {
                    const isSelected = selectedFileId === file.id;

                    return (
                      <tr
                        key={file.id}
                        onClick={() => setSelectedFileId(file.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 font-medium'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2 truncate max-w-xs">
                            {file.type === 'form' ? (
                              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : file.type === 'markdown' ? (
                              <FileCode className="w-4 h-4 text-sky-600 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                            <span className="truncate text-slate-800 dark:text-slate-100 font-semibold">
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 uppercase text-[10px] font-bold text-slate-500">{file.type}</td>
                        <td className="py-2.5 px-2 text-slate-500 font-mono text-[11px]">{formatFileSize(file.sizeBytes)}</td>
                        <td className="py-2.5 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            file.status === 'Amt-Bereit' ? 'bg-emerald-100 text-emerald-800' :
                            file.status === 'Verified' ? 'bg-blue-100 text-blue-800' :
                            file.status === 'Signed' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {file.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          {file.voiceNotesCount > 0 ? (
                            <span className="text-purple-600 font-semibold flex items-center gap-1 text-[11px]">
                              <Mic className="w-3 h-3" />
                              <span>{file.voiceNotesCount} memo{file.voiceNotesCount > 1 ? 's' : ''}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{file.lastModified}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Customize Quick Trigger */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFileId(file.id);
                                setShowOperationsToolbar(true);
                              }}
                              className="p-1 hover:bg-amber-50 text-amber-600 rounded"
                              title="Customize Document Operations"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {/* Rename */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartRename(file.id); }}
                              className="p-1 hover:bg-blue-50 text-blue-600 rounded"
                              title="Rename Document (F2)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Duplicate */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicateFile(file.id); }}
                              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded"
                              title="Duplicate Document (Ctrl+D)"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditModal(file.id); }}
                              className="p-1 hover:bg-indigo-50 text-indigo-600 rounded"
                              title="Edit Document & Metadata"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); moveFileOrder(file.id, 'up'); }}
                              disabled={idx === 0}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-20"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveFileOrder(file.id, 'down'); }}
                              disabled={idx === displayedFiles.length - 1}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-20"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyFile(file.id); }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500"
                              title="Copy to Clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                              className="p-1 hover:bg-red-50 rounded text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
              {displayedFiles.map((file) => {
                const isSelected = selectedFileId === file.id;

                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer space-y-3 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-400 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-emerald-600">
                          {file.type === 'form' ? <FileCheck2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                          {file.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white line-clamp-2">
                        {file.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t">
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      <span>{file.lastModified}</span>
                    </div>

                    {/* Quick Card Action Buttons */}
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(file.id);
                        }}
                        className="p-1 hover:bg-blue-50 text-blue-600 rounded"
                        title="Rename"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateFile(file.id);
                        }}
                        className="p-1 hover:bg-emerald-50 text-emerald-600 rounded"
                        title="Duplicate"
                      >
                        <CopyPlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(file.id);
                        }}
                        className="p-1 hover:bg-indigo-50 text-indigo-600 rounded"
                        title="Edit Document"
                      >
                        <FileEdit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className="p-1 hover:bg-red-50 text-red-500 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* Splitter 2: Center <-> Right (Draggable when document is selected) */}
        {!isStudioMaximized && selectedFile && (
          <div
            className="group relative flex items-center justify-center w-3.5 shrink-0 cursor-col-resize select-none z-10 mx-0.5"
            onMouseDown={() => setActiveSplitter('right')}
            onDoubleClick={() => { setRightPaneWidth(560); setIsRightCollapsed(false); }}
            title="Drag to resize Acrobat Studio • Double-click to reset (560px) • Click button to collapse/expand"
          >
            {/* Visual splitter line */}
            <div className={`w-1 h-full rounded-full transition-all duration-150 ${
              activeSplitter === 'right' ? 'bg-emerald-500 w-1.5 shadow-md shadow-emerald-500/40' : 'bg-slate-200/60 dark:bg-slate-800 group-hover:bg-emerald-400'
            }`} />

            {/* Center handle pill with collapse toggle */}
            <div className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRightCollapsed(prev => !prev);
                }}
                className="w-4 h-5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:border-emerald-400 transition-all"
                title={isRightCollapsed ? "Expand Acrobat Studio" : "Collapse Acrobat Studio"}
              >
                {isRightCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              <GripVertical className="w-2.5 h-2.5 text-slate-400" />
            </div>
          </div>
        )}

        {/* Right Collapsed Strip (when user collapses right studio) */}
        {selectedFile && isRightCollapsed && !isStudioMaximized && (
          <div className="shrink-0 w-9 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-3 gap-3 shadow-sm justify-between">
            <button
              onClick={() => setIsRightCollapsed(false)}
              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 rounded-lg transition-colors"
              title="Expand Acrobat Studio"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-bold tracking-wider text-slate-400 rotate-180 uppercase select-none [writing-mode:vertical-rl]">
              Acrobat Studio
            </div>
            <div className="p-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950 text-[10px]">
              <Eye className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* 3. RIGHT ACROBAT PDF STUDIO & DOCUMENT INSPECTOR (Dynamic Resizable Width or Fullscreen) */}
        {selectedFile && !isRightCollapsed && (
          <div 
            style={{ 
              width: isStudioMaximized ? '100%' : `${rightPaneWidth}px`,
              maxWidth: isStudioMaximized ? '100%' : '850px' 
            }}
            className={`shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in ${
              isStudioMaximized ? 'w-full h-full' : ''
            }`}
          >
            {/* View Switcher Header: Acrobat Studio vs Document Details */}
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-semibold shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStudioViewMode('studio')}
                  className={`px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 ${
                    studioViewMode === 'studio'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Acrobat Studio & All Tools</span>
                </button>
                <button
                  onClick={() => setStudioViewMode('inspector')}
                  className={`px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 ${
                    studioViewMode === 'inspector'
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Document Details</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsStudioMaximized(p => !p)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500"
                  title={isStudioMaximized ? 'Restore Split View' : 'Maximize Studio'}
                >
                  {isStudioMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setSelectedFileId(null)}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500"
                  title="Close Preview"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Studio Content */}
            {studioViewMode === 'studio' ? (
              <div className="flex-1 overflow-hidden">
                <AcrobatPdfStudio
                  file={selectedFile}
                  onClose={() => setSelectedFileId(null)}
                  isMaximized={isStudioMaximized}
                  onToggleMaximize={() => setIsStudioMaximized(p => !p)}
                  onUpdateFile={(upd) => {
                    setFiles(files.map(f => f.id === selectedFile.id ? { ...f, ...upd } : f));
                  }}
                />
              </div>
            ) : (
              /* Classic Inspector Mode */
              <div className="p-4 flex flex-col justify-between overflow-y-auto space-y-4 flex-1">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Document Inspector
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {selectedFile.status}
                    </span>
                  </div>

                  {/* Visual Preview Tile */}
                  <div className="w-full aspect-[3/4] bg-slate-50 dark:bg-slate-800/60 rounded-xl border flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <FileCheck2 className="w-12 h-12 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-800 dark:text-white line-clamp-2">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatFileSize(selectedFile.sizeBytes)} &bull; {selectedFile.type.toUpperCase()}
                    </span>
                  </div>

                  {/* Metadata Attributes */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Category Folder:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {activeProject.subfolders.find((s) => s.id === selectedFile.subfolderId)?.name || 'Project Root'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Order Priority:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">#{selectedFile.order}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Voice Explanations:</span>
                      <span className="font-semibold text-purple-600">{selectedFile.voiceNotesCount} attached</span>
                    </div>
                  </div>
                </div>

                {/* Launch & Edit Operations */}
                <div className="space-y-2 pt-2 border-t">
                  <button
                    onClick={() => {
                      setShowOperationsToolbar(true);
                      handleOpenEditModal(selectedFile.id);
                    }}
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
                    title="Customize Document Properties & Status"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Customize Document Properties</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(selectedFile.id)}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>Edit Document & Metadata</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleStartRename(selectedFile.id)}
                      className="py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 hover:border-blue-300 font-semibold text-xs flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={() => handleDuplicateFile(selectedFile.id)}
                      className="py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-700 hover:border-emerald-300 font-semibold text-xs flex items-center justify-center gap-1 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <CopyPlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Duplicate</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RENAME MODAL */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Rename Document</h3>
              </div>
              <button
                onClick={() => setRenameModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                New Document Name
              </label>
              <input
                type="text"
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') setRenameModalOpen(false);
                }}
                autoFocus
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400">
                Tip: Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">Enter</kbd> to save, <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[10px]">Esc</kbd> to cancel.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setRenameModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRename}
                disabled={!renameInputValue.trim()}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Name</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DOCUMENT MODAL */}
      {editModalOpen && editTargetFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Edit Document Properties</h3>
                  <p className="text-[11px] text-slate-400">Manage file metadata, category folder, and processing status</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Document Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  File Name
                </label>
                <input
                  type="text"
                  value={editFormState.name}
                  onChange={(e) => setEditFormState({ ...editFormState, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category Subfolder Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category Folder Location
                </label>
                <select
                  value={editFormState.subfolderId}
                  onChange={(e) => setEditFormState({ ...editFormState, subfolderId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="root">Project Root (No category)</option>
                  {activeProject.subfolders.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status & Type Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Workflow Status
                  </label>
                  <select
                    value={editFormState.status}
                    onChange={(e) => setEditFormState({ ...editFormState, status: e.target.value as DMSFile['status'] })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Draft">Draft (Entwurf)</option>
                    <option value="Signed">Signed (Signiert)</option>
                    <option value="Verified">Verified (Geprüft)</option>
                    <option value="Amt-Bereit">Amt-Bereit (Official Ready)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Document Type
                  </label>
                  <select
                    value={editFormState.type}
                    onChange={(e) => setEditFormState({ ...editFormState, type: e.target.value as DMSFile['type'] })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pdf">Standard PDF</option>
                    <option value="form">Official Interactive Form</option>
                    <option value="markdown">Markdown Documentation (.md)</option>
                    <option value="scan">High-Res Document Scan</option>
                  </select>
                </div>
              </div>

              {/* Direct Editor Launchers */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Direct Tools
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/edit-pdf"
                    className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Visual Editor</span>
                  </Link>
                  <Link
                    href="/ocr-pdf"
                    className="py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>OCR / Markdown</span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editFormState.name.trim()}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce border border-slate-700 dark:border-slate-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
