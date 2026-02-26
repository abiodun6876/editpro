import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Image as ImageIcon, Download, Trash2, Camera, Layers, Zap, CheckCircle, Undo2, Redo2, X, Sparkles, Lightbulb, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { presets, PresetSettings, ManualSettings } from './data/presets';
import { processImage } from './utils/presetEngine';
import { segmentSubject, createMask, loadModels } from './utils/aiEngine';
import { saveImageToDB, loadImagesFromDB, deleteImageFromDB, clearDB, StoredImage } from './utils/storage';
import './App.css';

interface FileWithId {
  id: string;
  file: File;
  preview: string;
}

const DEFAULT_MANUAL_SETTINGS: ManualSettings = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  sharpness: 0,
  highlights: 1,
  shadows: 1,
  whites: 1,
  blacks: 1,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  temp: 0,
  tint: 0,
  whiteOverlay: 0,
  blackOverlay: 0,
  disabledSections: {},
  skinSoftening: 0,
  brightness: 1,
  noiseReduction: 0,
  hue: 0,
  levelsBlack: 0,
  levelsWhite: 255,
  tintShadows: '#000000',
  tintHighlights: '#ffffff',
  autoBrush: 0,
  curves: 0,
  vibrance: 1,
  skinTone: 0,
  dodgeBurn: 0,
  sharpenRadius: 1.0,
  sharpenDetail: 25,
  vignette: 0,
  grain: 0,
  watermarkText: 'Akins_studio',
  watermarkOpacity: 0.8,
  watermarkSize: 20,
  watermarkColor: '#ffffff'
};

