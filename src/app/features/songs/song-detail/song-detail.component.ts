import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';  // 👈 add this
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

  constructor(private route: ActivatedRoute, private location: Location) {} // 👈 inject Location

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    // Fetch the song
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

    this.song = data;

    // Parse authors/lyrics if stored as JSON strings
    if (typeof this.song.authors === 'string') {
      try { this.song.authors = JSON.parse(this.song.authors); } catch { this.song.authors = []; }
    }
    if (typeof this.song.lyrics === 'string') {
      try { this.song.lyrics = JSON.parse(this.song.lyrics); } catch { this.song.lyrics = {}; }
    }

    // Signed audio URL (optional)
    if (this.song.audio_path) {
      try {
        const res = await fetch(`/.netlify/functions/b2-sign?path=${encodeURIComponent(this.song.audio_path)}`);
        const json = await res.json();
        if (json.url) this.song.audio_url = json.url;
      } catch (err) {
        console.error('❌ Exception fetching signed URL:', err);
      }
    }

    this.loading = false;
  }

  // ===== Back button =====
  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      // fallback to catalog if no history
      window.location.href = '/songs';
    }
  }

  // ===== Add-to-setlist flow (matches catalog) =====
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

    if (error) {
      console.error('Error loading setlists:', error);
      this.setlists = [];
    } else {
      this.setlists = data || [];
    }
  }

  async addToExisting() {
    if (!this.song || !this.selectedSetlistId) return;

    this.errorMsg = null;
    this.successMsg = null;
    this.actionLoading = true;

    try {
      // Check duplicate
      const { data: existing, error: checkErr } = await supabase
        .from('setlist_songs')
        .select('id')
        .eq('setlist_id', this.selectedSetlistId)
        .eq('song_id', this.song.id)
        .limit(1);

      if (checkErr) throw checkErr;
      if (existing && existing.length) {
        this.successMsg = 'This song is already in that setlist.';
        this.actionLoading = false;
        return;
      }

      // Next position
      const { data: posRow, error: posErr } = await supabase
        .from('setlist_songs')
        .select('position')
        .eq('setlist_id', this.selectedSetlistId)
        .order('position', { ascending: false })
        .limit(1);

      if (posErr) throw posErr;

      const nextPos = (posRow && posRow[0]?.position ? posRow[0].position : 0) + 1;

      // Insert
      const { error: insertErr } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: this.selectedSetlistId,
          song_id: this.song.id,
          position: nextPos
        });

      if (insertErr) throw insertErr;

      this.successMsg = 'Added to setlist!';
      setTimeout(() => this.closeModal(), 600);
    } catch (e: any) {
      console.error(e);
      this.errorMsg = e?.message || 'Failed to add to setlist.';
    } finally {
      this.actionLoading = false;
    }
  }

  async createSetlistAndAdd() {
    if (!this.song || !this.newSetlistName?.trim()) return;

    this.errorMsg = null;
    this.successMsg = null;
    this.actionLoading = true;

    try {
      // Create setlist WITHOUT date (assumes DB default or nullable)
      const { data: created, error: createErr } = await supabase
        .from('setlists')
        .insert({ name: this.newSetlistName.trim() })
        .select('id')
        .single();

      if (createErr) throw createErr;

      const newId = created.id as string;

      // First song at position 1
      const { error: insertErr } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: newId,
          song_id: this.song.id,
          position: 1
        });

      if (insertErr) throw insertErr;

      this.successMsg = 'Setlist created and song added!';
      setTimeout(() => this.closeModal(), 700);
    } catch (e: any) {
      console.error(e);
      this.errorMsg = e?.message || 'Failed to create setlist.';
    } finally {
      this.actionLoading = false;
    }
  }
}
