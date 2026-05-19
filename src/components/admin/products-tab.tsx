'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Package, Upload, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CATEGORY_OPTIONS, UNIT_TYPES } from '@/lib/product-id';

type Product = {
  id: string; groupId: string; productName: string; brand: string;
  category: string; sizeVariant: string; unitType: string;
  mrp: number | null; imageUrl: string | null; barcodeEan: string | null; isActive: boolean;
};

const BLANK: Omit<Product, 'id' | 'groupId' | 'isActive'> = {
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

  const openNew  = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({ productName: p.productName, brand: p.brand, category: p.category,
      sizeVariant: p.sizeVariant, unitType: p.unitType, mrp: p.mrp,
      imageUrl: p.imageUrl, barcodeEan: p.barcodeEan });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); };

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
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'products');
      const up  = await fetch('/api/admin/r2-upload', { method: 'POST', headers: { 'admin-password': adminPw }, body: fd });
      if (!up.ok) throw new Error('Upload failed');
      const { url } = await up.json() as { url: string };
      await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ imageUrl: url }),
      });
      toast({ title: 'Image uploaded ✓' });
      void load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Image upload failed', description: (e as Error).message });
    } finally { setImgUploading(false); }
  };

  const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Product Catalogue</p>
          <p className="text-sm text-muted-foreground">{total} products · IDs: CAT-BRAND-SEQ</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

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
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.mrp ? `₹${p.mrp}` : '—'}</td>
                <td className="px-4 py-3">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.productName} className="h-10 w-10 rounded object-contain bg-muted" />
                  ) : (
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(p.id, f); }} />
                      <div className="h-10 w-10 rounded border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                      </div>
                    </label>
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
    </div>
  );
}
