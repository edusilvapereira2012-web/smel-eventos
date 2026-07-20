'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Move,
  Type,
  QrCode,
  FileSignature,
  Settings,
  Eye,
  EyeOff,
  Upload,
  Loader2,
  Check,
  RotateCcw,
  Palette,
  Sparkles
} from 'lucide-react';
import { Button } from './ui/button';

interface ElementConfig {
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  enabled: boolean;
  size?: number;
  showSignature?: boolean;
}

interface LayoutConfig {
  title: ElementConfig;
  name: ElementConfig;
  body: ElementConfig;
  signer: ElementConfig;
  qrcode: ElementConfig;
}

interface CertificateEditorProps {
  api: any; // Instância do Axios pré-configurada
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventHours: number;
  eventSigner: string;
  eventSignerUrl: string;
  initialBackgroundUrl: string | null;
  initialLayout: LayoutConfig | null;
  onSaved: (backgroundUrl: string, layout: LayoutConfig) => void;
}

const defaultLayout: LayoutConfig = {
  title: { x: 50, y: 25, fontSize: 28, color: '#0f172a', enabled: true },
  name: { x: 50, y: 42, fontSize: 24, color: '#0f172a', enabled: true },
  body: { x: 50, y: 55, fontSize: 14, color: '#334155', enabled: true },
  signer: { x: 30, y: 78, fontSize: 12, color: '#0f172a', enabled: true, showSignature: true },
  qrcode: { x: 75, y: 78, size: 80, enabled: true }
};

