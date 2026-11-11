'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { fabric } from 'fabric';
import { PDFDocument, degrees } from 'pdf-lib';
import { 
  Type, 
  Square, 
  PenTool, 
  Download, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Eraser, 
  Check, 
  X as XIcon, 
  RotateCcw, 
  RotateCw, 
  Loader2, 
  MousePointer, 
  Image as ImageIcon, 
  Bold, 
  Italic, 
  Underline,
  ArrowRight,
  Circle,
  Copy,
  Sparkles,
  Layers,
  Highlighter,
  Sliders,
  CheckCircle2,
  Eye,
  PanelLeft,
  ShieldCheck,
  SplitSquareVertical,
  Lock,
  Maximize2,
  Undo,
  Link as LinkIcon,
  CheckSquare,
  FileText,
  ChevronDown,
  Edit3,
  Shapes as ShapesIcon
} from 'lucide-react';
import { downloadPdfBlob } from '@/lib/pdf/wasm-pipeline';
import { 
  VisibilitySettings, 
  VISIBILITY_PRESETS, 
  getVisibilityCssFilter, 
  getCanvasContextFilter,
  applySharpenFilter 
} from '@/lib/pdf/visibility-enhancer';

// Set up local self-hosted PDF.js worker (same-origin, 0ms latency)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PdfEditorProps {
  file: File;
  onReset: () => void;
}

interface TextSpanItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

interface PageData {
  pageNumber: number;
  rotation: number;
  isDeleted: boolean;
  textSpans: TextSpanItem[];
  viewportWidth: number;
  viewportHeight: number;
}

