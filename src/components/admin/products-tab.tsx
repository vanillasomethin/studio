'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Pencil, Trash2, Package, Upload, X, Check, FileSpreadsheet, Lightbulb, ChevronDown, ChevronUp, Sparkles, Loader2, Tag, Barcode, IndianRupee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CATEGORY_OPTIONS, UNIT_TYPES } from '@/lib/product-id';

// Columns expected in CSV/paste import (header row optional, detected by content)
// productName, brand, category, sizeVariant, unitType, mrp (optional), barcodeEan (optional)
type CsvRow = { productName: string; brand: string; category: string; sizeVariant: string; unitType: string; mrp?: number; barcodeEan?: string };

function parseCsvText(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const rows: CsvRow[] = [];
  // Detect if first row is a header (contains "product" or "brand" case-insensitive)
  const first = lines[0].toLowerCase();
  const startIdx = first.includes('product') || first.includes('brand') ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(/\t|,/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 4) continue;
    const [productName, brand, category, sizeVariant, unitType, mrpStr, barcodeEan] = cols;
    if (!productName || !brand) continue;
    rows.push({
      productName, brand,
      category:    (category ?? 'GRO').toUpperCase(),
      sizeVariant: sizeVariant ?? '',
      unitType:    unitType ?? 'g',
      mrp:         mrpStr ? (parseFloat(mrpStr) || undefined) : undefined,
      barcodeEan:  barcodeEan?.trim() || undefined,
    });
  }
  return rows;
}

// MRP-only bulk update rows: "key, mrp" where key is a product id (CAT-BRAND-SEQ) or EAN barcode.
type MrpImportRow = { key: string; mrp: number };

function parseMrpText(text: string): MrpImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const rows: MrpImportRow[] = [];
  const first = lines[0].toLowerCase();
  const startIdx = first.includes('mrp') || first.includes('price') || first.includes('id') || first.includes('ean') || first.includes('barcode') ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(/\t|,/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;
    const key = cols[0];
    const mrp = parseFloat((cols[1] ?? '').replace(/[₹,]/g, ''));
    if (!key || !Number.isFinite(mrp) || mrp <= 0) continue;
    rows.push({ key, mrp });
  }
  return rows;
}

type Product = {
  id: string; groupId: string; productName: string; brand: string;
  category: string; sizeVariant: string; unitType: string;
  mrp: number | null; imageUrl: string | null; imageIsAi: boolean;
  barcodeEan: string | null; isActive: boolean;
};

type MrpCandidate = { source: 'amazon' | 'flipkart' | 'openfoodfacts'; title: string; price: number; url?: string };

const BLANK: Omit<Product, 'id' | 'groupId' | 'isActive' | 'imageIsAi'> = {
  productName: '', brand: '', category: 'GRO', sizeVariant: '', unitType: 'g',
  mrp: null, imageUrl: null, barcodeEan: null,
};