function App() {
  const [images, setImages] = useState<FileWithId[]>([]);

  // LocalStorage Persistence for Selected Preset
  const [selectedPreset, setSelectedPreset] = useState<PresetSettings>(() => {
    const saved = localStorage.getItem('mass-editor-preset');
    if (saved) {
      return presets.find(p => p.id === saved) || presets[0];
    }
    return presets[0];
  });

  const [manualSettings, setManualSettings] = useState<ManualSettings>(DEFAULT_MANUAL_SETTINGS);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // Folder Automation State
  const [sourceDir, setSourceDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [processedFileNames] = useState(new Set<string>());
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<{ title: string, hint: string, action: () => void } | null>(null);

  // UI States for Preview
  const [zoom, setZoom] = useState(1);
  const [showBefore, setShowBefore] = useState(false);

  // Mobile Panel State
  const [activePanel, setActivePanel] = useState<'preview' | 'presets' | 'develop'>('preview');

  const selectedImage = images.find(img => img.id === (selectedImageId || images[0]?.id));

  // Sync preset to localStorage
  useEffect(() => {
    localStorage.setItem('mass-editor-preset', selectedPreset.id);
  }, [selectedPreset]);

  // Load Catalog from DB on Mount
  useEffect(() => {
    const loadCatalog = async () => {
      const stored = await loadImagesFromDB();
      if (stored.length > 0) {
        const restored = stored.map(s => ({
          id: s.id,
          file: new File([s.blob], s.name, { type: s.blob.type }),
          preview: URL.createObjectURL(s.blob)
        }));
        setImages(restored);
        // Also restore settings for the first image if any
        if (stored[0].manualSettings) {
          setManualSettings({ ...DEFAULT_MANUAL_SETTINGS, ...stored[0].manualSettings });
        }
      }
    };
    loadCatalog();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automation Loop
  useEffect(() => {
    if (!isAutoActive || !sourceDir) return;

    let timeoutId: any;
    const scan = async () => {
      if (!isAutoActive) return;
      try {
        for await (const entry of (sourceDir as any).values()) {
          if (entry.kind === 'file' && !processedFileNames.has(entry.name)) {
            const file = await entry.getFile();
            if (file.type.startsWith('image/')) {
              const preview = URL.createObjectURL(file);
              const processed = await processImage(preview, selectedPreset, manualSettings);
              const newImg = {
                id: Math.random().toString(36).substr(2, 9),
                file: file,
                preview: processed
              };
              setImages(prev => [...prev, newImg]);
              processedFileNames.add(entry.name);
            }
          }
        }
      } catch (e) {
        console.error("Folder scan failed", e);
      }
      if (isAutoActive) timeoutId = setTimeout(scan, 3000);
    };
    scan();
    return () => clearTimeout(timeoutId);
  }, [isAutoActive, sourceDir, selectedPreset, manualSettings]);

  const startFolderWatching = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setSourceDir(handle);
      setIsAutoActive(true);
    } catch (err) {
      console.error('Folder access denied', err);
    }
  };

  const processAndDownload = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setProcessedCount(0);
    if (selectedPreset.overlay?.type === 'neural-bokeh' || selectedPreset.aiSubjectOnly) {
      await loadModels();
    }
    const zip = new JSZip();
    for (const item of images) {
      // CRITICAL FIX: Always use the original File/Blob for processing to avoid exponential effects
      const sourceUrl = URL.createObjectURL(item.file);
      const processedDataUrl = await processImage(sourceUrl, selectedPreset, manualSettings);

      const parts = processedDataUrl.split(',');
      if (parts.length > 1) {
        const base64Data = parts[1];
        zip.file(`edited_${item.file.name}`, base64Data, { base64: true });
      }

      URL.revokeObjectURL(sourceUrl); // Clean up
      setProcessedCount(prev => prev + 1);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `mass_edits_${selectedPreset.id}.zip`;
    link.click();
    setIsProcessing(false);
  };

  const [processedPreview, setProcessedPreview] = useState<string | null>(null);

  // Debounced Processing for Live Preview
  useEffect(() => {
    if (!selectedImage) return;
    const timer = setTimeout(async () => {
      const result = await processImage(selectedImage.preview, selectedPreset, manualSettings);
      setProcessedPreview(result);
    }, 150); // Fast enough for "live" feel but saves CPU
    return () => clearTimeout(timer);
  }, [selectedImage, selectedPreset, manualSettings]);

  // AI Assistant Logic (Analysis)
  useEffect(() => {
    if (!selectedImage || !isAssistantOpen) return;

    const analyze = () => {
      if (manualSettings.exposure < 0.8) {
        setSuggestion({
          title: "Brightness Boost",
          hint: "This image looks a bit dark. Try increasing exposure or applying 'Bright & Airy Wedding'.",
          action: () => setManualSettings(p => ({ ...p, exposure: 1.2 }))
        });
      } else if (manualSettings.skinSoftening < 0.2) {
        setSuggestion({
          title: "Skin Polish",
          hint: "The portrait details are sharp. AI suggests a touch of skin softening for a professional look.",
          action: () => setManualSettings(p => ({ ...p, skinSoftening: 0.6 }))
        });
      } else {
        setSuggestion({
          title: "Looking Good!",
          hint: "The current balance is excellent. Ready for export or a final touch of saturation.",
          action: () => setManualSettings(p => ({ ...p, saturation: 1.1 }))
        });
      }
    };
    analyze();
  }, [selectedImage, manualSettings, isAssistantOpen]);

  // Sync current image state to DB on edit
  useEffect(() => {
    if (selectedImage) {
      saveImageToDB({
        id: selectedImage.id,
        name: selectedImage.file.name,
        blob: selectedImage.file, // Note: In a real app we might store only settings if blob is unchanged
        manualSettings,
        selectedPresetId: selectedPreset.id,
        lastModified: Date.now()
      });
    }
  }, [manualSettings, selectedPreset, selectedImage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = await Promise.all(files.map(async file => {
      const id = Math.random().toString(36).substr(2, 9);
      const imgData: FileWithId = {
        id,
        file,
        preview: URL.createObjectURL(file)
      };

      // Save to IndexedDB
      await saveImageToDB({
        id,
        name: file.name,
        blob: file,
        manualSettings,
        selectedPresetId: selectedPreset.id,
        lastModified: Date.now()
      });

      return imgData;
    }));
    setImages(prev => [...prev, ...newImages]);
    if (!selectedImageId && newImages.length > 0) setSelectedImageId(newImages[0].id);
  };

  const [developPulse, setDevelopPulse] = useState(0);

  // History Stack for Undo/Redo
  const [history, setHistory] = useState<{ preset: PresetSettings, manual: ManualSettings }[]>([]);
  const [redoStack, setRedoStack] = useState<{ preset: PresetSettings, manual: ManualSettings }[]>([]);

  const pushToHistory = useCallback(() => {
    setHistory(prev => [...prev, { preset: selectedPreset, manual: manualSettings }].slice(-50));
    setRedoStack([]); // Clear redo on new action
  }, [selectedPreset, manualSettings]);

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack(prev => [{ preset: selectedPreset, manual: manualSettings }, ...prev]);
    setHistory(prev => prev.slice(0, -1));
    setSelectedPreset(last.preset);
    setManualSettings({ ...DEFAULT_MANUAL_SETTINGS, ...last.manual });
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory(prev => [...prev, { preset: selectedPreset, manual: manualSettings }]);
    setRedoStack(prev => prev.slice(1));
    setSelectedPreset(next.preset);
    setManualSettings({ ...DEFAULT_MANUAL_SETTINGS, ...next.manual });
  };

  const selectPreset = (p: PresetSettings) => {
    pushToHistory();
    setSelectedPreset(p);
    setDevelopPulse(prev => prev + 1);
  };

  const updateManual = (settings: Partial<ManualSettings>) => {
    setManualSettings(prev => ({ ...prev, ...settings }));
  };

  const toggleSection = (sectionId: string) => {
    setManualSettings(prev => ({
      ...prev,
      disabledSections: {
        ...prev.disabledSections,
        [sectionId]: !prev.disabledSections[sectionId]
      }
    }));
  };

  const removeImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteImageFromDB(id);
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (selectedImageId === id && filtered.length > 0) {
        setSelectedImageId(filtered[0].id);
      } else if (filtered.length === 0) {
        setSelectedImageId(null);
      }
      return filtered;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* Top Bar */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#111]">
        <div className="flex items-center gap-3">
          <Camera className="text-primary" size={24} />
          <span className="font-bold tracking-tight text-xl">STUDIO <span className="text-primary">PRO</span></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${isAssistantOpen ? 'bg-accent text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-white/5 text-text-muted hover:bg-white/10'}`}
          >
            <Sparkles size={16} /> <span className="hidden xs:inline">AI ASSISTANT</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 sm:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs sm:text-sm transition-all"
          >
            Import
          </button>
          <button
            onClick={processAndDownload}
            disabled={images.length === 0 || isProcessing}
            className="px-4 sm:px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? `Processing...` : <><Download size={18} /> <span className="hidden sm:inline">Export All</span></>}
          </button>
        </div>
      </nav>

      {/* Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Presets (Responsive) */}
        <aside className={`${activePanel === 'presets' ? 'flex' : 'hidden'} lg:flex absolute lg:relative inset-0 lg:inset-auto z-40 lg:z-0 w-full lg:w-72 border-r border-white/5 bg-[#111] flex-col`}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between lg:justify-start gap-2 text-text-muted">
            <div className="flex items-center gap-2">
              <Layers size={16} /> <span className="text-xs uppercase font-bold tracking-widest">Presets</span>
            </div>
            <button onClick={() => setActivePanel('preview')} className="lg:hidden p-1 hover:bg-white/5 rounded">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => { selectPreset(p); if (window.innerWidth < 1024) setActivePanel('preview'); }}
                className={`w-full text-left p-3 rounded-lg text-sm transition-all ${selectedPreset.id === p.id ? 'bg-primary text-white' : 'hover:bg-white/5 text-text-muted'}`}
              >
                <div className="text-[10px] opacity-50 uppercase mb-0.5">{p.category}</div>
                <div className="font-medium">{p.name}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Center: Main Preview */}
        <section className={`flex-1 bg-black relative flex flex-col ${activePanel !== 'preview' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex-1 flex items-center justify-center p-4 sm:p-12 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {selectedImage ? (
                <motion.div
                  key={selectedImage.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative max-w-full max-h-full group"
                >
                  <div
                    className="relative overflow-hidden cursor-zoom-in"
                    style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
                    onMouseDown={() => setShowBefore(true)}
                    onMouseUp={() => setShowBefore(false)}
                    onTouchStart={() => setShowBefore(true)}
                    onTouchEnd={() => setShowBefore(false)}
                    onMouseLeave={() => setShowBefore(false)}
                  >
                    <img
                      src={showBefore ? (selectedImage.preview) : (processedPreview || selectedImage.preview)}
                      className="max-w-full max-h-[60vh] lg:max-h-[70vh] object-contain shadow-2xl rounded-sm transition-all duration-300"
                      style={{
                        // Fallback filters while processing the high-end version
                        filter: !processedPreview ? `${selectedPreset.filters} brightness(${manualSettings.exposure}) contrast(${manualSettings.contrast}) saturate(${manualSettings.saturation})` : 'none'
                      }}
                    />
                  </div>

                  {/* Zoom Controls Overlay */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="hover:text-primary transition-colors text-xs font-bold p-1">-</button>
                    <span className="text-[10px] w-8 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="hover:text-primary transition-colors text-xs font-bold p-1">+</button>
                    <div className="w-px h-3 bg-white/20 mx-1" />
                    <button onClick={() => setZoom(1)} className="hover:text-primary transition-colors text-[10px] uppercase font-bold">Reset</button>
                  </div>

                  {/* Before/After Indicator (Mobile Friendly) */}
                  {showBefore && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur px-4 py-1 rounded-full text-[10px] uppercase font-bold border border-white/20 text-white z-30">BEFORE</div>
                  )}

                  {!showBefore && !processedPreview && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!showBefore && selectedPreset.frequencySeparation && (
                    <div className="absolute top-4 left-4 bg-[#f59e0b]/20 backdrop-blur px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[10px] uppercase font-bold text-[#f59e0b] border border-[#f59e0b]/30">AI Retouching Active</div>
                  )}
                </motion.div>
              ) : (
                <div className="text-center text-text-muted p-6">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Import images to start developing</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Filmstrip */}
          <div className="h-24 sm:h-28 border-y lg:border-t lg:border-b-0 border-white/5 bg-[#111] flex items-center px-4 gap-2 overflow-x-auto custom-scrollbar">
            {images.map(img => (
              <div key={img.id} className="relative group/thumb flex-shrink-0">
                <button
                  onClick={() => setSelectedImageId(img.id)}
                  className={`h-16 sm:h-20 aspect-video rounded overflow-hidden border-2 transition-all ${selectedImageId === img.id ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-100'}`}
                >
                  <img src={img.preview} className="w-full h-full object-cover" />
                </button>
                <button
                  onClick={(e) => removeImage(img.id, e)}
                  className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 rounded-full opacity-100 lg:opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {images.length > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 h-16 sm:h-20 aspect-video rounded border-2 border-dashed border-white/10 flex items-center justify-center hover:border-primary/50 transition-colors"
              >
                <Upload size={20} className="text-text-muted" />
              </button>
            )}
          </div>

          {/* Mobile Navigation Toggles */}
          <div className="lg:hidden h-16 border-t border-white/5 bg-[#111] flex items-center justify-around px-2">
            <button
              onClick={() => setActivePanel('presets')}
              className={`flex flex-col items-center gap-1 transition-colors ${activePanel === 'presets' ? 'text-primary' : 'text-text-muted'}`}
            >
              <Layers size={20} />
              <span className="text-[10px] font-bold uppercase">Presets</span>
            </button>
            <button
              onClick={() => setActivePanel('preview')}
              className={`flex flex-col items-center gap-1 transition-colors ${activePanel === 'preview' ? 'text-primary' : 'text-text-muted'}`}
            >
              <ImageIcon size={20} />
              <span className="text-[10px] font-bold uppercase">Preview</span>
            </button>
            <button
              onClick={() => setActivePanel('develop')}
              className={`flex flex-col items-center gap-1 transition-colors ${activePanel === 'develop' ? 'text-primary' : 'text-text-muted'}`}
            >
              <Zap size={20} />
              <span className="text-[10px] font-bold uppercase">Develop</span>
            </button>
          </div>
        </section>

        {/* Right Sidebar: Develop & Automation (Responsive) */}
        <motion.aside
          key="develop-sidebar"
          animate={{ scale: developPulse > 0 ? [1, 1.02, 1] : 1 }}
          transition={{ duration: 0.3 }}
          className={`${activePanel === 'develop' ? 'flex' : 'hidden'} lg:flex absolute lg:relative inset-0 lg:inset-auto z-40 lg:z-0 w-full lg:w-80 border-l border-white/5 bg-[#111] flex-col`}
        >
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-muted">
              <Zap size={16} className={developPulse > 0 ? "text-primary animate-pulse" : ""} />
              <span className="text-xs uppercase font-bold tracking-widest">Develop</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="p-1.5 hover:bg-white/5 rounded text-text-muted disabled:opacity-20 transition-all"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className="p-1.5 hover:bg-white/5 rounded text-text-muted disabled:opacity-20 transition-all"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={14} />
              </button>
              <button onClick={() => setActivePanel('preview')} className="lg:hidden p-1.5 hover:bg-white/5 rounded text-text-muted">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {/* 1. Basic Panel */}
            <div className={`space-y-4 ${manualSettings.disabledSections?.['basic'] ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-[10px] uppercase tracking-widest text-[#60a5fa] font-bold">Basic</h3>
                <button
                  onClick={() => toggleSection('basic')}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-text-muted"
                >
                  {manualSettings.disabledSections?.['basic'] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!manualSettings.disabledSections?.['basic'] && (
                <div className="space-y-4">
                  {/* WB Sub-section */}
                  <div className="grid grid-cols-2 gap-4 pb-2 border-b border-white/5">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase text-text-muted">Temp</span>
                      <input type="range" min="-50" max="50" value={manualSettings.temp} onChange={(e) => setManualSettings(p => ({ ...p, temp: parseFloat(e.target.value) }))} className="w-full h-1 accent-[#fbbf24] bg-white/5 rounded-full appearance-none cursor-pointer" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase text-text-muted">Tint</span>
                      <input type="range" min="-50" max="50" value={manualSettings.tint} onChange={(e) => setManualSettings(p => ({ ...p, tint: parseFloat(e.target.value) }))} className="w-full h-1 accent-[#ef4444] bg-white/5 rounded-full appearance-none cursor-pointer" />
                    </div>
                  </div>
                  {[
                    { label: 'Exposure', key: 'exposure', min: 0, max: 2 },
                    { label: 'Contrast', key: 'contrast', min: 0, max: 2 },
                    { label: 'Highlights', key: 'highlights', min: 0, max: 2 },
                    { label: 'Shadows', key: 'shadows', min: 0, max: 2 },
                    { label: 'Whites', key: 'whites', min: 0, max: 2 },
                    { label: 'Blacks', key: 'blacks', min: 0, max: 2 },
                  ].map(adj => (
                    <div key={adj.key} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>{adj.label}</span>
                        <span className="font-mono text-white">{(manualSettings[adj.key as keyof ManualSettings] as number)?.toFixed(1)}</span>
                      </div>
                      <input
                        type="range" min={adj.min} max={adj.max} step="0.01"
                        value={manualSettings[adj.key as keyof ManualSettings] as number}
                        onChange={(e) => setManualSettings(p => ({ ...p, [adj.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-[#60a5fa] h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                  <div className="pt-2 space-y-3">
                    <span className="text-[9px] uppercase text-text-muted block border-b border-white/5 mb-2">Presence</span>
                    {[
                      { label: 'Texture', key: 'texture', min: -1, max: 1 },
                      { label: 'Clarity', key: 'clarity', min: -1, max: 1 },
                      { label: 'Dehaze', key: 'dehaze', min: -1, max: 1 },
                      { label: 'Vibrance', key: 'vibrance', min: 0, max: 2 },
                      { label: 'Saturation', key: 'saturation', min: 0, max: 2 },
                    ].map(adj => (
                      <div key={adj.key} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-text-muted">
                          <span>{adj.label}</span>
                          <span className="font-mono text-white">{(manualSettings[adj.key as keyof ManualSettings] as number)?.toFixed(1)}</span>
                        </div>
                        <input
                          type="range" min={adj.min} max={adj.max} step="0.01"
                          value={manualSettings[adj.key as keyof ManualSettings] as number}
                          onChange={(e) => setManualSettings(p => ({ ...p, [adj.key]: parseFloat(e.target.value) }))}
                          className="w-full accent-primary h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Detail Panel */}
            <div className={`space-y-4 pt-6 border-t border-white/5 ${manualSettings.disabledSections?.['detail'] ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-[#f87171] font-bold">Detail</h3>
                <button onClick={() => toggleSection('detail')} className="p-1 hover:bg-white/10 rounded transition-colors text-text-muted">
                  {manualSettings.disabledSections?.['detail'] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!manualSettings.disabledSections?.['detail'] && (
                <div className="space-y-4">
                  {[
                    { label: 'Sharpening', key: 'sharpness', min: 0, max: 2 },
                    { label: 'Radius', key: 'sharpenRadius', min: 0.5, max: 3.0 },
                    { label: 'Detail', key: 'sharpenDetail', min: 0, max: 100 },
                    { label: 'Noise Reduction', key: 'noiseReduction', min: 0, max: 1 },
                  ].map(adj => (
                    <div key={adj.key} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>{adj.label}</span>
                        <span className="font-mono text-white">{(manualSettings[adj.key as keyof ManualSettings] as number)?.toFixed(1)}</span>
                      </div>
                      <input
                        type="range" min={adj.min} max={adj.max} step={adj.key === 'sharpenDetail' ? "1" : "0.01"}
                        value={manualSettings[adj.key as keyof ManualSettings] as number}
                        onChange={(e) => setManualSettings(p => ({ ...p, [adj.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-[#f87171] h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Color Grading */}
            <div className={`space-y-4 pt-6 border-t border-white/5 ${manualSettings.disabledSections?.['grading'] ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-[#c084fc] font-bold">Color Grading</h3>
                <button onClick={() => toggleSection('grading')} className="p-1 hover:bg-white/10 rounded transition-colors text-text-muted">
                  {manualSettings.disabledSections?.['grading'] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!manualSettings.disabledSections?.['grading'] && (
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <span className="text-[9px] text-text-muted block uppercase">Shadows</span>
                    <input type="color" value={manualSettings.tintShadows} onChange={(e) => setManualSettings(p => ({ ...p, tintShadows: e.target.value }))} className="w-full bg-transparent border-none h-8 cursor-pointer rounded overflow-hidden" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <span className="text-[9px] text-text-muted block uppercase">Highlights</span>
                    <input type="color" value={manualSettings.tintHighlights} onChange={(e) => setManualSettings(p => ({ ...p, tintHighlights: e.target.value }))} className="w-full bg-transparent border-none h-8 cursor-pointer rounded overflow-hidden" />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Effects & Overlays */}
            <div className={`space-y-4 pt-6 border-t border-white/5 ${manualSettings.disabledSections?.['effects'] ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-[#fbbf24] font-bold">Effects</h3>
                <button onClick={() => toggleSection('effects')} className="p-1 hover:bg-white/10 rounded transition-colors text-text-muted">
                  {manualSettings.disabledSections?.['effects'] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!manualSettings.disabledSections?.['effects'] && (
                <div className="space-y-4">
                  {[
                    { label: 'Vignette', key: 'vignette', min: 0, max: 1 },
                    { label: 'Grain', key: 'grain', min: 0, max: 1 },
                    { label: 'High Key (White)', key: 'whiteOverlay', min: 0, max: 1 },
                    { label: 'Matte (Black)', key: 'blackOverlay', min: 0, max: 1 },
                  ].map(adj => (
                    <div key={adj.key} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>{adj.label}</span>
                        <span className="font-mono text-white">{((manualSettings[adj.key as keyof ManualSettings] as number) * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range" min={adj.min} max={adj.max} step="0.01"
                        value={manualSettings[adj.key as keyof ManualSettings] as number}
                        onChange={(e) => setManualSettings(p => ({ ...p, [adj.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-[#fbbf24] h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Neural Retouching */}
            <div className={`space-y-4 pt-6 border-t border-white/5 ${manualSettings.disabledSections?.['retouch'] ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-primary font-bold">Neural Retouching</h3>
                <button onClick={() => toggleSection('retouch')} className="p-1 hover:bg-white/10 rounded transition-colors text-text-muted">
                  {manualSettings.disabledSections?.['retouch'] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!manualSettings.disabledSections?.['retouch'] && (
                <div className="space-y-4">
                  {[
                    { label: 'Skin Softening', key: 'skinSoftening', min: 0, max: 1 },
                    { label: 'Skin Uniformity', key: 'skinTone', min: 0, max: 1 },
                    { label: 'Dodge & Burn (Sculpt)', key: 'dodgeBurn', min: 0, max: 1 },
                  ].map(adj => (
                    <div key={adj.key} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-text-muted">
                        <span>{adj.label}</span>
                        <span className="font-mono text-white">{((manualSettings[adj.key as keyof ManualSettings] as number) * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range" min={adj.min} max={adj.max} step="0.01"
                        value={manualSettings[adj.key as keyof ManualSettings] as number}
                        onChange={(e) => setManualSettings(p => ({ ...p, [adj.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-primary h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Watermarking */}
            <div className={`space-y-4 pt-6 border-t border-white/5 ${manualSettings.disabledSections?.['watermark'] ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-[#34d399] font-bold">Watermark</h3>
                <button onClick={() => toggleSection('watermark')} className="p-1 hover:bg-white/10 rounded transition-colors text-text-muted">
                  {manualSettings.disabledSections?.['watermark'] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {!manualSettings.disabledSections?.['watermark'] && (
                <div className="space-y-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-text-muted">Signature Text</span>
                    <input
                      type="text"
                      value={manualSettings.watermarkText}
                      onChange={(e) => setManualSettings(p => ({ ...p, watermarkText: e.target.value }))}
                      placeholder="e.g. Akins_studio"
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#34d399]/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase text-text-muted">Size</span>
                      <input type="range" min="5" max="50" value={manualSettings.watermarkSize} onChange={(e) => setManualSettings(p => ({ ...p, watermarkSize: parseInt(e.target.value) }))} className="w-full h-1 accent-[#34d399] bg-white/5 rounded-full appearance-none cursor-pointer" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase text-text-muted">Opacity</span>
                      <input type="range" min="0" max="1" step="0.01" value={manualSettings.watermarkOpacity} onChange={(e) => setManualSettings(p => ({ ...p, watermarkOpacity: parseFloat(e.target.value) }))} className="w-full h-1 accent-[#34d399] bg-white/5 rounded-full appearance-none cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase text-text-muted">Color</span>
                    <div className="flex gap-2">
                      <input type="color" value={manualSettings.watermarkColor} onChange={(e) => setManualSettings(p => ({ ...p, watermarkColor: e.target.value }))} className="bg-transparent border-none w-8 h-8 cursor-pointer" />
                      <div className="flex-1 flex gap-1">
                        {['#ffffff', '#000000', '#fbbf24', '#f87171'].map(c => (
                          <button key={c} onClick={() => setManualSettings(p => ({ ...p, watermarkColor: c }))} className="w-6 h-6 rounded border border-white/10" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence>
              {isAssistantOpen && suggestion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mx-6 p-4 rounded-xl bg-accent/10 border border-accent/20 space-y-3"
                >
                  <div className="flex items-center gap-2 text-accent">
                    <Lightbulb size={16} />
                    <span className="text-sm font-bold uppercase">{suggestion.title}</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {suggestion.hint}
                  </p>
                  <button
                    onClick={suggestion.action}
                    className="w-full py-2 bg-[#f59e0b] text-black font-extrabold rounded-lg text-xs hover:bg-[#f59e0b]/90 transition-all shadow-[0_4px_15px_rgba(245,158,11,0.3)] active:scale-95"
                  >
                    Apply Suggestion
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Folder Automation */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Automation & Tools</h3>
                <button
                  onClick={async () => { if (confirm('Clear all images?')) { await clearDB(); setImages([]); setSelectedImageId(null); } }}
                  className="text-[10px] uppercase font-bold text-red-500 hover:text-red-400"
                >
                  Clear Catalog
                </button>
              </div>
              <div className={`p-4 rounded-xl border-2 transition-all ${isAutoActive ? 'bg-primary/5 border-primary' : 'bg-white/5 border-white/5'}`}>
                {!sourceDir ? (
                  <button
                    onClick={startFolderWatching}
                    className="w-full py-3 bg-primary text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Upload size={16} /> Auto-Scan Folder
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs truncate">
                      <CheckCircle size={14} className="text-primary" /> {sourceDir.name}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsAutoActive(!isAutoActive)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold ${isAutoActive ? 'bg-accent/20 text-accent' : 'bg-primary text-white'}`}
                      >
                        {isAutoActive ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => { setIsAutoActive(false); setSourceDir(null); }}
                        className="px-3 py-2 bg-white/10 rounded-lg text-xs"
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Footer */}
          <div className="p-4 bg-black/20 text-[10px] text-text-muted border-t border-white/5">
            VERSION PRO 2.0 | {images.length} ASSETS IN CATALOG
          </div>
        </motion.aside>
      </main>

      {/* Hidden Input */}
      <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
    </div>
  );
}

export default App;