export default function CertificateEditor({
  api,
  eventId,
  eventTitle,
  eventDate,
  eventHours,
  eventSigner,
  eventSignerUrl,
  initialBackgroundUrl,
  initialLayout,
  onSaved
}: CertificateEditorProps) {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(initialBackgroundUrl);
  const [layout, setLayout] = useState<LayoutConfig>(initialLayout || defaultLayout);
  const [activeElement, setActiveElement] = useState<keyof LayoutConfig | null>(null);
  const [selectedElement, setSelectedElement] = useState<keyof LayoutConfig>('name');
  
  const [uploadingBg, setUploadingBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // Sincronizar com props iniciais se mudarem
  useEffect(() => {
    if (initialBackgroundUrl) setBackgroundUrl(initialBackgroundUrl);
    if (initialLayout) setLayout(initialLayout);
  }, [initialBackgroundUrl, initialLayout]);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBackgroundUrl(response.data.url);
      setSuccessMsg('Plano de fundo carregado com sucesso!');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro ao subir imagem do certificado.');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleMouseDown = (elementKey: keyof LayoutConfig, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveElement(elementKey);
    setSelectedElement(elementKey);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const elemConfig = layout[elementKey];
      
      // Coordenada do clique do mouse dentro da viewport
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Coordenada atual do elemento na tela
      const elemX = rect.left + (elemConfig.x / 100) * rect.width;
      const elemY = rect.top + (elemConfig.y / 100) * rect.height;

      // Diferença entre o clique e o centro/ponto de arrasto
      dragStartOffset.current = {
        x: mouseX - elemX,
        y: mouseY - elemY
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeElement || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Calcula nova posição relativa baseada no mouse e o offset do clique inicial
    const mouseX = e.clientX - dragStartOffset.current.x;
    const mouseY = e.clientY - dragStartOffset.current.y;

    let pctX = ((mouseX - rect.left) / rect.width) * 100;
    let pctY = ((mouseY - rect.top) / rect.height) * 100;

    // Limites de segurança (0% a 100%)
    pctX = Math.max(0, Math.min(100, pctX));
    pctY = Math.max(0, Math.min(100, pctY));

    setLayout((prev) => ({
      ...prev,
      [activeElement]: {
        ...prev[activeElement],
        x: Math.round(pctX * 10) / 10,
        y: Math.round(pctY * 10) / 10
      }
    }));
  };

  const handleMouseUp = () => {
    setActiveElement(null);
  };

  const updateSelectedElementConfig = (field: keyof ElementConfig, value: any) => {
    setLayout((prev) => ({
      ...prev,
      [selectedElement]: {
        ...prev[selectedElement],
        [field]: value
      }
    }));
  };

  const resetToDefault = () => {
    if (confirm('Deseja redefinir as posições e tamanhos para o padrão?')) {
      setLayout(defaultLayout);
      setSuccessMsg('Posições redefinidas com sucesso.');
    }
  };

  const handleSave = async () => {
    if (!backgroundUrl) {
      setErrorMsg('Por favor, faça upload de uma imagem de fundo antes de salvar o layout.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.patch(`/events/${eventId}`, {
        certificateBackgroundUrl: backgroundUrl,
        certificateLayoutJson: layout,
        certificateTitle: layout.title.enabled ? eventTitle : undefined,
        certificateHours: layout.body.enabled ? Number(eventHours) : undefined,
        certificateSigner: layout.signer.enabled ? eventSigner : undefined,
        certificateSignerUrl: layout.signer.enabled ? eventSignerUrl : undefined,
      });
      setSuccessMsg('Layout de certificado customizado salvo com sucesso!');
      onSaved(backgroundUrl, layout);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Falha ao salvar layout do certificado.');
    } finally {
      setSaving(false);
    }
  };

  // Resolução de variáveis de preview do corpo sem deslocamento de fuso horário
  const getSafeFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    if (datePart.includes('-')) {
      const parts = datePart.split('-');
      if (parts[0].length === 4) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };
  const formattedDate = getSafeFormattedDate(eventDate);
  const getBodyPreviewText = () => {
    return 'Certificamos que Nome do Participante (Exemplo) participou com êxito do evento ' + 
      eventTitle + ', realizado em ' + formattedDate + ', com carga horária total de ' + eventHours + ' horas.';
  };

  const colorPresets = [
    '#09090b', '#27272a', '#1e3a8a', '#1e40af', '#0369a1', '#047857', '#b91c1c', '#6d28d9'
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl shadow-2xl space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-850 pb-5">
        <div className="space-y-1">
          <h3 className="text-md font-extrabold text-white flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-violet-400" />
            Editor Visual de Certificado (Drag-and-Drop)
          </h3>
          <p className="text-2xs text-slate-400">
            Arraste os elementos no canvas ou utilize o painel ao lado para mudar fontes, cores e tamanhos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={resetToDefault}
            className="bg-slate-950/60 hover:bg-slate-900 text-slate-350 text-2xs px-4 py-2 border border-slate-850 rounded-lg flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Resetar Layout</span>
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !backgroundUrl}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold text-2xs px-5 py-2.5 rounded-lg flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Salvar Modelo Customizado</span>
          </Button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="bg-emerald-950/30 border border-emerald-900/40 p-3 rounded-lg text-emerald-400 text-2xs font-semibold">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-950/30 border border-red-900/40 p-3 rounded-lg text-red-400 text-2xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Left Side: Canvas Area */}
        <div className="xl:col-span-3 flex flex-col items-center">
          {/* Upload Box if no Background URL */}
          {!backgroundUrl ? (
            <div className="w-full aspect-[1.414] bg-slate-950/80 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-8 text-center space-y-4">
              <Upload className="h-12 w-12 text-slate-600 animate-pulse" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-200">Faça o upload do plano de fundo do certificado</p>
                <p className="text-3xs text-slate-500 max-w-sm">
                  Formatos aceitos: JPG, PNG. Recomendamos o tamanho padrão A4 Paisagem (1123 x 794 pixels ou proporção 1.414) para máxima qualidade de impressão.
                </p>
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBgUpload}
                  id="bg-file-upload"
                  className="hidden"
                />
                <Button
                  type="button"
                  disabled={uploadingBg}
                  onClick={() => document.getElementById('bg-file-upload')?.click()}
                  className="bg-violet-600 hover:bg-violet-750 text-white text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-violet-950/40"
                >
                  {uploadingBg && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                  <span>Selecionar Imagem</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {/* Change Bg button */}
              <div className="flex items-center justify-between px-1">
                <span className="text-3xs font-extrabold uppercase text-slate-500 tracking-wider">Canvas de Visualização (Proporção A4)</span>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBgUpload}
                    id="bg-file-upload-change"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingBg}
                    onClick={() => document.getElementById('bg-file-upload-change')?.click()}
                    className="text-indigo-400 hover:text-indigo-300 text-3xs font-bold flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Alterar Plano de Fundo
                  </button>
                </div>
              </div>

              {/* Canvas Board */}
              <div
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full aspect-[1.414] bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden select-none shadow-inner"
                style={{
                  backgroundImage: `url(${backgroundUrl})`,
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                {/* 1. Title Element */}
                {layout.title.enabled && (
                  <div
                    onMouseDown={(e) => handleMouseDown('title', e)}
                    className={`absolute transform -translate-x-1-2 -translate-y-1-2 cursor-move p-2 border ${
                      selectedElement === 'title' ? 'border-violet-500 bg-violet-950/20' : 'border-transparent hover:border-slate-700/50'
                    } rounded-md text-center`}
                    style={{
                      left: `${layout.title.x}%`,
                      top: `${layout.title.y}%`,
                      fontSize: `calc(${layout.title.fontSize || 28}px * 0.75)`,
                      color: layout.title.color || '#000000',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontWeight: 'bold',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="absolute -top-2 -right-2 bg-slate-900 border border-slate-700 p-0.5 rounded text-[8px] opacity-0 hover:opacity-100 transition">
                      <Move className="h-2 w-2 text-slate-350" />
                    </div>
                    {eventTitle ? eventTitle.toUpperCase() : 'CERTIFICADO DE PARTICIPAÇÃO'}
                  </div>
                )}

                {/* 2. Participant Name Element */}
                {layout.name.enabled && (
                  <div
                    onMouseDown={(e) => handleMouseDown('name', e)}
                    className={`absolute transform -translate-x-1-2 -translate-y-1-2 cursor-move p-2 border ${
                      selectedElement === 'name' ? 'border-violet-500 bg-violet-950/20' : 'border-transparent hover:border-slate-700/50'
                    } rounded-md text-center`}
                    style={{
                      left: `${layout.name.x}%`,
                      top: `${layout.name.y}%`,
                      fontSize: `calc(${layout.name.fontSize || 24}px * 0.75)`,
                      color: layout.name.color || '#000000',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      fontWeight: 'bold',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    NOME DO PARTICIPANTE (EXEMPLO)
                  </div>
                )}

                {/* 3. Certificate Body Element */}
                {layout.body.enabled && (
                  <div
                    onMouseDown={(e) => handleMouseDown('body', e)}
                    className={`absolute transform -translate-x-1-2 -translate-y-1-2 cursor-move p-2 border ${
                      selectedElement === 'body' ? 'border-violet-500 bg-violet-950/20' : 'border-transparent hover:border-slate-700/50'
                    } rounded-md text-center max-w-[75%] leading-relaxed`}
                    style={{
                      left: `${layout.body.x}%`,
                      top: `${layout.body.y}%`,
                      fontSize: `calc(${layout.body.fontSize || 14}px * 0.75)`,
                      color: layout.body.color || '#334155',
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {getBodyPreviewText()}
                  </div>
                )}

                {/* 4. Signer & Signature Element */}
                {layout.signer.enabled && (
                  <div
                    onMouseDown={(e) => handleMouseDown('signer', e)}
                    className={`absolute transform -translate-x-1-2 -translate-y-1-2 cursor-move p-2 border ${
                      selectedElement === 'signer' ? 'border-violet-500 bg-violet-950/20' : 'border-transparent hover:border-slate-700/50'
                    } rounded-md text-center flex flex-col items-center`}
                    style={{
                      left: `${layout.signer.x}%`,
                      top: `${layout.signer.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Signature Preview */}
                    {layout.signer.showSignature !== false && eventSignerUrl && (
                      <img
                        src={eventSignerUrl}
                        alt="Signature Preview"
                        className="h-10 object-contain pointer-events-none mb-1 opacity-80"
                      />
                    )}
                    {/* Line */}
                    <div className="w-36 h-[1px] bg-slate-400 mb-1" />
                    {/* Name */}
                    <div
                      style={{
                        fontSize: `calc(${layout.signer.fontSize || 12}px * 0.75)`,
                        color: layout.signer.color || '#000000',
                        fontWeight: 'bold',
                      }}
                    >
                      {eventSigner || 'Nome do Organizador'}
                    </div>
                    {/* Subtitle */}
                    <div className="text-[8px] text-slate-500 font-medium">Assinatura do Organizador</div>
                  </div>
                )}

                {/* 5. Validation QR Code Element */}
                {layout.qrcode.enabled && (
                  <div
                    onMouseDown={(e) => handleMouseDown('qrcode', e)}
                    className={`absolute transform -translate-x-1-2 -translate-y-1-2 cursor-move p-2 border ${
                      selectedElement === 'qrcode' ? 'border-violet-500 bg-violet-950/20' : 'border-transparent hover:border-slate-700/50'
                    } rounded-md flex flex-col items-center`}
                    style={{
                      left: `${layout.qrcode.x}%`,
                      top: `${layout.qrcode.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* QR Code Dummy Box */}
                    <div
                      className="bg-white p-1 rounded border border-slate-200 flex items-center justify-center pointer-events-none shadow"
                      style={{
                        width: `calc(${layout.qrcode.size || 80}px * 0.75)`,
                        height: `calc(${layout.qrcode.size || 80}px * 0.75)`,
                      }}
                    >
                      <QrCode className="h-full w-full text-slate-900" />
                    </div>
                    <div className="text-[7px] text-slate-500 mt-1 font-mono tracking-wider">Código: CERT-XXXXXX</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Settings Control Panel */}
        <div className="space-y-6">
          <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-xl space-y-5">
            <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5 border-b border-slate-900 pb-3">
              <Settings className="h-4 w-4 text-violet-400" />
              Opções do Elemento
            </h4>

            {/* Element Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-450">Selecionar Variável</label>
              <select
                value={selectedElement}
                onChange={(e) => setSelectedElement(e.target.value as keyof LayoutConfig)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
              >
                <option value="title">Título do Certificado</option>
                <option value="name">Nome do Participante</option>
                <option value="body">Corpo do Texto</option>
                <option value="signer">Assinatura & Organizador</option>
                <option value="qrcode">QR Code de Validação</option>
              </select>
            </div>

            {/* Config Box */}
            <div className="space-y-4 pt-2">
              {/* Visibilidade Toggle */}
              <div className="flex items-center justify-between bg-slate-900/50 p-3 border border-slate-900 rounded-lg">
                <span className="text-xs font-semibold text-slate-300">Mostrar Elemento</span>
                <button
                  type="button"
                  onClick={() => updateSelectedElementConfig('enabled', !layout[selectedElement].enabled)}
                  className={`p-1.5 rounded-lg border transition ${
                    layout[selectedElement].enabled
                      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-900/30'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  {layout[selectedElement].enabled ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>

              {layout[selectedElement].enabled && (
                <>
                  {/* Slider de Tamanho da Fonte */}
                  {selectedElement !== 'qrcode' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-3xs font-extrabold uppercase text-slate-450">
                        <span>Tamanho da Fonte</span>
                        <span className="font-mono text-violet-400">{layout[selectedElement].fontSize || 14}px</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="48"
                        value={layout[selectedElement].fontSize || 14}
                        onChange={(e) => updateSelectedElementConfig('fontSize', Number(e.target.value))}
                        className="w-full accent-violet-500 bg-slate-900 rounded-lg cursor-pointer h-1.5"
                      />
                    </div>
                  )}

                  {/* Slider de Tamanho do QR Code */}
                  {selectedElement === 'qrcode' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-3xs font-extrabold uppercase text-slate-450">
                        <span>Tamanho do QR Code</span>
                        <span className="font-mono text-violet-400">{layout.qrcode.size || 80}px</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="140"
                        value={layout.qrcode.size || 80}
                        onChange={(e) => updateSelectedElementConfig('size', Number(e.target.value))}
                        className="w-full accent-violet-500 bg-slate-900 rounded-lg cursor-pointer h-1.5"
                      />
                    </div>
                  )}

                  {/* Toggle Exibir Assinatura Imagem */}
                  {selectedElement === 'signer' && (
                    <div className="flex items-center justify-between bg-slate-900/30 p-2.5 rounded-lg border border-slate-900">
                      <span className="text-[11px] font-semibold text-slate-350">Exibir Assinatura Digital</span>
                      <input
                        type="checkbox"
                        checked={layout.signer.showSignature !== false}
                        onChange={(e) => updateSelectedElementConfig('showSignature', e.target.checked)}
                        className="rounded border-slate-800 bg-slate-900 text-violet-600 focus:ring-violet-500 h-4 w-4"
                      />
                    </div>
                  )}

                  {/* Cor do Texto (Presets & Colorpicker) */}
                  {selectedElement !== 'qrcode' && (
                    <div className="space-y-3">
                      <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-450 flex items-center gap-1">
                        <Palette className="h-3 w-3" />
                        Cor do Texto
                      </label>
                      
                      {/* Presets Grid */}
                      <div className="grid grid-cols-8 gap-2">
                        {colorPresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => updateSelectedElementConfig('color', preset)}
                            className={`w-6 h-6 rounded-full border transition-all ${
                              layout[selectedElement].color === preset
                                ? 'border-white scale-110 shadow-md shadow-white/20'
                                : 'border-slate-800 hover:scale-105'
                            }`}
                            style={{ backgroundColor: preset }}
                          />
                        ))}
                      </div>

                      {/* Custom Colorpicker */}
                      <div className="flex items-center space-x-3 pt-1">
                        <input
                          type="color"
                          value={layout[selectedElement].color || '#000000'}
                          onChange={(e) => updateSelectedElementConfig('color', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded h-7 w-7 p-0.5 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={layout[selectedElement].color || '#000000'}
                          onChange={(e) => updateSelectedElementConfig('color', e.target.value)}
                          placeholder="#000000"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-2xs font-mono text-slate-350 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Coordenadas Position */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-900/40 p-2 border border-slate-900 rounded-lg text-center">
                      <div className="text-[10px] text-slate-500 font-bold">X (Horizontal)</div>
                      <div className="text-xs font-extrabold text-slate-300 font-mono">{layout[selectedElement].x}%</div>
                    </div>
                    <div className="bg-slate-900/40 p-2 border border-slate-900 rounded-lg text-center">
                      <div className="text-[10px] text-slate-500 font-bold">Y (Vertical)</div>
                      <div className="text-xs font-extrabold text-slate-300 font-mono">{layout[selectedElement].y}%</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Guidelines info */}
          <div className="bg-slate-950/30 border border-slate-850 p-4.5 rounded-xl text-3xs text-slate-500 space-y-2">
            <span className="font-extrabold uppercase tracking-wider text-slate-450 block">Dica do Editor:</span>
            <p className="leading-relaxed">
              Dê um duplo clique ou selecione o elemento no menu lateral para focar nele.
            </p>
            <p className="leading-relaxed">
              Você pode carregar assinaturas digitais na caixa abaixo nas opções normais de certificados da organização.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
