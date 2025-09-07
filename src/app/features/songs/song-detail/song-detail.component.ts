// src/app/songs/song-detail/song-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-song-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-detail.component.html',
  styleUrls: ['./song-detail.component.scss']
})
export class SongDetailComponent implements OnInit {
  song: any = null;
  loading = true;

  // ===== Transpose state =====
  originalKey: string = 'C'; // DB has no key column; default to C
  displayKey: string = 'C';
  keys: string[] = ['Ab','A','Bb','B','Cb','C','C#','Db','D','Eb','E','F','F#','Gb','G','NN'];

  private originalLyrics: any = null; // pristine copy to transpose from

  // modal / setlist state
  isModalOpen = false;
  creatingNew = false;
  actionLoading = false;

  setlists: Array<{ id: string; name: string }> = [];
  selectedSetlistId: string | null = null;
  newSetlistName: string = '';

  // feedback
  errorMsg: string | null = null;
  successMsg: string | null = null;

  // ===== Delete state =====
  isDeleteOpen = false;
  deleteLoading = false;
  deleteError: string | null = null;

  constructor(private route: ActivatedRoute, private location: Location) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching song:', error);
      this.loading = false;
      return;
    }

    this.song = { ...data };

    // Authors -> ensure array
    if (typeof this.song.authors === 'string') {
      try { this.song.authors = JSON.parse(this.song.authors); } catch { this.song.authors = []; }
    }
    if (!Array.isArray(this.song.authors)) {
      this.song.authors = Array.isArray(this.song.authors) ? this.song.authors : (this.song.authors ? [this.song.authors] : []);
    }

    // Lyrics jsonb -> support { raw: "..." } or plain string/array/object
    let lyr = this.song.lyrics;
    if (typeof lyr === 'string') {
      try { lyr = JSON.parse(lyr); } catch { /* keep as string */ }
    }
    if (lyr && typeof lyr === 'object' && 'raw' in lyr && typeof lyr.raw === 'string') {
      lyr = lyr.raw;
    }
    this.song.lyrics = lyr;
    this.originalLyrics = this.deepClone(this.song.lyrics);

    // Key defaults (no key column in DB)
    this.originalKey = this.normalizeKey('C');
    this.displayKey = this.originalKey;

    // Signed audio (if present)
    if (this.song.audio_path) {
      await this.safeSignToUrl('audio_path', 'audio_url');
    }

    // Signed PDF (if present)
    if (this.song.pdf_path) {
      await this.safeSignToUrl('pdf_path', 'pdf_url');
    }

    // Fallback via manifest (json_path)
    if ((!this.song.pdf_path || !this.song.reference_links?.length || !this.song.audio_path) && this.song.json_path) {
      try {
        const manifestUrl = await this.signRead(this.song.json_path);
        if (manifestUrl) {
          const res = await fetch(manifestUrl);
          if (res.ok) {
            const m = await res.json();
            if (!this.song.pdf_path && m?.pdf_path) {
              this.song.pdf_path = m.pdf_path;
              await this.safeSignToUrl('pdf_path', 'pdf_url');
            }
            if (!this.song.reference_links?.length && Array.isArray(m?.reference_links)) {
              this.song.reference_links = m.reference_links;
            }
            if (!this.song.audio_path && m?.audio_path) {
              this.song.audio_path = m.audio_path;
              await this.safeSignToUrl('audio_path', 'audio_url');
            }
          }
        }
      } catch (e) {
        console.warn('Manifest fetch failed:', e);
      }
    }

    this.loading = false;
  }

  // ===== Delete action (custom songs only) =====
  async confirmDelete() {
    if (!this.song?.id) return;
    this.deleteError = null;
    this.deleteLoading = true;

    try {
      // Guard on the client as well (HTML already hides for non-custom)
      if (!this.song.is_custom) {
        throw new Error('This song cannot be deleted.');
      }

      const res = await fetch('/.netlify/functions/song-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: this.song.id }),
      });

      let payload: any = null;
      try { payload = await res.clone().json(); } catch {}

      if (!res.ok || payload?.error) {
        const msg = payload?.error || `Delete failed (${res.status})`;
        throw new Error(msg);
      }

      // Success → close and navigate away
      this.isDeleteOpen = false;
      window.location.href = '/songs';
    } catch (e: any) {
      console.error('Delete failed:', e);
      this.deleteError = e?.message || 'Delete failed';
    } finally {
      this.deleteLoading = false;
    }
  }

  // Helper: sign DB key to temp URL and stash as *_url
  private async safeSignToUrl(pathField: 'audio_path' | 'pdf_path', urlField: 'audio_url' | 'pdf_url') {
    const key = this.song?.[pathField];
    if (!key) return;
    try {
      const url = await this.signRead(
        key,
        this.inferContentType(key),
        pathField === 'pdf_path' ? `${this.song?.title || 'chart'}.pdf` : undefined
      );
      if (url) this.song[urlField] = url;
    } catch (e) {
      console.error(`❌ signing ${pathField} failed:`, e);
    }
  }

  // Primary signer uses unified function: /.netlify/functions/b2-sign
  // Falls back to the older read-only route if present.
  private async signRead(objectKey: string, contentType?: string, download?: string): Promise<string | null> {
    const qs = new URLSearchParams({
      path: objectKey,
      expires: '600',
      ...(contentType ? { contentType } : {}),
      ...(download ? { download } : {}),
    });
    // 1) unified signer
    let res = await fetch(`/.netlify/functions/b2-sign?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      return json?.url || null;
    }
    // 2) fallback to legacy read signer (if still present)
    res = await fetch(`/.netlify/functions/b2-sign-read?path=${encodeURIComponent(objectKey)}`);
    if (res.ok) {
      const json = await res.json();
      return json?.url || null;
    }
    return null;
  }

  // Guess a reasonable content type for B2 GET response headers
  private inferContentType(key: string): string | undefined {
    const lower = key.toLowerCase();
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.json')) return 'application/json';
    return undefined;
  }

  // Derived: do we actually have lyrics?
  get hasLyrics(): boolean {
    const l = this.originalLyrics ?? this.song?.lyrics;
    if (!l) return false;
    if (typeof l === 'string') return l.trim().length > 0;
    if (Array.isArray(l)) return l.length > 0;
    if (typeof l === 'object') return Object.keys(l).length > 0;
    return false;
  }

  // ===============================
  // ===== Derived render data =====
  // ===============================
  get isNN(): boolean {
    return (this.displayKey || '').toUpperCase() === 'NN';
  }

  get transposedLyrics(): any {
    if (!this.originalLyrics) return this.song?.lyrics;

    if (this.isNN) {
      const baseKey = this.originalKey;
      if (typeof this.originalLyrics === 'string') {
        return this.textToNashville(this.originalLyrics, baseKey);
      }
      if (Array.isArray(this.originalLyrics)) {
        return this.originalLyrics.map(line =>
          (typeof line === 'string') ? this.textToNashville(line, baseKey) : line
        );
      }
      if (typeof this.originalLyrics === 'object' && this.originalLyrics !== null) {
        const out: any = {};
        for (const sec of Object.keys(this.originalLyrics)) {
          const block = this.originalLyrics[sec];
          if (Array.isArray(block)) {
            out[sec] = block.map(l => (typeof l === 'string') ? this.textToNashville(l, baseKey) : l);
          } else if (typeof block === 'string') {
            out[sec] = this.textToNashville(block, baseKey);
          } else {
            out[sec] = block;
          }
        }
        return out;
      }
      return this.song?.lyrics ?? this.originalLyrics;
    }

    // Normal chord transposition
    const fromKey = this.originalKey;
    const toKeyDisplay = this.displayKey || fromKey;
    const toKeyCanonical = this.normalizeKey(toKeyDisplay);

    if (!fromKey || !toKeyCanonical || this.compareKeys(fromKey, toKeyCanonical)) {
      return this.song?.lyrics ?? this.originalLyrics;
    }

    const semis = this.keyDistance(fromKey, toKeyCanonical);

    if (typeof this.originalLyrics === 'string') {
      return this.transposeTextBlock(this.originalLyrics, semis, toKeyDisplay);
    }
    if (Array.isArray(this.originalLyrics)) {
      return this.originalLyrics.map(line =>
        (typeof line === 'string') ? this.transposeTextBlock(line, semis, toKeyDisplay) : line
      );
    }
    if (typeof this.originalLyrics === 'object' && this.originalLyrics !== null) {
      const out: any = {};
      for (const sec of Object.keys(this.originalLyrics)) {
        const block = this.originalLyrics[sec];
        if (Array.isArray(block)) {
          out[sec] = block.map(l => (typeof l === 'string') ? this.transposeTextBlock(l, semis, toKeyDisplay) : l);
        } else if (typeof block === 'string') {
          out[sec] = this.transposeTextBlock(block, semis, toKeyDisplay);
        } else {
          out[sec] = block;
        }
      }
      return out;
    }
    return this.song?.lyrics ?? this.originalLyrics;
  }

  // ==========================
  // ===== Template utils =====
  // ==========================
  isString(val: any): val is string { return typeof val === 'string'; }
  isArray(val: any): boolean { return Array.isArray(val); }
  isObject(val: any): boolean { return val && typeof val === 'object' && !Array.isArray(val); }
  asArray<T = any>(val: unknown): T[] { return Array.isArray(val) ? (val as T[]) : []; }

  // Enharmonic hint
  enharmonicLabel(k: string): string | null {
    if (this.isNN) return null;
    const root = k?.trim(); if (!root) return null;
    const m = root.match(/^([A-Ga-g])([#b]?)$/); if (!m) return null;
    const r = (m[1] + (m[2] || '')).toUpperCase();
    const pair: Record<string,string> = {
      'A#':'Bb','Bb':'A#',
      'C#':'Db','Db':'C#',
      'D#':'Eb','Eb':'D#',
      'F#':'Gb','Gb':'F#',
      'G#':'Ab','Ab':'G#'
    };
    return pair[r] || null;
  }

  onKeyChange(newKey: string) { this.displayKey = newKey; }

  // ===== Back button =====
  goBack() {
    if (window.history.length > 1) this.location.back();
    else window.location.href = '/songs';
  }

  // ===== Setlist flow placeholders =====
  async openAddToSetlist() {
    if (!this.song) return;
    this.creatingNew = false;
    this.selectedSetlistId = null;
    this.newSetlistName = '';
    this.errorMsg = null;
    this.successMsg = null;
    await this.loadSetlists();
    this.isModalOpen = true;
  }
  closeModal() {
    this.isModalOpen = false;
    this.selectedSetlistId = null;
    this.newSetlistName = '';
    this.actionLoading = false;
    this.errorMsg = null;
    this.successMsg = null;
  }
  async loadSetlists() {
    const { data, error } = await supabase
      .from('setlists')
      .select('id, name')
      .order('created_at', { ascending: false });
    this.setlists = error ? [] : (data || []).map(r => ({ id: r.id, name: r.name }));
  }
  async addToExisting() { /* your app code */ }
  async createSetlistAndAdd() { /* your app code */ }

  // =========================
  // ===== Music theory  =====
  // =========================
  private SHARP_SCALE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  private FLAT_SCALE  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

  private ENHARMONIC_WEIRD: Record<string,string> = { 'B#':'C','E#':'F','Cb':'B','Fb':'E' };
  private FLAT_PREFERRED_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Cb']);

  private deepClone<T>(x: T): T { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  private normalizeKey(k: string): string {
    if (!k) return 'C';
    const s = k.trim();
    const m = s.match(/^([A-Ga-g])([#b]?)$/);
    if (!m) return 'C';
    const base = m[1].toUpperCase() + (m[2] || '');
    return this.ENHARMONIC_WEIRD[base] || base;
  }

  private compareKeys(a: string, b: string): boolean { return this.normalizeKey(a) === this.normalizeKey(b); }

  private toCanonicalNote(n: string): string {
    const m = n.match(/^([A-Ga-g])([#b]?)$/);
    if (!m) return 'C';
    const base = m[1].toUpperCase() + (m[2] || '');
    return this.ENHARMONIC_WEIRD[base] || base;
  }

  private noteIndex(note: string, useFlats: boolean): number {
    const canon = this.toCanonicalNote(note);
    const scale = useFlats ? this.FLAT_SCALE : this.SHARP_SCALE;
    let idx = scale.indexOf(canon);
    if (idx >= 0) return idx;
    const other = useFlats ? this.SHARP_SCALE : this.FLAT_SCALE;
    idx = other.indexOf(canon);
    return idx >= 0 ? idx : 0;
  }

  private keyDistance(fromKey: string, toKey: string): number {
    const fromRoot = this.toCanonicalNote(fromKey);
    const toRoot   = this.toCanonicalNote(toKey);
    const a = this.noteIndex(fromRoot, false), b = this.noteIndex(toRoot, false);
    let d = b - a; if (d > 6) d -= 12; if (d < -6) d += 12; return d;
  }

  private transposeNote(note: string, semis: number, preferFlats: boolean): string {
    const fromIdx = this.noteIndex(note, preferFlats);
    let idx = (fromIdx + semis) % 12; if (idx < 0) idx += 12;
    const scale = preferFlats ? this.FLAT_SCALE : this.SHARP_SCALE;
    return scale[idx];
  }

  private shouldPreferFlatsForKey(key: string): boolean {
    return this.FLAT_PREFERRED_KEYS.has(this.normalizeKey(key));
  }

  private transposeChordSymbol(sym: string, semis: number, toKeyDisplay: string): string {
    const trimmed = sym.trim();
    if (!trimmed || /^N\.?C\.?$/i.test(trimmed)) return sym;

    const m = trimmed.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return sym;

    const root = (m[1] + (m[2] || '')).toUpperCase();
    let rest  = m[3] || '';

    // Slash bass
    let slash = '';
    const slashIdx = rest.indexOf('/');
    if (slashIdx >= 0) { slash = rest.slice(slashIdx + 1); rest = rest.slice(0, slashIdx); }

    const preferFlats = this.shouldPreferFlatsForKey(toKeyDisplay);
    const newRoot = this.transposeNote(root, semis, preferFlats);

    let newBass = '';
    if (slash) {
      const bassMatch = slash.match(/^([A-Ga-g])([#b]?)(.*)$/);
      if (bassMatch) {
        const bassNote = (bassMatch[1] + (bassMatch[2] || '')).toUpperCase();
        const bassRest = bassMatch[3] || '';
        newBass = this.transposeNote(bassNote, semis, preferFlats) + bassRest;
      } else {
        newBass = slash;
      }
    }

    return newBass ? `${newRoot}${rest}/${newBass}` : `${newRoot}${rest}`;
  }

  private transposeTextBlock(text: string, semis: number, toKeyDisplay: string): string {
    if (!text) return text;
    let out = text;

    // Inline chord tags: [C], [G/B], [F#m7]
    out = out.replace(/\[([^\]]+)\]/g, (_full, inside: string) => {
      const parts = inside.split(/\s+/).map(tok =>
        this.transposeChordSymbol(tok, semis, toKeyDisplay)
      );
      return `[${parts.join(' ')}]`;
    });

    // Standalone chord tokens
    const chordToken = /(?<![\w/#b])([A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add)?\d*(?:[#\+\-°ø])?(?:\/[A-G](?:#|b)?)?)(?![\w/#b])/g;
    out = out.replace(chordToken, (match: string) => this.transposeChordSymbol(match, semis, toKeyDisplay));
    return out;
  }

  // ===== Nashville Numbers =====
  private MAJOR_SCALE_SEMIS = [0, 2, 4, 5, 7, 9, 11]; // 1..7

  private degreeForNote(note: string, key: string): { label: string, offset: number } {
    const keyIdx = this.noteIndex(this.normalizeKey(key), false);
    const noteIdx = this.noteIndex(this.toCanonicalNote(note), false);
    let rel = noteIdx - keyIdx; if (rel < 0) rel += 12;

    let bestDeg = 0, bestDiff = 99;
    for (let i = 0; i < 7; i++) {
      const target = this.MAJOR_SCALE_SEMIS[i];
      let diff = rel - target;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      if (Math.abs(diff) < Math.abs(bestDiff)) {
        bestDiff = diff;
        bestDeg = i + 1;
      }
    }
    const accidental = bestDiff === 0 ? '' : (bestDiff < 0 ? 'b' : '#');
    return { label: accidental + String(bestDeg), offset: bestDiff };
  }

  private chordToNashville(sym: string, key: string): string {
    const trimmed = sym.trim();
    if (!trimmed || /^N\.?C\.?$/i.test(trimmed)) return 'N.C.';

    const m = trimmed.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!m) return sym;

    const root = (m[1] + (m[2] || '')).toUpperCase();
    let rest = m[3] || '';

    // detect slash bass
    let slash = '';
    const sIdx = rest.indexOf('/');
    if (sIdx >= 0) { slash = rest.slice(sIdx + 1); rest = rest.slice(0, sIdx); }

    // detect minor (but not 'maj')
    const minor = /(^|[^a-zA-Z])m(?!aj)/.test(rest);
    const ext = rest.replace(/^m(?!aj)/, '');

    const deg = this.degreeForNote(root, key);
    const base = (minor ? (deg.label + '-') : deg.label) + ext;

    if (slash) {
      const bm = slash.match(/^([A-Ga-g])([#b]?)(.*)$/);
      if (bm) {
        const bassNote = (bm[1] + (bm[2] || '')).toUpperCase();
        const bassRest = bm[3] || '';
        const bdeg = this.degreeForNote(bassNote, key);
        const bass = bdeg.label + bassRest;
        return `${base}/${bass}`;
      }
      return `${base}/${slash}`;
    }
    return base;
  }

  private textToNashville(text: string, key: string): string {
    if (!text) return text;
    let out = text;

    // [C], [G/B] → [1], [5/7], etc.
    out = out.replace(/\[([^\]]+)\]/g, (_full, inside: string) => {
      const parts = inside.split(/\s+/).map(tok => this.chordToNashville(tok, key));
      return `[${parts.join(' ')}]`;
    });

    // Standalone chord tokens → Nashville
    const chordToken = /(?<![\w/#b])([A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add)?\d*(?:[#\+\-°ø])?(?:\/[A-G](?:#|b)?)?)(?![\w/#b])/g;
    out = out.replace(chordToken, (match: string) => this.chordToNashville(match, key));

    return out;
  }
}
