// src/app/songs/song-create/song-create.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

type NewSong = {
  title: string;
  artist?: string;
  authorsText?: string;
  key?: string;               // UI only; not written to DB
  song_map?: string;
  tempo?: string;
  time_signature?: string;
  meter?: string;
  style?: string;
  lyrics?: string;            // raw text from form
  reference_links?: string[]; // UI only; mapped to tags in DB
  audio_path?: string | null; // DB column exists
  pdf_path?: string | null;   // DB column exists
};

@Component({
  selector: 'app-song-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-create.component.html',
  styleUrls: ['./song-create.component.scss']
})
export class SongCreateComponent {
  // UI only
  keys = ['Ab','A','Bb','B','Cb','C','C#','Db','D','Eb','E','F','F#','Gb','G','NN'];

  saving = false;
  errorMsg: string | null = null;
  successMsg: string | null = null;

  audioFile: File | null = null;
  pdfFile: File | null = null;

  // links (UI) -> mapped to tags (text[]) in DB
  links: string[] = [''];

  newSong: NewSong = {
    title: '',
    artist: '',
    authorsText: '',
    key: 'NN',
    song_map: '',
    tempo: '',
    time_signature: '',
    meter: '',
    style: '',
    lyrics: '',
    reference_links: [],
    audio_path: null,
    pdf_path: null,
  };

  constructor(private router: Router) {}

  // ---------- files ----------
  onAudioSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.audioFile = input.files?.[0] || null;
  }
  onPdfSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.pdfFile = input.files?.[0] || null;
  }

  // ---------- links ----------
  addLinkRow() { this.links.push(''); }
  removeLinkRow(i: number) {
    this.links.splice(i, 1);
    if (this.links.length === 0) this.links.push('');
  }

  // ---------- submit ----------
  async submit(form: NgForm) {
    this.errorMsg = null;
    this.successMsg = null;

    if (!form.valid || !this.newSong.title?.trim()) {
      this.errorMsg = 'Please enter at least a song title.';
      return;
    }

    this.saving = true;
    try {
      // unique, stable folder & ids
      const folder = `songs/${this.computeSongFolder(this.newSong.title)}`;
      const external_id = folder;              // satisfies NOT NULL
      const json_path = `${folder}/song.json`; // satisfies NOT NULL

      // Upload PDF first (optional)
      let pdf_path: string | null = null;
      if (this.pdfFile) {
        const pdfExt = this.fileExt(this.pdfFile.name) || 'pdf';
        const pdfKey = `${folder}/chart.${pdfExt}`;
        pdf_path = await this.uploadToB2(this.pdfFile, pdfKey);
      }

      // Upload audio (optional)
      let audio_path: string | null = null;
      if (this.audioFile) {
        const mp3Ext = this.fileExt(this.audioFile.name) || 'mp3';
        const mp3Key = `${folder}/audio.${mp3Ext}`;
        audio_path = await this.uploadToB2(this.audioFile, mp3Key);
      }

      // Build authors array
      const authorsArray = (this.newSong.authorsText || '')
        .split(',').map(s => s.trim()).filter(Boolean);

      // links -> tags (text[])
      const cleanLinks = this.links.map(s => s.trim()).filter(Boolean);
      const tags = cleanLinks.length ? cleanLinks : null;

      // lyrics must be jsonb
      const lyricsJson = (this.newSong.lyrics || '').trim()
        ? { raw: this.newSong.lyrics!.trim() }
        : null;

      // Create a tiny JSON manifest to match json_path
      const manifest = {
        title: this.newSong.title.trim(),
        artist: this.newSong.artist?.trim() || null,
        createdAt: new Date().toISOString(),
        pdf_path,          // might be null
        audio_path,        // might be null
        authors: authorsArray,
        reference_links: cleanLinks,
      };
      await this.uploadJsonToB2(json_path, manifest);

      // Build DB row (existing columns only)
      const payload: any = {
        external_id,                                // NOT NULL
        json_path,                                  // NOT NULL
        title: this.newSong.title.trim(),
        artist: this.newSong.artist?.trim() || null,
        authors: authorsArray.length ? authorsArray : null,  // jsonb
        song_map: this.newSong.song_map?.trim() || null,
        tempo: this.newSong.tempo?.trim() || null,
        time_signature: this.newSong.time_signature?.trim() || null,
        meter: this.newSong.meter?.trim() || null,
        style: this.newSong.style?.trim() || null,
        lyrics: lyricsJson,                         // jsonb
        tags,                                       // text[]
        audio_path,                                 // text (nullable)
        pdf_path,                                   // text (nullable)
        is_custom: true,                            // ✅ mark as custom for safe deletion later
      };

      const { data, error } = await supabase
        .from('songs')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      this.successMsg = 'Song created!';
      setTimeout(() => {
        if (data?.id) this.router.navigate(['/songs', data.id]);
        else this.router.navigate(['/songs']);
      }, 700);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || 'Failed to create song.');
      if (msg.includes('CORS') || msg.includes("No 'Access-Control-Allow-Origin'")) {
        this.errorMsg = 'Upload blocked by CORS. Make sure your Backblaze S3 CORS rules allow your origin and PUT.';
      } else if (msg.includes('SignatureDoesNotMatch') || msg.includes('403')) {
        this.errorMsg = 'Upload failed (403). Ensure the Content-Type used to sign exactly matches the PUT request.';
      } else {
        this.errorMsg = msg;
      }
    } finally {
      this.saving = false;
    }
  }

  // ---------- helpers ----------
  private async uploadToB2(file: File, objectKey: string): Promise<string> {
    const contentType = file.type || 'application/octet-stream';
    // unified signer (handles GET + POST)
    const signRes = await fetch('/.netlify/functions/b2-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey, contentType })
    });

    let data: any;
    try {
      data = await signRes.clone().json();
    } catch {
      const text = await signRes.text();
      throw new Error(`Signer failed (${signRes.status}): ${text.slice(0, 300)}`);
    }
    if (!signRes.ok || !data?.url) {
      throw new Error(data?.error || data?.message || 'Signer did not return a URL');
    }
    const signedPutUrl: string = data.url;

    const putRes = await fetch(signedPutUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType }, // MUST match what was signed
      body: file,
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`Upload failed (${putRes.status}): ${text.slice(0, 500)}`);
    }

    return objectKey;
  }

  private async uploadJsonToB2(objectKey: string, data: unknown): Promise<string> {
    const contentType = 'application/json';
    const signRes = await fetch('/.netlify/functions/b2-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey, contentType })
    });

    let resJson: any;
    try {
      resJson = await signRes.clone().json();
    } catch {
      const text = await signRes.text();
      throw new Error(`Signer failed (${signRes.status}): ${text.slice(0, 300)}`);
    }
    if (!signRes.ok || !resJson?.url) {
      throw new Error(resJson?.error || resJson?.message || 'Signer did not return a URL');
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: contentType });

    const putRes = await fetch(resJson.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`Upload (JSON) failed (${putRes.status}): ${text.slice(0, 500)}`);
    }

    return objectKey;
  }

  private computeSongFolder(title: string): string {
    const base = title.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `${base}_${Date.now()}`;
  }

  private fileExt(name: string): string | null {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : null;
  }
}