export const PdfEditor: React.FC<PdfEditorProps> = ({ file, onReset }) => {
  const [pdfDocProxy, setPdfDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<
    | 'select'
    | 'text'
    | 'whiteout'
    | 'draw'
    | 'rect'
    | 'circle'
    | 'check'
    | 'cross'
    | 'dot'
    | 'highlight'
    | 'link'
    | 'form-text'
    | 'form-textarea'
    | 'form-dropdown'
    | 'form-radio'
    | 'form-checkbox'
  >('text');

  // Smart Segmented Toolbar Dropdown state
  const [openDropdown, setOpenDropdown] = useState<
    'text' | 'forms' | 'images' | 'sign' | 'annotate' | 'shapes' | null
  >(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Text formatting properties
  const [textColor, setTextColor] = useState<string>('#0f172a');
  const [fontSize, setFontSize] = useState<number>(14);
  const [fontFamily, setFontFamily] = useState<string>('Helvetica, Arial, sans-serif');
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);

  // Shape properties
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>('#0282e5');
  const [shapeFillColor, setShapeFillColor] = useState<string>('transparent');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);

  // Page structure
  const [pagesData, setPagesData] = useState<PageData[]>([]);

  // Page Thumbnails & Left Sidebar State
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState<boolean>(true);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});

  // Document Visibility & Scan Enhancer State ("Stays Genuine")
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState<boolean>(false);
  const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(VISIBILITY_PRESETS.original);

  // Document Review & Changes Inspector State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewPageNum, setReviewPageNum] = useState<number>(1);
  const [reviewViewMode, setReviewViewMode] = useState<'side-by-side' | 'split'>('side-by-side');
  const [reviewSplitPos, setReviewSplitPos] = useState<number>(50);
  const isDraggingReviewSplit = useRef<boolean>(false);

  // Signature modal state
  const [isSignModalOpen, setIsSignModalOpen] = useState<boolean>(false);
  const [signType, setSignType] = useState<'draw' | 'type'>('draw');
  const [typedSignText, setTypedSignText] = useState<string>('');
  const [inkColor, setInkColor] = useState<string>('#0f172a');
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const signFabricRef = useRef<fabric.Canvas | null>(null);

  // Hidden image input ref
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Per-page canvas elements and Fabric instances
  const pdfCanvasesRef = useRef<Record<number, HTMLCanvasElement | null>>({});
  const fabricCanvasesRef = useRef<Record<number, HTMLCanvasElement | null>>({});
  const fabricInstancesRef = useRef<Record<number, fabric.Canvas | null>>({});

  // 🔥 CRITICAL FIX FOR STALE CLOSURE: Real-time Refs for all active state
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const textColorRef = useRef(textColor);
  textColorRef.current = textColor;

  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const fontFamilyRef = useRef(fontFamily);
  fontFamilyRef.current = fontFamily;

  const isBoldRef = useRef(isBold);
  isBoldRef.current = isBold;

  const isItalicRef = useRef(isItalic);
  isItalicRef.current = isItalic;

  const isUnderlineRef = useRef(isUnderline);
  isUnderlineRef.current = isUnderline;

  const shapeStrokeColorRef = useRef(shapeStrokeColor);
  shapeStrokeColorRef.current = shapeStrokeColor;

  const shapeFillColorRef = useRef(shapeFillColor);
  shapeFillColorRef.current = shapeFillColor;

  const shapeStrokeWidthRef = useRef(shapeStrokeWidth);
  shapeStrokeWidthRef.current = shapeStrokeWidth;

  // Drag-to-draw state for Whiteout, Highlight & Shapes
  const isMouseDownRef = useRef<boolean>(false);
  const dragStartPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentDrawingShapeRef = useRef<fabric.Object | null>(null);
  const activePageNumRef = useRef<number>(1);

  // Compute total edits summary for review badge
  const getTotalModifications = () => {
    let textCount = 0;
    let whiteoutCount = 0;
    let signCount = 0;
    let otherCount = 0;

    Object.values(fabricInstancesRef.current).forEach((f) => {
      if (f) {
        f.getObjects().forEach((o: any) => {
          if (o.type === 'i-text') textCount++;
          else if (o.isWhiteout) whiteoutCount++;
          else if (o.type === 'image' || o.isSignature) signCount++;
          else otherCount++;
        });
      }
    });

    const rotatedCount = pagesData.filter((p) => p.rotation !== 0 && !p.isDeleted).length;
    const deletedCount = pagesData.filter((p) => p.isDeleted).length;
    const hasFilter = visibilitySettings.preset !== 'original';
    const total = textCount + whiteoutCount + signCount + otherCount + rotatedCount + deletedCount + (hasFilter ? 1 : 0);

    return {
      total,
      textCount,
      whiteoutCount,
      signCount,
      otherCount,
      rotatedCount,
      deletedCount,
      hasFilter,
    };
  };

  const totalModifications = getTotalModifications();

  // 1. Load PDF Document and initialize page descriptors
  useEffect(() => {
    let isCancelled = false;

    async function loadPdf() {
      setIsProcessing(true);
      setStatusMessage('Loading PDF into memory...');
      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer).slice() });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDocProxy(doc);
          setTotalPages(doc.numPages);

          const initialPages: PageData[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            initialPages.push({
              pageNumber: i,
              rotation: 0,
              isDeleted: false,
              textSpans: [],
              viewportWidth: 600,
              viewportHeight: 800,
            });
          }
          setPagesData(initialPages);
          setIsProcessing(false);
          setStatusMessage(null);
        }
      } catch (err: any) {
        console.error('Failed to load PDF document:', err);
        setStatusMessage('Failed to load PDF document: ' + (err.message || 'Unknown error'));
        setIsProcessing(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  // 2. Render each PDF page and attach bulletproof Fabric event handlers
  const renderAllPages = useCallback(async () => {
    if (!pdfDocProxy || pagesData.length === 0) return;

    for (const pageData of pagesData) {
      if (pageData.isDeleted) continue;
      const pageNum = pageData.pageNumber;

      try {
        const page = await pdfDocProxy.getPage(pageNum);
        const rotationAngle = (page.rotate + pageData.rotation) % 360;
        const viewport = page.getViewport({ scale, rotation: rotationAngle });

        if (pageData.viewportWidth !== viewport.width || pageData.viewportHeight !== viewport.height) {
          pageData.viewportWidth = viewport.width;
          pageData.viewportHeight = viewport.height;
        }

        // 1. Render Base PDF Vector Canvas
        const baseCanvas = pdfCanvasesRef.current[pageNum];
        if (baseCanvas) {
          baseCanvas.width = viewport.width;
          baseCanvas.height = viewport.height;
          const ctx = baseCanvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Generate thumbnail for the left navigation drawer
            const thumbUrl = baseCanvas.toDataURL('image/jpeg', 0.5);
            setThumbnailUrls((prev) => ({ ...prev, [pageNum]: thumbUrl }));
          }
        }

        // 2. Extract Text Content for In-Place Text Replacement
        const textContent = await page.getTextContent();
        const spans: TextSpanItem[] = [];

        for (const item of textContent.items as any[]) {
          if (!item.str || !item.str.trim()) continue;
          const [scaleX, , , scaleY, tx, ty] = item.transform;
          const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
          const computedFontSize = Math.sqrt(scaleX * scaleX + scaleY * scaleY) * viewport.scale;
          const computedWidth = (item.width || item.str.length * 8) * viewport.scale;
          const computedHeight = computedFontSize * 1.25;

          spans.push({
            str: item.str,
            x: vx,
            y: vy - computedFontSize,
            width: Math.max(computedWidth, 18),
            height: Math.max(computedHeight, 14),
            fontSize: Math.round(computedFontSize),
          });
        }
        pageData.textSpans = spans;

        // 3. Initialize or Resize Fabric.js Canvas
        const fabricCanvasEl = fabricCanvasesRef.current[pageNum];
        if (fabricCanvasEl) {
          let fCanvas = fabricInstancesRef.current[pageNum];
          if (!fCanvas) {
            fCanvas = new fabric.Canvas(fabricCanvasEl, {
              width: viewport.width,
              height: viewport.height,
              selection: false,
              preserveObjectStacking: true,
            });
            fabricInstancesRef.current[pageNum] = fCanvas;

            // Selection listeners
            fCanvas.on('selection:created', (e) => {
              const active = e.selected?.[0] || null;
              setSelectedObject(active);
              if (active && active.type === 'i-text') {
                const t = active as fabric.IText;
                setTextColor(t.fill as string);
                setFontSize(t.fontSize || 14);
                setFontFamily(t.fontFamily || 'Helvetica, Arial, sans-serif');
                setIsBold(t.fontWeight === 'bold');
                setIsItalic(t.fontStyle === 'italic');
                setIsUnderline(!!t.underline);
              }
            });

            fCanvas.on('selection:updated', (e) => {
              const active = e.selected?.[0] || null;
              setSelectedObject(active);
            });

            fCanvas.on('selection:cleared', () => {
              setSelectedObject(null);
            });

            // 🖱️ MOUSE DOWN: Real-time tool routing with REFS
            fCanvas.on('mouse:down', (opt) => {
              const canvas = fCanvas;
              if (!canvas || !opt.pointer) return;
              activePageNumRef.current = pageNum;

              const currentTool = activeToolRef.current;
              const pointer = canvas.getPointer(opt.e);
              const x = pointer.x;
              const y = pointer.y;

              if (currentTool === 'select') return;

              // In-Place Text Click Detection
              if (currentTool === 'text') {
                const clickedSpan = pageData.textSpans.find(
                  (s) => x >= s.x - 3 && x <= s.x + s.width + 3 && y >= s.y - 3 && y <= s.y + s.height + 3
                );

                if (clickedSpan) {
                  const itext = new fabric.IText(clickedSpan.str, {
                    left: clickedSpan.x,
                    top: clickedSpan.y,
                    fontSize: Math.max(clickedSpan.fontSize, 12),
                    fontFamily: fontFamilyRef.current,
                    fill: textColorRef.current,
                    backgroundColor: '#ffffff',
                    fontWeight: isBoldRef.current ? 'bold' : 'normal',
                    fontStyle: isItalicRef.current ? 'italic' : 'normal',
                    underline: isUnderlineRef.current,
                  });
                  canvas.add(itext);
                  canvas.setActiveObject(itext);
                  itext.enterEditing();
                  itext.selectAll();
                  canvas.renderAll();
                  setActiveTool('select');
                  return;
                }

                // Type new text
                const newText = new fabric.IText('Type your text', {
                  left: x,
                  top: y,
                  fontFamily: fontFamilyRef.current,
                  fontSize: fontSizeRef.current,
                  fill: textColorRef.current,
                  fontWeight: isBoldRef.current ? 'bold' : 'normal',
                  fontStyle: isItalicRef.current ? 'italic' : 'normal',
                  underline: isUnderlineRef.current,
                });
                canvas.add(newText);
                canvas.setActiveObject(newText);
                newText.enterEditing();
                newText.selectAll();
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // ⬜ WHITEOUT TOOL
              if (currentTool === 'whiteout') {
                const clickedSpan = pageData.textSpans.find(
                  (s) => x >= s.x - 2 && x <= s.x + s.width + 2 && y >= s.y - 2 && y <= s.y + s.height + 2
                );

                if (clickedSpan) {
                  const whiteout = new fabric.Rect({
                    left: clickedSpan.x - 2,
                    top: clickedSpan.y - 2,
                    width: clickedSpan.width + 4,
                    height: clickedSpan.height + 4,
                    fill: '#ffffff',
                    stroke: '#0282e5',
                    strokeDashArray: [4, 4],
                    strokeWidth: 1.5,
                    transparentCorners: false,
                    cornerColor: '#0282e5',
                    cornerSize: 8,
                  });
                  (whiteout as any).isWhiteout = true;
                  canvas.add(whiteout);
                  canvas.setActiveObject(whiteout);
                  canvas.renderAll();
                  setActiveTool('select');
                  return;
                }

                isMouseDownRef.current = true;
                dragStartPointRef.current = { x, y };

                const whiteout = new fabric.Rect({
                  left: x,
                  top: y,
                  width: 0,
                  height: 0,
                  fill: '#ffffff',
                  stroke: '#0282e5',
                  strokeDashArray: [4, 4],
                  strokeWidth: 1.5,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                (whiteout as any).isWhiteout = true;
                canvas.add(whiteout);
                currentDrawingShapeRef.current = whiteout;
                return;
              }

              // 📐 RECTANGLE TOOL
              if (currentTool === 'rect') {
                isMouseDownRef.current = true;
                dragStartPointRef.current = { x, y };

                const rect = new fabric.Rect({
                  left: x,
                  top: y,
                  width: 0,
                  height: 0,
                  fill: shapeFillColorRef.current,
                  stroke: shapeStrokeColorRef.current,
                  strokeWidth: shapeStrokeWidthRef.current,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                canvas.add(rect);
                currentDrawingShapeRef.current = rect;
                return;
              }

              // ⚪ CIRCLE TOOL
              if (currentTool === 'circle') {
                isMouseDownRef.current = true;
                dragStartPointRef.current = { x, y };

                const circle = new fabric.Ellipse({
                  left: x,
                  top: y,
                  rx: 0,
                  ry: 0,
                  fill: shapeFillColorRef.current,
                  stroke: shapeStrokeColorRef.current,
                  strokeWidth: shapeStrokeWidthRef.current,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                canvas.add(circle);
                currentDrawingShapeRef.current = circle;
                return;
              }

              // 🖍️ HIGHLIGHTER TOOL
              if (currentTool === 'highlight') {
                isMouseDownRef.current = true;
                dragStartPointRef.current = { x, y };

                const highlight = new fabric.Rect({
                  left: x,
                  top: y,
                  width: 0,
                  height: 0,
                  fill: 'rgba(253, 224, 71, 0.45)',
                  stroke: 'transparent',
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                canvas.add(highlight);
                currentDrawingShapeRef.current = highlight;
                return;
              }

              // ✓ CHECKMARK STAMP
              if (currentTool === 'check') {
                const checkText = new fabric.IText('✓', {
                  left: x - 12,
                  top: y - 18,
                  fontSize: 28,
                  fill: '#059669',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                });
                canvas.add(checkText);
                canvas.setActiveObject(checkText);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // ✗ CROSSMARK STAMP
              if (currentTool === 'cross') {
                const crossText = new fabric.IText('✕', {
                  left: x - 12,
                  top: y - 18,
                  fontSize: 26,
                  fill: '#dc2626',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 'bold',
                });
                canvas.add(crossText);
                canvas.setActiveObject(crossText);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // ● DOT / BULLET SYMBOL
              if (currentTool === 'dot') {
                const dot = new fabric.Circle({
                  left: x - 5,
                  top: y - 5,
                  radius: 5,
                  fill: textColorRef.current || '#0f172a',
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                });
                canvas.add(dot);
                canvas.setActiveObject(dot);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // 📝 FORM FIELD: Single line Text
              if (currentTool === 'form-text') {
                const bg = new fabric.Rect({
                  width: 160,
                  height: 30,
                  fill: 'rgba(2, 130, 229, 0.08)',
                  stroke: '#0282e5',
                  strokeWidth: 1,
                  strokeDashArray: [3, 3],
                  rx: 2,
                  ry: 2,
                });
                const label = new fabric.IText('Text field', {
                  left: 6,
                  top: 6,
                  fontSize: 12,
                  fill: '#0282e5',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                });
                const group = new fabric.Group([bg, label], {
                  left: x,
                  top: y,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                (group as any).isFormField = true;
                canvas.add(group);
                canvas.setActiveObject(group);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // 📑 FORM FIELD: Multiline Text
              if (currentTool === 'form-textarea') {
                const bg = new fabric.Rect({
                  width: 200,
                  height: 60,
                  fill: 'rgba(2, 130, 229, 0.08)',
                  stroke: '#0282e5',
                  strokeWidth: 1,
                  strokeDashArray: [3, 3],
                  rx: 2,
                  ry: 2,
                });
                const label = new fabric.IText('Text multiline', {
                  left: 6,
                  top: 6,
                  fontSize: 12,
                  fill: '#0282e5',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                });
                const group = new fabric.Group([bg, label], {
                  left: x,
                  top: y,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                (group as any).isFormField = true;
                canvas.add(group);
                canvas.setActiveObject(group);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // ⊟ FORM FIELD: Drop-down list
              if (currentTool === 'form-dropdown') {
                const bg = new fabric.Rect({
                  width: 170,
                  height: 30,
                  fill: 'rgba(2, 130, 229, 0.08)',
                  stroke: '#0282e5',
                  strokeWidth: 1,
                  rx: 2,
                  ry: 2,
                });
                const label = new fabric.IText('Drop-down list ▾', {
                  left: 6,
                  top: 6,
                  fontSize: 12,
                  fill: '#0282e5',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                });
                const group = new fabric.Group([bg, label], {
                  left: x,
                  top: y,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                (group as any).isFormField = true;
                canvas.add(group);
                canvas.setActiveObject(group);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // ⦿ FORM FIELD: Radio button
              if (currentTool === 'form-radio') {
                const outer = new fabric.Circle({
                  radius: 8,
                  fill: '#ffffff',
                  stroke: '#0282e5',
                  strokeWidth: 1.5,
                });
                const inner = new fabric.Circle({
                  left: 3.5,
                  top: 3.5,
                  radius: 4.5,
                  fill: '#0282e5',
                });
                const label = new fabric.IText('Radio button', {
                  left: 22,
                  top: 1,
                  fontSize: 12,
                  fill: '#334155',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                });
                const group = new fabric.Group([outer, inner, label], {
                  left: x,
                  top: y,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                (group as any).isFormField = true;
                canvas.add(group);
                canvas.setActiveObject(group);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // ☑ FORM FIELD: Checkbox
              if (currentTool === 'form-checkbox') {
                const box = new fabric.Rect({
                  width: 17,
                  height: 17,
                  fill: '#ffffff',
                  stroke: '#0282e5',
                  strokeWidth: 1.5,
                  rx: 2,
                  ry: 2,
                });
                const check = new fabric.IText('✓', {
                  left: 2,
                  top: -3,
                  fontSize: 15,
                  fill: '#0282e5',
                  fontWeight: 'bold',
                });
                const label = new fabric.IText('Checkbox', {
                  left: 23,
                  top: 1,
                  fontSize: 12,
                  fill: '#334155',
                  fontFamily: 'Helvetica, Arial, sans-serif',
                });
                const group = new fabric.Group([box, check, label], {
                  left: x,
                  top: y,
                  transparentCorners: false,
                  cornerColor: '#0282e5',
                  cornerSize: 8,
                });
                (group as any).isFormField = true;
                canvas.add(group);
                canvas.setActiveObject(group);
                canvas.renderAll();
                setActiveTool('select');
                return;
              }

              // 🔗 LINK TOOL
              if (currentTool === 'link') {
                const url = prompt('Enter Web Link URL:', 'https://');
                if (url) {
                  const box = new fabric.Rect({
                    width: 150,
                    height: 24,
                    fill: 'rgba(2, 130, 229, 0.12)',
                    stroke: '#0282e5',
                    strokeWidth: 1,
                    strokeDashArray: [4, 4],
                    rx: 2,
                    ry: 2,
                  });
                  const text = new fabric.IText(`🔗 ${url.replace(/^https?:\/\//, '')}`, {
                    left: 5,
                    top: 5,
                    fontSize: 11,
                    fill: '#0282e5',
                  });
                  const group = new fabric.Group([box, text], {
                    left: x,
                    top: y,
                    transparentCorners: false,
                    cornerColor: '#0282e5',
                    cornerSize: 8,
                  });
                  (group as any).isLink = true;
                  canvas.add(group);
                  canvas.setActiveObject(group);
                  canvas.renderAll();
                }
                setActiveTool('select');
                return;
              }
            });

            // 🖱️ MOUSE MOVE: Dynamic drag resizing
            fCanvas.on('mouse:move', (opt) => {
              const canvas = fCanvas;
              if (!canvas || !isMouseDownRef.current || !currentDrawingShapeRef.current) return;

              const pointer = canvas.getPointer(opt.e);
              const startX = dragStartPointRef.current.x;
              const startY = dragStartPointRef.current.y;
              const curX = pointer.x;
              const curY = pointer.y;

              const left = Math.min(startX, curX);
              const top = Math.min(startY, curY);
              const width = Math.abs(curX - startX);
              const height = Math.abs(curY - startY);

              const shape = currentDrawingShapeRef.current;

              if (shape.type === 'rect') {
                shape.set({ left, top, width, height });
              } else if (shape.type === 'ellipse') {
                (shape as fabric.Ellipse).set({
                  left,
                  top,
                  rx: width / 2,
                  ry: height / 2,
                });
              }

              canvas.renderAll();
            });

            // 🖱️ MOUSE UP: Finalize shape drawing
            fCanvas.on('mouse:up', () => {
              const canvas = fCanvas;
              if (!canvas) return;

              if (isMouseDownRef.current && currentDrawingShapeRef.current) {
                const shape = currentDrawingShapeRef.current;
                const width = shape.width || 0;
                const height = shape.height || 0;

                if (width < 5 && height < 5) {
                  canvas.remove(shape);
                } else {
                  canvas.setActiveObject(shape);
                  canvas.renderAll();
                  setActiveTool('select');
                }

                currentDrawingShapeRef.current = null;
                isMouseDownRef.current = false;
              }
            });
          } else {
            fCanvas.setDimensions({
              width: viewport.width,
              height: viewport.height,
            });
          }
        }
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }
  }, [pdfDocProxy, pagesData, scale]);

  useEffect(() => {
    renderAllPages();
  }, [renderAllPages]);

  // Synchronize cursor & drawing mode across all canvases whenever tool changes
  useEffect(() => {
    Object.values(fabricInstancesRef.current).forEach((fCanvas) => {
      if (!fCanvas) return;

      fCanvas.isDrawingMode = activeTool === 'draw';
      if (activeTool === 'draw' && fCanvas.freeDrawingBrush) {
        fCanvas.freeDrawingBrush.color = textColor;
        fCanvas.freeDrawingBrush.width = 3;
      }

      fCanvas.selection = activeTool === 'select';

      if (activeTool === 'text') {
        fCanvas.defaultCursor = 'text';
      } else if (
        activeTool === 'whiteout' ||
        activeTool === 'rect' ||
        activeTool === 'circle' ||
        activeTool === 'highlight'
      ) {
        fCanvas.defaultCursor = 'crosshair';
      } else {
        fCanvas.defaultCursor = 'default';
      }
    });
  }, [activeTool, textColor]);

  // Keyboard shortcut: Delete or Backspace to delete selected object
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObject) {
        if (selectedObject.type === 'i-text' && (selectedObject as fabric.IText).isEditing) {
          return;
        }
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObject]);

  // Page Actions
  const rotatePage = (pageNum: number) => {
    setPagesData((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const deletePage = (pageNum: number) => {
    setPagesData((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, isDeleted: true } : p))
    );
  };

  const restorePage = (pageNum: number) => {
    setPagesData((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, isDeleted: false } : p))
    );
  };

  const scrollToPage = (pageNum: number) => {
    const el = document.getElementById(`page-card-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Text formatting helpers
  const updateSelectedTextStyle = (key: string, value: any) => {
    Object.values(fabricInstancesRef.current).forEach((fCanvas) => {
      if (!fCanvas) return;
      const active = fCanvas.getActiveObject();
      if (active && active.type === 'i-text') {
        (active as any).set(key, value);
        fCanvas.renderAll();
      }
    });
  };

  const toggleBold = () => {
    const next = !isBold;
    setIsBold(next);
    updateSelectedTextStyle('fontWeight', next ? 'bold' : 'normal');
  };

  const toggleItalic = () => {
    const next = !isItalic;
    setIsItalic(next);
    updateSelectedTextStyle('fontStyle', next ? 'italic' : 'normal');
  };

  const toggleUnderline = () => {
    const next = !isUnderline;
    setIsUnderline(next);
    updateSelectedTextStyle('underline', next);
  };

  const changeFontSize = (newSize: number) => {
    setFontSize(newSize);
    updateSelectedTextStyle('fontSize', newSize);
  };

  const changeFontFamily = (newFont: string) => {
    setFontFamily(newFont);
    updateSelectedTextStyle('fontFamily', newFont);
  };

  const changeTextColor = (newColor: string) => {
    setTextColor(newColor);
    updateSelectedTextStyle('fill', newColor);
  };

  const deleteSelected = () => {
    Object.values(fabricInstancesRef.current).forEach((fCanvas) => {
      if (!fCanvas) return;
      const activeObjects = fCanvas.getActiveObjects();
      if (activeObjects.length > 0) {
        activeObjects.forEach((obj) => fCanvas.remove(obj));
        fCanvas.discardActiveObject();
        fCanvas.renderAll();
      }
    });
    setSelectedObject(null);
  };

  const duplicateSelected = () => {
    const targetPage = activePageNumRef.current || 1;
    const fCanvas = fabricInstancesRef.current[targetPage];
    if (!fCanvas || !selectedObject) return;

    selectedObject.clone((cloned: fabric.Object) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      fCanvas.add(cloned);
      fCanvas.setActiveObject(cloned);
      fCanvas.renderAll();
    });
  };

  // Undo Last Added Object on Active Canvas
  const handleUndo = () => {
    const targetPage = activePageNumRef.current || 1;
    const fCanvas = fabricInstancesRef.current[targetPage];
    if (!fCanvas) return;
    const objects = fCanvas.getObjects();
    if (objects.length > 0) {
      const last = objects[objects.length - 1];
      fCanvas.remove(last);
      fCanvas.discardActiveObject();
      fCanvas.renderAll();
    }
  };

  // Make Existing Text Fields Editable
  const makeExistingFieldsEditable = () => {
    const targetPage = activePageNumRef.current || 1;
    const fCanvas = fabricInstancesRef.current[targetPage];
    const pageData = pagesData.find((p) => p.pageNumber === targetPage);
    if (!fCanvas || !pageData) return;

    let count = 0;
    pageData.textSpans.forEach((span) => {
      const rect = new fabric.Rect({
        left: span.x - 2,
        top: span.y - 2,
        width: span.width + 4,
        height: span.height + 4,
        fill: 'rgba(2, 130, 229, 0.06)',
        stroke: '#0282e5',
        strokeWidth: 1,
        strokeDashArray: [3, 3],
        rx: 2,
        ry: 2,
      });
      (rect as any).isEditableField = true;
      fCanvas.add(rect);
      count++;
    });
    fCanvas.renderAll();
    setStatusMessage(`Scanned ${count} text elements on Page ${targetPage} and made them editable fields.`);
  };

  // Close open toolbar dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;

    const reader = new FileReader();
    reader.onload = (f) => {
      const dataUrl = f.target?.result as string;
      const targetPage = activePageNumRef.current || 1;
      const fCanvas = fabricInstancesRef.current[targetPage];
      if (!fCanvas) return;

      fabric.Image.fromURL(dataUrl, (img) => {
        if (img.width && img.width > 220) {
          img.scaleToWidth(220);
        }
        img.set({ left: 100, top: 100, transparentCorners: false, cornerColor: '#0282e5' });
        fCanvas.add(img);
        fCanvas.setActiveObject(img);
        fCanvas.renderAll();
        setActiveTool('select');
      });
    };
    reader.readAsDataURL(imgFile);
    e.target.value = '';
  };

  // Signature modal setup
  useEffect(() => {
    if (isSignModalOpen && signCanvasRef.current && !signFabricRef.current) {
      const signCanvas = new fabric.Canvas(signCanvasRef.current, {
        isDrawingMode: true,
        width: 460,
        height: 180,
      });
      if (signCanvas.freeDrawingBrush) {
        signCanvas.freeDrawingBrush.color = inkColor;
        signCanvas.freeDrawingBrush.width = 3;
      }
      signFabricRef.current = signCanvas;
    }

    return () => {
      if (signFabricRef.current) {
        signFabricRef.current.dispose();
        signFabricRef.current = null;
      }
    };
  }, [isSignModalOpen, inkColor]);

  const insertSignature = () => {
    const targetPage = activePageNumRef.current || 1;
    const fCanvas = fabricInstancesRef.current[targetPage];
    if (!fCanvas) return;

    if (signType === 'draw' && signFabricRef.current) {
      const dataUrl = signFabricRef.current.toDataURL({ format: 'png' });
      fabric.Image.fromURL(dataUrl, (img) => {
        img.scaleToWidth(160);
        img.set({ left: 120, top: 120, transparentCorners: false, cornerColor: '#0282e5' });
        (img as any).isSignature = true;
        fCanvas.add(img);
        fCanvas.setActiveObject(img);
        fCanvas.renderAll();
        setIsSignModalOpen(false);
        setActiveTool('select');
      });
    } else if (signType === 'type' && typedSignText.trim()) {
      const text = new fabric.IText(typedSignText, {
        left: 120,
        top: 120,
        fontFamily: 'Brush Script MT, cursive, Georgia, serif',
        fontSize: 34,
        fill: inkColor,
        transparentCorners: false,
        cornerColor: '#0282e5',
      });
      (text as any).isSignature = true;
      fCanvas.add(text);
      fCanvas.setActiveObject(text);
      fCanvas.renderAll();
      setIsSignModalOpen(false);
      setTypedSignText('');
      setActiveTool('select');
    }
  };

  // 3. Save & Flatten All Pages into Output PDF ("Apply changes")
  const handleApplyChanges = async () => {
    if (!pdfDocProxy) return;

    setIsProcessing(true);
    setStatusMessage('Baking all text replacements, whiteout layers, and visibility enhancements into PDF...');

    try {
      const originalBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(originalBuffer);
      const isFilterActive = visibilitySettings.preset !== 'original';

      // Handle page deletions and rotations
      const pagesToDelete: number[] = [];
      pagesData.forEach((p, idx) => {
        if (p.isDeleted) {
          pagesToDelete.push(idx);
        } else if (p.rotation !== 0) {
          const page = pdfDoc.getPage(idx);
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees((currentRot + p.rotation) % 360));
        }
      });

      // Burn Fabric overlay drawings and visibility enhancements onto each page
      for (const p of pagesData) {
        if (p.isDeleted) continue;
        const pageNum = p.pageNumber;
        const fCanvas = fabricInstancesRef.current[pageNum];
        const page = pdfDoc.getPage(pageNum - 1);
        const { width: pdfWidth, height: pdfHeight } = page.getSize();

        const hasFabricObjects = fCanvas && fCanvas.getObjects().length > 0;
        if (!hasFabricObjects && !isFilterActive) continue;

        // High-DPI offscreen rendering canvas (300 DPI clarity)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pdfWidth * 2;
        tempCanvas.height = pdfHeight * 2;
        const tempCtx = tempCanvas.getContext('2d');

        if (isFilterActive && tempCtx && pdfDocProxy) {
          // Render base PDF page with visibility filter applied
          const pdfPage = await pdfDocProxy.getPage(pageNum);
          const rotationAngle = (pdfPage.rotate + p.rotation) % 360;
          const viewport = pdfPage.getViewport({ scale: tempCanvas.width / pdfWidth, rotation: rotationAngle });

          const filterStr = getCanvasContextFilter(visibilitySettings);
          if (filterStr !== 'none') {
            tempCtx.filter = filterStr;
          }
          await pdfPage.render({ canvasContext: tempCtx, viewport }).promise;

          if (visibilitySettings.sharpness > 0) {
            applySharpenFilter(tempCtx, tempCanvas.width, tempCanvas.height, visibilitySettings.sharpness);
          }
        }

        if (hasFabricObjects && fCanvas) {
          const offscreenFabric = new fabric.StaticCanvas(null, {
            width: tempCanvas.width,
            height: tempCanvas.height,
          });

          const json = fCanvas.toJSON();
          await new Promise<void>((resolve) => {
            offscreenFabric.loadFromJSON(json, () => {
              const scaleX = tempCanvas.width / fCanvas.getWidth();
              const scaleY = tempCanvas.height / fCanvas.getHeight();

              offscreenFabric.getObjects().forEach((obj) => {
                if (obj.fill === '#ffffff' || (obj as any).isWhiteout) {
                  obj.stroke = 'transparent';
                  obj.strokeWidth = 0;
                }
                obj.scaleX = (obj.scaleX || 1) * scaleX;
                obj.scaleY = (obj.scaleY || 1) * scaleY;
                obj.left = (obj.left || 0) * scaleX;
                obj.top = (obj.top || 0) * scaleY;
                obj.setCoords();
              });

              offscreenFabric.renderAll();
              resolve();
            });
          });

          const fabricPngData = offscreenFabric.toDataURL({ format: 'png' });
          const fabricImg = await new Promise<HTMLImageElement>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.src = fabricPngData;
          });
          tempCtx?.drawImage(fabricImg, 0, 0);
          offscreenFabric.dispose();
        }

        // Draw the flattened image onto the PDF page
        const flattenedPngUrl = tempCanvas.toDataURL('image/png', 0.95);
        const flattenedBytes = await fetch(flattenedPngUrl).then((res) => res.arrayBuffer());
        const embeddedImage = await pdfDoc.embedPng(flattenedBytes);

        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: pdfWidth,
          height: pdfHeight,
        });
      }

      // Delete pages in reverse order
      pagesToDelete.sort((a, b) => b - a).forEach((idx) => {
        if (idx < pdfDoc.getPageCount()) {
          pdfDoc.removePage(idx);
        }
      });

      const flattenedPdfBytes = await pdfDoc.save();
      const newName = file.name.replace(/\.pdf$/i, '') + '-edited.pdf';
      downloadPdfBlob(flattenedPdfBytes, newName);

      setStatusMessage('Changes successfully applied! Download started.');
      setIsReviewModalOpen(false);
    } catch (err: any) {
      console.error('Flattening error:', err);
      setStatusMessage('Error exporting edited PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#e8e8e8] dark:bg-slate-950 pb-28 select-none">
      {/* SVG Hardware Convolve Filter for Real-time Micro-Contrast Sharpness */}
      <svg className="hidden">
        <filter id="genuine-sharpen">
          <feConvolveMatrix order="3" kernelMatrix="0 -0.8 0 -0.8 4.2 -0.8 0 -0.8 0" />
        </filter>
      </svg>

      {/* 🛠️ Top Fixed Sejda-Style Master Action Bar */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Core Tool Selection */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {/* Toggle Thumbnails Drawer */}
          <button
            onClick={() => setIsThumbnailsOpen(!isThumbnailsOpen)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isThumbnailsOpen
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Toggle Page Navigation Drawer"
          >
            <PanelLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span className="hidden md:inline">Pages ({pagesData.filter((p) => !p.isDeleted).length})</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          {/* 🌟 Smart Sejda Segmented Floating Toolbar */}
          <div ref={toolbarRef} className="relative flex items-center bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 rounded-lg shadow-sm divide-x divide-sky-200 dark:divide-sky-900 text-xs font-semibold select-none">
            
            {/* 1. Text ▾ */}
            <div className="relative flex items-center">
              <button
                onClick={() => { setActiveTool('text'); setOpenDropdown(null); }}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors rounded-l-lg ${
                  activeTool === 'text' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title="Text: Edit or Type text"
              >
                <span className="font-serif font-bold text-sm tracking-tighter">IA</span>
                <span>Text</span>
              </button>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'text' ? null : 'text')}
                className="px-1 py-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Text Dropdown */}
              {openDropdown === 'text' && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 space-y-3 animate-fade-in">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Text Formatting
                  </div>
                  <div className="space-y-2">
                    <select
                      value={fontFamily}
                      onChange={(e) => changeFontFamily(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="Helvetica, Arial, sans-serif">Helvetica (Sans)</option>
                      <option value="Times New Roman, serif">Times New Roman (Serif)</option>
                      <option value="Courier New, monospace">Courier (Mono)</option>
                      <option value="Brush Script MT, cursive">Handwriting (Cursive)</option>
                    </select>

                    <div className="flex items-center gap-1">
                      {[12, 14, 16, 18, 24, 32].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => changeFontSize(sz)}
                          className={`flex-1 py-1 rounded text-xs border ${fontSize === sz ? 'bg-sky-500 text-white border-sky-500 font-bold' : 'border-slate-200'}`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={toggleBold}
                          className={`p-1.5 rounded border ${isBold ? 'bg-slate-200 font-bold' : 'bg-white'}`}
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={toggleItalic}
                          className={`p-1.5 rounded border ${isItalic ? 'bg-slate-200 italic' : 'bg-white'}`}
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={toggleUnderline}
                          className={`p-1.5 rounded border ${isUnderline ? 'bg-slate-200' : 'bg-white'}`}
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {['#0f172a', '#dc2626', '#2563eb', '#059669'].map((c) => (
                          <button
                            key={c}
                            onClick={() => changeTextColor(c)}
                            className={`w-4 h-4 rounded-full border ${textColor === c ? 'ring-2 ring-sky-500' : 'border-slate-300'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Links */}
            <button
              onClick={() => { setActiveTool('link'); setOpenDropdown(null); }}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                activeTool === 'link' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Links: Click anywhere to insert a clickable web link"
            >
              <LinkIcon className="w-3.5 h-3.5 text-sky-600" />
              <span>Links</span>
            </button>

            {/* 3. Forms ▾ (Exact Sejda Screenshot Match) */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'forms' ? null : 'forms')}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  openDropdown === 'forms' || ['form-text', 'form-textarea', 'form-dropdown', 'form-radio', 'form-checkbox', 'check', 'cross', 'dot'].includes(activeTool)
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 ring-2 ring-sky-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title="Forms: Add form fields, checkmarks, crosses, bullets"
              >
                <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                <span>Forms</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Exact Sejda Forms Dropdown Menu from Screenshot */}
              {openDropdown === 'forms' && (
                <div 
                  className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden text-xs animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* ADD TEXT AND SYMBOLS */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    Add Text and Symbols
                  </div>
                  <div className="p-2 flex items-center justify-around border-b border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => { setActiveTool('text'); setOpenDropdown(null); }}
                      className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center font-serif text-base font-bold ${activeTool === 'text' ? 'bg-sky-100 text-sky-700' : 'text-slate-700 dark:text-slate-200'}`}
                      title="Add Text"
                    >
                      IA
                    </button>
                    <button
                      onClick={() => { setActiveTool('cross'); setOpenDropdown(null); }}
                      className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center font-bold text-base ${activeTool === 'cross' ? 'bg-sky-100 text-sky-700' : 'text-slate-700 dark:text-slate-200'}`}
                      title="Cross mark (✕)"
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => { setActiveTool('check'); setOpenDropdown(null); }}
                      className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center font-bold text-base ${activeTool === 'check' ? 'bg-sky-100 text-sky-700' : 'text-slate-700 dark:text-slate-200'}`}
                      title="Check mark (✓)"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => { setActiveTool('dot'); setOpenDropdown(null); }}
                      className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-lg ${activeTool === 'dot' ? 'bg-sky-100 text-sky-700' : 'text-slate-700 dark:text-slate-200'}`}
                      title="Dot symbol (●)"
                    >
                      ●
                    </button>
                  </div>

                  {/* ADD NEW FORM FIELDS */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    Add New Form Fields
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => { setActiveTool('form-text'); setOpenDropdown(null); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-medium ${activeTool === 'form-text' ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <span className="font-mono text-[11px] border border-slate-300 px-1 rounded bg-white">TI</span>
                        <span>Text</span>
                      </button>

                      <button
                        onClick={() => { setActiveTool('form-radio'); setOpenDropdown(null); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-medium ${activeTool === 'form-radio' ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <span className="text-sm">⦿</span>
                        <span>Radio button</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => { setActiveTool('form-textarea'); setOpenDropdown(null); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-medium ${activeTool === 'form-textarea' ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <span className="font-mono text-[11px] border border-slate-300 px-1 rounded bg-white">T≡</span>
                        <span>Text multiline</span>
                      </button>

                      <button
                        onClick={() => { setActiveTool('form-checkbox'); setOpenDropdown(null); }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-medium ${activeTool === 'form-checkbox' ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        <span className="text-sm">☑</span>
                        <span>Checkbox</span>
                      </button>
                    </div>

                    <button
                      onClick={() => { setActiveTool('form-dropdown'); setOpenDropdown(null); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-medium ${activeTool === 'form-dropdown' ? 'bg-sky-100 text-sky-700 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      <span className="font-mono text-[11px] border border-slate-300 px-1 rounded bg-white">⊟</span>
                      <span>Drop-down list</span>
                    </button>
                  </div>

                  {/* CHANGE EXISTING FORM FIELDS */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-t border-b border-slate-100 dark:border-slate-800">
                    Change Existing Form Fields
                  </div>
                  <div className="p-2.5">
                    <button
                      onClick={() => {
                        makeExistingFieldsEditable();
                        setOpenDropdown(null);
                      }}
                      className="text-sky-600 hover:text-sky-700 underline text-xs font-semibold flex items-center gap-1"
                    >
                      <span>Make fields editable</span>
                      <span className="w-3.5 h-3.5 rounded-full border border-sky-400 text-[9px] flex items-center justify-center font-bold">?</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Images ▾ */}
            <div className="relative">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="px-3 py-1.5 flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Images: Insert image / logo"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>Images</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* 5. Sign ▾ */}
            <div className="relative">
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="px-3 py-1.5 flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Sign: Draw or type signature"
              >
                <PenTool className="w-3.5 h-3.5 text-teal-600" />
                <span>Sign</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* 6. Whiteout */}
            <button
              onClick={() => { setActiveTool('whiteout'); setOpenDropdown(null); }}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                activeTool === 'whiteout' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Whiteout visually covers content. It is NOT a secure redaction — the original text remains in the file and can still be copied or extracted."
            >
              <Eraser className="w-3.5 h-3.5 text-amber-600" />
              <span>Whiteout</span>
            </button>

            {/* 7. Annotate ▾ */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'annotate' ? null : 'annotate')}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  activeTool === 'highlight' || activeTool === 'draw'
                    ? 'bg-yellow-50 text-yellow-800 ring-2 ring-yellow-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title="Annotate: Highlight, strikeout, underline, draw"
              >
                <Edit3 className="w-3.5 h-3.5 text-yellow-600" />
                <span>Annotate</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {openDropdown === 'annotate' && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 space-y-1 animate-fade-in">
                  <button
                    onClick={() => { setActiveTool('highlight'); setOpenDropdown(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 text-left font-medium"
                  >
                    <Highlighter className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Highlight</span>
                  </button>
                  <button
                    onClick={() => { setActiveTool('draw'); setOpenDropdown(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 text-left font-medium"
                  >
                    <PenTool className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Freehand draw</span>
                  </button>
                </div>
              )}
            </div>

            {/* 8. Shapes ▾ */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'shapes' ? null : 'shapes')}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  activeTool === 'rect' || activeTool === 'circle'
                    ? 'bg-sky-50 text-sky-700 ring-2 ring-sky-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                title="Shapes: Rectangle, Circle"
              >
                <ShapesIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>Shapes</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {openDropdown === 'shapes' && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 space-y-1 animate-fade-in">
                  <button
                    onClick={() => { setActiveTool('rect'); setOpenDropdown(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 text-left font-medium"
                  >
                    <Square className="w-3.5 h-3.5 text-sky-600" />
                    <span>Rectangle</span>
                  </button>
                  <button
                    onClick={() => { setActiveTool('circle'); setOpenDropdown(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-100 text-left font-medium"
                  >
                    <Circle className="w-3.5 h-3.5 text-sky-600" />
                    <span>Circle / Ellipse</span>
                  </button>
                </div>
              )}
            </div>

            {/* 9. Undo */}
            <button
              onClick={handleUndo}
              className="px-3 py-1.5 flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-r-lg"
              title="Undo last change"
            >
              <Undo className="w-3.5 h-3.5 text-slate-600" />
              <span>Undo</span>
            </button>
          </div>

          {/* Duplicate & Delete Actions */}
          {selectedObject && (
            <div className="flex items-center gap-1 border-l pl-2 border-slate-200 dark:border-slate-700">
              <button
                onClick={duplicateSelected}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Duplicate Selected Object"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={deleteSelected}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                title="Delete Selected Item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Feature Triggers: Enhance Visibility + Review Document */}
        <div className="flex items-center gap-2">
          {/* ✨ Enhance Visibility Button */}
          <button
            onClick={() => setIsVisibilityModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              visibilitySettings.preset !== 'original'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 ring-2 ring-amber-400 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
            }`}
            title="Enhance Document Visibility (Clean shadows, darken ink, stays genuine)"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="font-bold">Enhance</span>
            {visibilitySettings.preset !== 'original' && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* 🔍 Review Document Button */}
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 transition-all shadow-sm"
            title="Review Document & Inspect Changes"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-bold">Review</span>
            {totalModifications.total > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                {totalModifications.total}
              </span>
            )}
          </button>

          {/* Zoom */}
          <div className="hidden lg:flex items-center gap-1 text-xs border-l pl-2 border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setScale((s) => Math.max(0.75, s - 0.25))}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-600 font-semibold w-9 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(2.0, s + 0.25))}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onReset}
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* 💡 Mode Instruction Callout Banner */}
      {activeTool === 'whiteout' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-6 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Eraser className="w-4 h-4 text-amber-600" />
            <span>
              <strong>Whiteout Mode:</strong> Drag across any area to erase it, or click any existing word to erase it instantly.
            </span>
          </div>
          <button
            onClick={() => setActiveTool('select')}
            className="text-[11px] underline font-semibold text-amber-700 dark:text-amber-300"
          >
            Done erasing
          </button>
        </div>
      )}

      {activeTool === 'text' && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 py-2 px-6 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Text Mode:</strong> Click any existing word to edit it in place, or click empty space to type new text.
            </span>
          </div>
          <button
            onClick={() => setActiveTool('select')}
            className="text-[11px] underline font-semibold text-emerald-700 dark:text-emerald-300"
          >
            Done typing
          </button>
        </div>
      )}

      {/* 🎨 Floating Contextual Properties Bar (When object is active) */}
      {selectedObject && (
        <div className="sticky top-28 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs shadow-md animate-fade-in">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {selectedObject.type === 'i-text'
              ? 'Text Format'
              : (selectedObject as any).isWhiteout
              ? 'Whiteout Redaction'
              : 'Shape Properties'}
          </span>

          {selectedObject.type === 'i-text' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={fontFamily}
                onChange={(e) => changeFontFamily(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs"
              >
                <option value="Helvetica, Arial, sans-serif">Helvetica (Sans)</option>
                <option value="Times New Roman, serif">Times Roman (Serif)</option>
                <option value="Courier New, monospace">Courier (Mono)</option>
                <option value="Brush Script MT, cursive">Handwriting (Cursive)</option>
              </select>

              <select
                value={fontSize}
                onChange={(e) => changeFontSize(parseInt(e.target.value, 10))}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-medium"
              >
                {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map((sz) => (
                  <option key={sz} value={sz}>{sz} pt</option>
                ))}
              </select>

              <div className="flex items-center gap-1 border-l pl-2 border-slate-200 dark:border-slate-700">
                <button
                  onClick={toggleBold}
                  className={`p-1.5 rounded border ${isBold ? 'bg-slate-200 border-slate-400 font-bold' : 'bg-white border-slate-200'}`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleItalic}
                  className={`p-1.5 rounded border ${isItalic ? 'bg-slate-200 border-slate-400 italic' : 'bg-white border-slate-200'}`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleUnderline}
                  className={`p-1.5 rounded border ${isUnderline ? 'bg-slate-200 border-slate-400' : 'bg-white border-slate-200'}`}
                  title="Underline"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                {['#0f172a', '#dc2626', '#2563eb', '#059669', '#d97706', '#9333ea'].map((col) => (
                  <button
                    key={col}
                    onClick={() => changeTextColor(col)}
                    className={`w-4 h-4 rounded-full border ${textColor === col ? 'ring-2 ring-emerald-500 scale-110' : 'border-slate-300'}`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          ) : (selectedObject as any).isWhiteout ? (
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 font-semibold text-[11px]">
                Opaque Mask: 100% Solid White
              </span>
              <span>Drag any handle to adjust redaction box size.</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span>Drag corners to resize shape. Stroke: {shapeStrokeColor}</span>
            </div>
          )}
        </div>
      )}

      {/* 📄 Main Work Area: Left Thumbnails Sidebar + Center Document Scroll */}
      <div className="flex-1 flex w-full relative">
        {/* 📑 Collapsible Left Thumbnails Navigation Drawer */}
        {isThumbnailsOpen && (
          <aside className="w-56 sticky top-28 h-[calc(100vh-7.5rem)] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-slate-200 dark:border-slate-800 p-3 space-y-4 z-20 shrink-0 hidden md:flex flex-col shadow-lg animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                <span>Pages ({pagesData.filter((p) => !p.isDeleted).length})</span>
              </span>
              <button
                onClick={() => setIsThumbnailsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Collapse Sidebar"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {pagesData.map((p) => {
                const pageNum = p.pageNumber;
                const isDeleted = p.isDeleted;
                const thumb = thumbnailUrls[pageNum];

                return (
                  <div
                    key={pageNum}
                    onClick={() => !isDeleted && scrollToPage(pageNum)}
                    className={`group relative rounded-xl border p-2 transition-all cursor-pointer ${
                      isDeleted
                        ? 'opacity-40 border-red-300 bg-red-50/40'
                        : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:shadow-md bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    {/* Thumbnail Preview Image */}
                    <div className="relative aspect-[3/4] bg-white rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={`Page ${pageNum}`}
                          className="w-full h-full object-contain"
                          style={{
                            filter: getVisibilityCssFilter(visibilitySettings),
                            transform: `rotate(${p.rotation}deg)`,
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Page {pageNum}</span>
                      )}

                      {/* Rotation indicator */}
                      {p.rotation !== 0 && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">
                          {p.rotation}°
                        </span>
                      )}
                    </div>

                    {/* Page info & action bar */}
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Page {pageNum}
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            rotatePage(pageNum);
                          }}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>

                        {isDeleted ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              restorePage(pageNum);
                            }}
                            className="p-1 rounded hover:bg-emerald-100 text-emerald-600 font-bold text-[10px]"
                            title="Restore Page"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePage(pageNum);
                            }}
                            className="p-1 rounded hover:bg-red-100 text-red-500"
                            title="Delete Page"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* 📄 Center Document Feed: Continuous Vertical Scroll */}
        <div className="flex-1 max-w-5xl mx-auto px-4 py-8 space-y-12">
          {pagesData.map((pageData) => {
            if (pageData.isDeleted) return null;
            const pageNum = pageData.pageNumber;

            return (
              <div
                key={pageNum}
                id={`page-card-${pageNum}`}
                className="flex flex-col items-center space-y-2 animate-fade-in"
              >
                {/* Page Control Header (Sejda style) */}
                <div className="flex items-center justify-between w-full max-w-[800px] px-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Page {pageNum} of {totalPages}
                    </span>
                    {pageData.rotation !== 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px]">
                        Rotated {pageData.rotation}°
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => rotatePage(pageNum)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center gap-1 text-[11px]"
                      title="Rotate Page 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate</span>
                    </button>

                    <button
                      onClick={() => deletePage(pageNum)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 flex items-center gap-1 text-[11px]"
                      title="Delete Page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Page Card: Dual-Layer Canvas Stack */}
                <div 
                  className="relative bg-white shadow-2xl rounded border border-slate-300 dark:border-slate-700 overflow-hidden"
                  style={{
                    width: pageData.viewportWidth,
                    height: pageData.viewportHeight,
                  }}
                >
                  {/* 1. Base Layer: PDF.js rendered page vector canvas with Genuine Visibility Filter */}
                  <canvas
                    ref={(el) => { pdfCanvasesRef.current[pageNum] = el; }}
                    className="block pointer-events-none absolute top-0 left-0 transition-all duration-200"
                    style={{
                      filter: getVisibilityCssFilter(visibilitySettings),
                    }}
                  />

                  {/* 2. Top Interactive Layer: Fabric.js interactive surface */}
                  <div className="absolute top-0 left-0 w-full h-full z-20">
                    <canvas
                      ref={(el) => { fabricCanvasesRef.current[pageNum] = el; }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🚀 Fixed Bottom CTA Bar (Sejda Style "Apply Changes") */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-3 px-6 shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:flex">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>All edits & enhancements execute 100% locally in your browser sandbox.</span>
        </div>

        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors"
          >
            Review Document
          </button>

          <button
            onClick={handleApplyChanges}
            disabled={isProcessing}
            className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 group"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying changes...</span>
              </>
            ) : (
              <>
                <span>Apply changes</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ✨ Enhance Document Visibility Modal ("Stays Genuine") */}
      {isVisibilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Enhance Document Visibility
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cleans background scanner shadows while keeping authentic ink, stamps, and paper texture.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVisibilityModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Genuine Document Presets
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { key: 'magic', label: 'Magic Clean (Rec.)', desc: 'Clears shadows, preserves stamps & ink', icon: '✨' },
                  { key: 'ink', label: 'Darken Ink', desc: 'Strengthens faint handwriting & pencil', icon: '🖋️' },
                  { key: 'sharp', label: 'Crisp & Sharp', desc: 'Cleans blurry phone captures', icon: '🔍' },
                  { key: 'warm', label: 'Warm Natural', desc: 'Neutralizes camera cast, keeps texture', icon: '📜' },
                  { key: 'mono', label: 'Clean B&W', desc: 'High-contrast monochromatic print', icon: '🖨️' },
                  { key: 'original', label: 'Original Scan', desc: 'Reset to unmodified scan', icon: '🔄' },
                ].map((p) => {
                  const isActive = visibilitySettings.preset === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setVisibilitySettings(VISIBILITY_PRESETS[p.key as keyof typeof VISIBILITY_PRESETS])}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-400 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-white">
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {p.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Fine-Tuning Sliders */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                Fine-Tuning Controls
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Paper White Level */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                    <span>Paper White (Shadow Clean):</span>
                    <span className="font-bold text-amber-600">{visibilitySettings.brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="150"
                    value={visibilitySettings.brightness}
                    onChange={(e) =>
                      setVisibilitySettings({
                        ...visibilitySettings,
                        preset: 'custom',
                        brightness: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Ink Contrast */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                    <span>Ink Depth & Contrast:</span>
                    <span className="font-bold text-amber-600">{visibilitySettings.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="220"
                    value={visibilitySettings.contrast}
                    onChange={(e) =>
                      setVisibilitySettings({
                        ...visibilitySettings,
                        preset: 'custom',
                        contrast: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Sharpness */}
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                    <span>Edge Micro-Contrast:</span>
                    <span className="font-bold text-amber-600">{visibilitySettings.sharpness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={visibilitySettings.sharpness}
                    onChange={(e) =>
                      setVisibilitySettings({
                        ...visibilitySettings,
                        preset: 'custom',
                        sharpness: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400">
                Enhancement preview updates dynamically on all pages.
              </span>
              <button
                onClick={() => setIsVisibilityModalOpen(false)}
                className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 Document Review & Changes Inspector Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl p-6 space-y-5 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Review Document & Check Changes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify all replacements, redactions, signatures, and visibility enhancements before exporting.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Document Metrics & Audit Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-0.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Active Pages</span>
                <div className="text-lg font-bold text-slate-800 dark:text-white">
                  {pagesData.filter((p) => !p.isDeleted).length} <span className="text-xs font-normal text-slate-400">/ {totalPages}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-0.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Text Replacements</span>
                <div className="text-lg font-bold text-emerald-600">
                  {totalModifications.textCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-0.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Whiteout Redactions</span>
                <div className="text-lg font-bold text-amber-600">
                  {totalModifications.whiteoutCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-0.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Visibility Filter</span>
                <div className="text-sm font-bold text-blue-600 capitalize">
                  {visibilitySettings.preset !== 'original' ? visibilitySettings.preset : 'Original Scan'}
                </div>
              </div>
            </div>

            {/* Interactive Before & After Visual Inspector */}
            <div className="flex-1 overflow-y-auto space-y-3 border rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Inspect Page:</span>
                  <select
                    value={reviewPageNum}
                    onChange={(e) => setReviewPageNum(parseInt(e.target.value, 10))}
                    className="bg-white dark:bg-slate-800 border rounded-lg px-2.5 py-1 text-xs font-bold"
                  >
                    {pagesData.map((p) => (
                      <option key={p.pageNumber} value={p.pageNumber}>
                        Page {p.pageNumber} {p.isDeleted ? '(Deleted)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 text-slate-500 font-medium">
                  <span className="text-slate-400">View Mode:</span>
                  <button
                    onClick={() => setReviewViewMode('side-by-side')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      reviewViewMode === 'side-by-side'
                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'hover:bg-slate-200'
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setReviewViewMode('split')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      reviewViewMode === 'split'
                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'hover:bg-slate-200'
                    }`}
                  >
                    Split Slider
                  </button>
                </div>
              </div>

              {/* Side-by-Side Comparison Container */}
              {reviewViewMode === 'side-by-side' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Original Scan */}
                  <div className="space-y-1 text-center">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      Original Document (Before)
                    </span>
                    <div className="border border-slate-300 dark:border-slate-700 bg-white rounded-xl shadow-inner overflow-hidden aspect-[3/4] flex items-center justify-center">
                      {thumbnailUrls[reviewPageNum] ? (
                        <img
                          src={thumbnailUrls[reviewPageNum]}
                          alt="Original Page"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Loading original...</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Edited & Enhanced */}
                  <div className="space-y-1 text-center">
                    <span className="text-[11px] font-bold uppercase text-emerald-600">
                      Edited & Enhanced (After)
                    </span>
                    <div className="border-2 border-emerald-500 bg-white rounded-xl shadow-md overflow-hidden aspect-[3/4] flex items-center justify-center relative">
                      {thumbnailUrls[reviewPageNum] ? (
                        <img
                          src={thumbnailUrls[reviewPageNum]}
                          alt="Enhanced Page"
                          className="w-full h-full object-contain"
                          style={{
                            filter: getVisibilityCssFilter(visibilitySettings),
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Loading edited...</span>
                      )}
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shadow">
                        Ready to export
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Split Slider Comparison */
                <div className="space-y-1 text-center">
                  <div className="flex justify-between text-[11px] text-slate-500 font-semibold px-2">
                    <span>◀ ORIGINAL SCAN</span>
                    <span>DRAG SLIDER TO COMPARE</span>
                    <span className="text-emerald-600">ENHANCED & EDITED ▶</span>
                  </div>
                  <div
                    className="relative bg-white rounded-xl border border-slate-300 dark:border-slate-700 aspect-[3/4] max-w-sm mx-auto overflow-hidden select-none cursor-ew-resize shadow-md"
                    onMouseDown={() => (isDraggingReviewSplit.current = true)}
                    onMouseMove={(e) => {
                      if (isDraggingReviewSplit.current) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pos = ((e.clientX - rect.left) / rect.width) * 100;
                        setReviewSplitPos(Math.min(95, Math.max(5, pos)));
                      }
                    }}
                    onMouseUp={() => (isDraggingReviewSplit.current = false)}
                    onMouseLeave={() => (isDraggingReviewSplit.current = false)}
                  >
                    {/* Enhanced layer */}
                    <img
                      src={thumbnailUrls[reviewPageNum]}
                      alt="Enhanced"
                      className="w-full h-full object-contain"
                      style={{
                        filter: getVisibilityCssFilter(visibilitySettings),
                      }}
                    />

                    {/* Original layer clipped */}
                    <div
                      className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-amber-500 shadow-2xl pointer-events-none"
                      style={{ width: `${reviewSplitPos}%` }}
                    >
                      <img
                        src={thumbnailUrls[reviewPageNum]}
                        alt="Original"
                        className="w-full h-full object-contain max-w-none"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>

                    {/* Divider handle */}
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{ left: `${reviewSplitPos}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="w-0.5 h-full bg-amber-500" />
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-6 h-6 rounded-full bg-amber-500 text-white shadow-xl flex items-center justify-center font-bold text-[9px]">
                        VS
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Continue Editing
              </button>

              <button
                onClick={handleApplyChanges}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Apply Changes & Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✍️ Signature Modal */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Create E-Signature</h3>
              <button 
                onClick={() => setIsSignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b pb-3 text-xs">
              <button
                onClick={() => setSignType('draw')}
                className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
                  signType === 'draw'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
                }`}
              >
                Draw Signature
              </button>
              <button
                onClick={() => setSignType('type')}
                className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
                  signType === 'type'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
                }`}
              >
                Type Signature
              </button>
            </div>

            {signType === 'draw' ? (
              <div className="space-y-3">
                <div className="border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 overflow-hidden flex justify-center">
                  <canvas ref={signCanvasRef} className="cursor-crosshair" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Ink Color:</span>
                    {['#0f172a', '#1e3a8a', '#2563eb'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setInkColor(c);
                          if (signFabricRef.current?.freeDrawingBrush) {
                            signFabricRef.current.freeDrawingBrush.color = c;
                          }
                        }}
                        className={`w-4 h-4 rounded-full border ${inkColor === c ? 'ring-2 ring-emerald-500' : 'border-slate-300'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => signFabricRef.current?.clear()}
                    className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear canvas</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Type your full name..."
                  value={typedSignText}
                  onChange={(e) => setTypedSignText(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl text-base focus:outline-none focus:border-emerald-500"
                />
                {typedSignText && (
                  <div className="p-4 bg-slate-50 rounded-xl text-center border">
                    <span className="font-serif italic text-3xl text-slate-800">
                      {typedSignText}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={insertSignature}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow"
              >
                Insert Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