export default function ProductsTab({ adminPw }: { adminPw: string }) {
  const { toast } = useToast();
  const [products,   setProducts]   = useState<Product[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [pages,      setPages]      = useState(1);
  const [q,          setQ]          = useState('');
  const [catFilter,  setCatFilter]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState({ ...BLANK });
  const [saving,     setSaving]     = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [formImgPreview, setFormImgPreview] = useState<string | null>(null);
  const [formImgFile,    setFormImgFile]    = useState<File | null>(null);
  const [formImgDragOver, setFormImgDragOver] = useState(false);
  const formImgRef = useRef<HTMLInputElement>(null);

  // Bulk import state
  const [importRows,    setImportRows]    = useState<CsvRow[]>([]);
  const [importing,     setImporting]     = useState(false);
  const [importDone,    setImportDone]    = useState(0);
  const [importDragOver, setImportDragOver] = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Bulk MRP import state (updates existing products from a distributor price list)
  const [showMrpImport, setShowMrpImport] = useState(false);
  const [mrpImportRows, setMrpImportRows] = useState<MrpImportRow[]>([]);
  const [mrpImportText, setMrpImportText] = useState('');
  const [mrpImporting,  setMrpImporting]  = useState(false);
  const [mrpImportResult, setMrpImportResult] = useState<{ updated: number; notFound: string[]; total: number } | null>(null);
  const mrpCsvRef = useRef<HTMLInputElement>(null);

  // Offer suggestions: store-submitted products with no productId (unrecognized)
  const [suggestions,   setSuggestions]   = useState<{ productName: string; weight: string | null; count: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const headers = { 'admin-password': adminPw, 'Content-Type': 'application/json' };

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum) });
      if (q)         params.set('q', q);
      if (catFilter) params.set('category', catFilter);
      const res  = await fetch(`/api/admin/products?${params}`, { headers });
      const data = await res.json() as { products: Product[]; total: number; page: number; pages: number };
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setPages(data.pages ?? 1);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load products' });
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, catFilter]);

  useEffect(() => { void load(1); }, [load]);

  const openNew  = () => { setEditId(null); setForm({ ...BLANK }); setFormImgPreview(null); setFormImgFile(null); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ productName: p.productName, brand: p.brand, category: p.category,
      sizeVariant: p.sizeVariant, unitType: p.unitType, mrp: p.mrp,
      imageUrl: p.imageUrl, barcodeEan: p.barcodeEan });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setFormImgPreview(null); setFormImgFile(null); };

  const save = async () => {
    if (!form.productName.trim() || !form.brand.trim() || !form.sizeVariant.trim()) {
      toast({ variant: 'destructive', title: 'Product name, brand and size are required' });
      return;
    }
    setSaving(true);
    try {
      const url    = editId ? `/api/admin/products/${editId}` : '/api/admin/products';
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Save failed');
      const data   = await res.json() as { product: Product };
      // Upload pending image after creation
      if (!editId && formImgFile) {
        await uploadImage(data.product.id, formImgFile);
      }
      toast({ title: editId ? 'Product updated ✓' : `Created ${data.product.id} ✓` });
      closeForm();
      void load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm(`Archive product ${id}?`)) return;
    try {
      await fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers });
      toast({ title: `${id} archived` });
      void load(page);
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  const uploadImage = async (id: string, file: File) => {
    setImgUploading(true);
    try {
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const key  = `products/${id}/image.${ext}`;
      const fd   = new FormData();
      fd.append('file', file);
      fd.append('key',  key);
      const up  = await fetch('/api/admin/r2-upload', { method: 'POST', headers: { 'admin-password': adminPw }, body: fd });
      if (!up.ok) throw new Error('Upload failed');
      const { publicUrl } = await up.json() as { publicUrl: string };
      await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH', headers,
        // Real photograph overrides any AI-generated placeholder
        body: JSON.stringify({ imageUrl: publicUrl, imageIsAi: false }),
      });
      toast({ title: 'Image uploaded ✓' });
      void load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Image upload failed', description: (e as Error).message });
    } finally { setImgUploading(false); }
  };

  // AI image generation (per-row)
  const [genId, setGenId] = useState<string | null>(null);
  const generateImage = async (id: string) => {
    setGenId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}/generate-image`, {
        method: 'POST', headers: { 'admin-password': adminPw },
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Generation failed');
      toast({ title: 'AI image generated ✓', description: 'Replace with a real photo anytime.' });
      void load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'AI image failed', description: (e as Error).message });
    } finally { setGenId(null); }
  };

  // MRP fetch from Amazon/Flipkart via Maxun (per-row, review before apply)
  const [mrpId,     setMrpId]     = useState<string | null>(null);
  const [mrpFor,    setMrpFor]    = useState<Product | null>(null);
  const [mrpCands,  setMrpCands]  = useState<MrpCandidate[]>([]);
  const [mrpErrors, setMrpErrors] = useState<string[]>([]);
  const [mrpNote,   setMrpNote]   = useState<string | null>(null);
  const [bcId,      setBcId]      = useState<string | null>(null);

  const fetchMrp = async (p: Product) => {
    setMrpId(p.id); setMrpFor(p); setMrpCands([]); setMrpErrors([]); setMrpNote(null);
    try {
      const res  = await fetch(`/api/admin/products/${p.id}/fetch-mrp`, {
        method: 'POST', headers: { 'admin-password': adminPw },
      });
      const data = await res.json() as { candidates?: MrpCandidate[]; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
      setMrpCands(data.candidates ?? []);
      setMrpErrors(data.errors ?? []);
      if (!data.candidates?.length) {
        toast({ title: 'No prices found', description: 'Try a real photo / manual entry.' });
        setMrpFor(null);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'MRP fetch failed', description: (e as Error).message });
      setMrpFor(null);
    } finally { setMrpId(null); }
  };

  // Barcode lookup via Open Food Facts + Open Prices (free, no key). Authoritative
  // identity from the EAN; INR price candidates where the community has logged them.
  const lookupBarcode = async (p: Product) => {
    setBcId(p.id); setMrpFor(p); setMrpCands([]); setMrpErrors([]); setMrpNote(null);
    try {
      const res  = await fetch(`/api/admin/products/${p.id}/lookup-barcode`, {
        method: 'POST', headers: { 'admin-password': adminPw },
      });
      const data = await res.json() as {
        candidates?: MrpCandidate[]; note?: string; error?: string;
        identity?: { productName?: string; brand?: string; quantity?: string };
      };
      if (!res.ok) throw new Error(data.error ?? 'Lookup failed');
      setMrpCands(data.candidates ?? []);
      setMrpNote(data.note ?? null);
      if (!data.candidates?.length && !data.note) { setMrpFor(null); }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Barcode lookup failed', description: (e as Error).message });
      setMrpFor(null);
    } finally { setBcId(null); }
  };

  const applyMrp = async (id: string, mrp: number) => {
    try {
      await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ mrp, mrpCheckedAt: new Date().toISOString() }),
      });
      toast({ title: `MRP set to ₹${mrp} ✓` });
      setMrpFor(null);
      void load(page);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to set MRP' });
    }
  };

  // Load unrecognized offer product names (no productId set)
  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products/suggestions', { headers: { 'admin-password': adminPw } });
      if (res.ok) setSuggestions((await res.json() as { suggestions: typeof suggestions }).suggestions ?? []);
    } catch { /* non-fatal */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPw]);

  useEffect(() => { void loadSuggestions(); }, [loadSuggestions]);

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportRows(parseCsvText(text));
      setShowImport(true);
    };
    reader.readAsText(file);
  };

  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setImportDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseCsvFile(file);
  };

  const bulkImport = async () => {
    setImporting(true); setImportDone(0);
    let done = 0;
    for (const row of importRows) {
      try {
        await fetch('/api/admin/products', {
          method: 'POST', headers,
          body: JSON.stringify(row),
        });
        done++;
        setImportDone(done);
      } catch { /* continue on row error */ }
    }
    toast({ title: `Imported ${done} of ${importRows.length} products` });
    setImportRows([]); setShowImport(false);
    setImporting(false);
    void load(1);
  };

  // Bulk MRP update against existing products (one request, server matches id/EAN)
  const runMrpImport = async () => {
    const rows = mrpImportRows.length ? mrpImportRows : parseMrpText(mrpImportText);
    if (!rows.length) { toast({ variant: 'destructive', title: 'No valid rows', description: 'Expected: key, mrp' }); return; }
    setMrpImporting(true); setMrpImportResult(null);
    try {
      const res  = await fetch('/api/admin/products/import-mrp', {
        method: 'POST', headers, body: JSON.stringify({ rows }),
      });
      const data = await res.json() as { updated?: number; notFound?: string[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      setMrpImportResult({ updated: data.updated ?? 0, notFound: data.notFound ?? [], total: data.total ?? rows.length });
      toast({ title: `Updated MRP on ${data.updated ?? 0} of ${data.total ?? rows.length} products` });
      void load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'MRP import failed', description: (e as Error).message });
    } finally { setMrpImporting(false); }
  };

  const parseMrpFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      setMrpImportText(text);
      setMrpImportRows(parseMrpText(text));
    };
    reader.readAsText(file);
  };

  // Pre-fill form from a suggestion
  const fillFromSuggestion = (s: typeof suggestions[0]) => {
    setEditId(null);
    setForm({
      ...BLANK,
      productName: s.productName,
      sizeVariant: s.weight ?? '',
    });
    setShowForm(true);
  };

  const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Product Catalogue</p>
          <p className="text-sm text-muted-foreground">{total} products · IDs: CAT-BRAND-SEQ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMrpImport((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
            <IndianRupee className="h-4 w-4" /> Import MRP
          </button>
          <button onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
            <FileSpreadsheet className="h-4 w-4" /> Bulk import
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Bulk MRP import panel — updates existing products from a price list */}
      {showMrpImport && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground flex items-center gap-2"><IndianRupee className="h-4 w-4 text-primary" /> Bulk update MRP from a price list</p>
            <button onClick={() => { setShowMrpImport(false); setMrpImportRows([]); setMrpImportText(''); setMrpImportResult(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Two columns (header optional): <span className="font-mono font-semibold">key, mrp</span> — where <span className="font-semibold">key</span> is the ALIVE product ID (e.g. GRO-KC-001) or the EAN barcode.
            Paste rows from a distributor Excel/price list, or drop a .csv/.tsv. Only existing products are updated — nothing new is created.
          </p>
          <textarea
            value={mrpImportText}
            onChange={(e) => { setMrpImportText(e.target.value); setMrpImportRows(parseMrpText(e.target.value)); }}
            placeholder={'GRO-KC-001, 299\n8901234567890, 120'}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {mrpImportRows.length} valid row{mrpImportRows.length !== 1 ? 's' : ''} detected
            </p>
            <div className="flex gap-2">
              <button onClick={() => mrpCsvRef.current?.click()}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                Pick file
              </button>
              <button onClick={runMrpImport} disabled={mrpImporting || mrpImportRows.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {mrpImporting ? 'Updating…' : `Update ${mrpImportRows.length} MRP${mrpImportRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
          {mrpImportResult && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-green-700">✓ Updated {mrpImportResult.updated} of {mrpImportResult.total}</p>
              {mrpImportResult.notFound.length > 0 && (
                <p className="text-amber-600">Not matched ({mrpImportResult.notFound.length}): <span className="font-mono">{mrpImportResult.notFound.slice(0, 12).join(', ')}{mrpImportResult.notFound.length > 12 ? '…' : ''}</span></p>
              )}
            </div>
          )}
          <input ref={mrpCsvRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseMrpFile(f); e.target.value = ''; }} />
        </div>
      )}

      {/* Bulk CSV import panel */}
      {showImport && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Bulk import from CSV / spreadsheet</p>
            <button onClick={() => { setShowImport(false); setImportRows([]); }}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Columns (header optional): <span className="font-mono font-semibold">productName, brand, category, sizeVariant, unitType, mrp, barcodeEan</span>
            <br />Drag a .csv/.tsv file, paste a spreadsheet selection, or pick a file.
          </p>
          {importRows.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={handleCsvDrop}
              onClick={() => csvInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-8 transition-colors ${
                importDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground/50">Drop CSV/TSV here or click to pick</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{importRows.length} rows ready to import</p>
              <div className="rounded-lg border border-border overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>{['Name','Brand','Cat','Size','Unit','MRP'].map(h => <th key={h} className="text-left px-3 py-1.5 font-semibold text-muted-foreground">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.productName}</td>
                        <td className="px-3 py-1.5">{r.brand}</td>
                        <td className="px-3 py-1.5">{r.category}</td>
                        <td className="px-3 py-1.5">{r.sizeVariant}</td>
                        <td className="px-3 py-1.5">{r.unitType}</td>
                        <td className="px-3 py-1.5">{r.mrp ? `₹${r.mrp}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importing && (
                <p className="text-xs text-primary font-semibold">{importDone} / {importRows.length} imported…</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setImportRows([])} className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-muted-foreground">Clear</button>
                <button onClick={bulkImport} disabled={importing}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {importing ? `Importing ${importDone}/${importRows.length}…` : `Import ${importRows.length} products`}
                </button>
              </div>
            </div>
          )}
          <input ref={csvInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCsvFile(f); }} />
        </div>
      )}

      {/* Store partner product suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <button
            onClick={() => setShowSuggestions((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-bold text-amber-800">{suggestions.length} new product{suggestions.length !== 1 ? 's' : ''} from store offers not in catalogue</p>
            </div>
            {showSuggestions ? <ChevronUp className="h-4 w-4 text-amber-500" /> : <ChevronDown className="h-4 w-4 text-amber-500" />}
          </button>
          {showSuggestions && (
            <div className="mt-3 space-y-1.5">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{s.productName}</p>
                    {s.weight && <p className="text-[10px] text-muted-foreground">{s.weight}</p>}
                    <p className="text-[10px] text-muted-foreground/60">{s.count} store{s.count !== 1 ? 's' : ''} listed this</p>
                  </div>
                  <button onClick={() => fillFromSuggestion(s)}
                    className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-600 shrink-0">
                    <Plus className="h-3 w-3" /> Add to catalogue
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or brand…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm bg-background">
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">Product ID</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">Name / Brand</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground hidden md:table-cell">Size</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground hidden lg:table-cell">MRP</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted-foreground">Image</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Loading…</td></tr>
            )}
            {!loading && products.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">No products yet. Add the first one.</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-primary">{p.id}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.category}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground leading-tight">{p.productName}</p>
                  <p className="text-xs text-muted-foreground">{p.brand}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.sizeVariant}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{p.mrp ? `₹${p.mrp}` : '—'}</span>
                    {p.barcodeEan && (
                      <button onClick={() => lookupBarcode(p)} disabled={bcId === p.id}
                        title="Look up by barcode (Open Food Facts)"
                        className="p-1 rounded text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                        {bcId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Barcode className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button onClick={() => fetchMrp(p)} disabled={mrpId === p.id}
                      title="Fetch MRP from Amazon / Flipkart"
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/5 disabled:opacity-50">
                      {mrpId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.imageUrl ? (
                    <div className="flex items-center gap-1.5">
                      <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imageUrl} alt={p.productName} className="h-10 w-10 rounded object-contain bg-muted" />
                        {p.imageIsAi && (
                          <span className="absolute -top-1 -right-1 rounded bg-violet-600 px-1 text-[8px] font-bold text-white leading-tight">AI</span>
                        )}
                      </div>
                      {p.imageIsAi && (
                        <label title="Replace with a real photo" className="cursor-pointer p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/5">
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(p.id, f); }} />
                          <Upload className="h-3 w-3" />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <label className="cursor-pointer" title="Upload a real photo">
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(p.id, f); }} />
                        <div className="h-10 w-10 rounded border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                          <Upload className="h-3.5 w-3.5" />
                        </div>
                      </label>
                      <button onClick={() => generateImage(p.id)} disabled={genId === p.id}
                        title="Generate image with AI"
                        className="h-10 w-10 rounded border-2 border-dashed border-violet-300 flex items-center justify-center text-violet-500 hover:border-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-50">
                        {genId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 text-sm rounded border border-border disabled:opacity-40">← Prev</button>
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="px-3 py-1 text-sm rounded border border-border disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">{editId ? `Edit ${editId}` : 'New Product'}</h3>
              </div>
              <button onClick={closeForm}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            {!editId && (
              <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                Product ID is auto-assigned as <span className="font-mono font-semibold">CAT-BRAND-SEQ</span>  e.g. GRO-KC-001
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</label>
                <input value={form.productName} onChange={(e) => set('productName', e.target.value)} placeholder="Cow Ghee Jar" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand</label>
                <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="KC Ghee" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
                <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inp}>
                  {CATEGORY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size / Variant</label>
                <input value={form.sizeVariant} onChange={(e) => set('sizeVariant', e.target.value)} placeholder="1 Ltr" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Type</label>
                <select value={form.unitType} onChange={(e) => set('unitType', e.target.value)} className={inp}>
                  {UNIT_TYPES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MRP (₹, optional)</label>
                <input type="number" value={form.mrp ?? ''} onChange={(e) => set('mrp', e.target.value ? Number(e.target.value) : null)} placeholder="299" className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">EAN Barcode (optional)</label>
                <input value={form.barcodeEan ?? ''} onChange={(e) => set('barcodeEan', e.target.value || null)} placeholder="8901234567890" className={inp} />
              </div>
            </div>

            {/* Product image drag-and-drop (new products only) */}
            {!editId && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Product image <span className="normal-case font-normal text-muted-foreground/60">(PNG without background works best)</span>
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setFormImgDragOver(true); }}
                  onDragLeave={() => setFormImgDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setFormImgDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (!file || !file.type.startsWith('image/')) return;
                    setFormImgFile(file);
                    const r = new FileReader();
                    r.onload = () => setFormImgPreview(r.result as string);
                    r.readAsDataURL(file);
                  }}
                  onClick={() => formImgRef.current?.click()}
                  className={`relative flex items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors h-28 overflow-hidden ${
                    formImgDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  }`}
                >
                  {formImgPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formImgPreview} alt="preview" className="h-full max-h-28 w-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
                      <Upload className="h-5 w-5" />
                      <span className="text-xs font-semibold">Drop PNG here or click to pick</span>
                    </div>
                  )}
                </div>
                <input ref={formImgRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setFormImgFile(file);
                    const r = new FileReader();
                    r.onload = () => setFormImgPreview(r.result as string);
                    r.readAsDataURL(file);
                    e.target.value = '';
                  }} />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={closeForm} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? 'Saving…' : <><Check className="h-4 w-4" /> {editId ? 'Update' : 'Create'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {imgUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl px-6 py-4 text-sm font-semibold">Uploading image…</div>
        </div>
      )}

      {/* MRP fetch in progress */}
      {mrpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl px-6 py-4 text-sm font-semibold flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Fetching prices from Amazon &amp; Flipkart…
          </div>
        </div>
      )}

      {/* Barcode lookup in progress */}
      {bcId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl px-6 py-4 text-sm font-semibold flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Looking up barcode on Open Food Facts…
          </div>
        </div>
      )}

      {/* MRP candidates — review before applying */}
      {mrpFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-xl p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-foreground flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> MRP candidates</p>
                <p className="text-xs text-muted-foreground">{mrpFor.brand} {mrpFor.productName} · {mrpFor.sizeVariant}</p>
              </div>
              <button onClick={() => setMrpFor(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Verify before applying. Barcode (Open Food Facts) prices are real receipts; Amazon/Flipkart figures are usually the MRP at the highest seller.
            </p>
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {mrpCands.map((c, i) => (
                <button key={i} onClick={() => applyMrp(mrpFor.id, c.price)}
                  className="flex items-center justify-between w-full gap-3 rounded-lg border border-border px-3 py-2 text-left hover:border-primary hover:bg-primary/5 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{c.title}</p>
                    <span className={`text-[10px] font-bold uppercase ${c.source === 'amazon' ? 'text-amber-600' : c.source === 'flipkart' ? 'text-blue-600' : 'text-emerald-600'}`}>{c.source === 'openfoodfacts' ? 'Open Food Facts' : c.source}</span>
                  </div>
                  <span className="font-bold text-foreground shrink-0">₹{c.price}</span>
                </button>
              ))}
            </div>
            {mrpNote && <p className="text-[11px] text-muted-foreground bg-muted rounded-lg px-3 py-2">{mrpNote}</p>}
            {mrpErrors.length > 0 && <p className="text-[10px] text-amber-600">{mrpErrors.join(' · ')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
