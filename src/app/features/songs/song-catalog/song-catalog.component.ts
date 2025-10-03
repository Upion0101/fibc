import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-song-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './song-catalog.component.html',
  styleUrls: ['./song-catalog.component.scss']
})
export class SongCatalogComponent implements OnInit {
  songs: any[] = [];

  searchQuery: string = '';
  alphabet: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // search filter toggles
  searchByTitle: boolean = true;
  searchByAuthor: boolean = true;
  searchByTheme: boolean = false;
  searchByLyrics: boolean = false;

  // pagination
  currentPage: number = 1;
  pageSize: number = 15;
  totalSongs: number = 0;

  // modal / setlist state
  isModalOpen = false;
  creatingNew = false;
  actionLoading = false;

  selectedSong: any | null = null;
  setlists: Array<{ id: string; name: string }> = [];
  selectedSetlistId: string | null = null;
  newSetlistName: string = '';

  // feedback
  errorMsg: string | null = null;
  successMsg: string | null = null;

  async ngOnInit() {
    await this.fetchSongs();
    await this.fetchTotalCount();
  }

  // ===== Songs list =====
  async fetchSongs() {
    const from = (this.currentPage - 1) * this.pageSize;
    const to = from + this.pageSize - 1;

    let query = supabase.from('songs').select('*').range(from, to);

    if (this.searchQuery.trim()) {
      const q = `%${this.searchQuery}%`;
      if (this.searchByTitle) {
        query = query.ilike('title', q);
      } else if (this.searchByAuthor) {
        query = query.ilike('authors', q);
      } else if (this.searchByTheme) {
        query = query.ilike('theme', q);
      } else if (this.searchByLyrics) {
        query = query.ilike('lyrics', q);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching songs:', error);
      this.songs = [];
    } else {
      this.songs = this.normalizeSongs(data || []);
    }
  }

  async fetchTotalCount() {
    const { count, error } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching total count:', error);
      this.totalSongs = 0;
    } else {
      this.totalSongs = count || 0;
    }
  }

  async onSearch() {
    this.currentPage = 1;
    await this.fetchSongs();
    await this.fetchTotalCount();
  }

  async filterByLetter(letter: string) {
    this.currentPage = 1;

    const from = (this.currentPage - 1) * this.pageSize;
    const to = from + this.pageSize - 1;

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .ilike('title', `${letter}%`)
      .range(from, to);

    if (error) {
      console.error('Error filtering by letter:', error);
      this.songs = [];
    } else {
      this.songs = this.normalizeSongs(data || []);
    }
  }

  get totalPages() {
    return Math.ceil(this.totalSongs / this.pageSize);
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      await this.fetchSongs();
    }
  }

  async prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      await this.fetchSongs();
    }
  }

  trackById(_index: number, item: any) {
    return item?.id ?? _index;
  }

  // ===== Helpers =====
  normalizeSongs(songs: any[]): any[] {
    return songs.map(song => {
      // normalize authors
      if (song.authors) {
        try {
          const parsed = Array.isArray(song.authors)
            ? song.authors
            : JSON.parse(song.authors);
          song.authors_display = parsed.join(', ');
        } catch {
          song.authors_display = song.authors;
        }
      } else {
        song.authors_display = null;
      }

      song.artist_display = song.artist || null;
      song.album_display = song.album || null;

      // ✅ Format duration if it looks like seconds
      if (song.duration && !isNaN(song.duration)) {
        song.duration_display = this.formatDuration(Number(song.duration));
      } else {
        song.duration_display = song.duration || null;
      }

      song.genre_display = song.genre || null;
      song.year_display = song.year || null;

      // ✅ handle cover_image
      if (song.cover_image) {
        try {
          let raw = String(song.cover_image).trim();
          raw = raw.replace(/[\[\]"]/g, ''); // strip [] and quotes

          // Case 1: Already proper data URI
          if (raw.startsWith('data:image') && !raw.match(/\d+,\d+/)) {
            song.cover_image_display = raw;

          // Case 2: Decimal string or fake "data:image"
          } else if (/^\d+(,\d+)+$/.test(raw) || raw.includes(',')) {
            if (raw.startsWith('data:image')) {
              raw = raw.replace(/^data:image\/jpeg;base64,/, '');
            }
            const numbers = raw.split(',').map(n => parseInt(n.trim(), 10));
            const uint8 = new Uint8Array(numbers);

            let binary = '';
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);

            song.cover_image_display = `data:image/jpeg;base64,${base64}`;

          // Case 3: Assume raw base64
          } else {
            song.cover_image_display = `data:image/jpeg;base64,${raw}`;
          }
        } catch (err) {
          console.error('❌ Failed to parse cover_image:', err);
          song.cover_image_display = null;
        }
      } else {
        song.cover_image_display = null;
      }

      return song;
    });
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private stripQuotes(val: any): string | null {
    if (!val) return null;
    return String(val).replace(/^"+|"+$/g, '');
  }

  // ===== Add-to-setlist flow =====
  async openAddToSetlist(song: any) {
    this.selectedSong = song;
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
    this.selectedSong = null;
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
    if (!this.selectedSong || !this.selectedSetlistId) return;

    this.errorMsg = null;
    this.successMsg = null;
    this.actionLoading = true;

    try {
      const { data: existing, error: checkErr } = await supabase
        .from('setlist_songs')
        .select('id')
        .eq('setlist_id', this.selectedSetlistId)
        .eq('song_id', this.selectedSong.id)
        .limit(1);

      if (checkErr) throw checkErr;
      if (existing && existing.length) {
        this.successMsg = 'This song is already in that setlist.';
        this.actionLoading = false;
        return;
      }

      const { data: posRow, error: posErr } = await supabase
        .from('setlist_songs')
        .select('position')
        .eq('setlist_id', this.selectedSetlistId)
        .order('position', { ascending: false })
        .limit(1);

      if (posErr) throw posErr;

      const nextPos =
        (posRow && posRow[0]?.position ? posRow[0].position : 0) + 1;

      const { error: insertErr } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: this.selectedSetlistId,
          song_id: this.selectedSong.id,
          position: nextPos,
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
    if (!this.selectedSong || !this.newSetlistName?.trim()) return;

    this.errorMsg = null;
    this.successMsg = null;
    this.actionLoading = true;

    try {
      const { data: created, error: createErr } = await supabase
        .from('setlists')
        .insert({ name: this.newSetlistName.trim() })
        .select('id')
        .single();

      if (createErr) throw createErr;

      const newId = created.id as string;

      const { error: insertErr } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: newId,
          song_id: this.selectedSong.id,
          position: 1,
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
