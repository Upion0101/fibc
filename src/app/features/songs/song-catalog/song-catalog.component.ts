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
  totalSongs: number = 0;  // for total pages

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

    let query = supabase
      .from('songs')
      .select('*')
      .range(from, to);

    // Apply ONE search filter server-side (keeps it simple)
    if (this.searchQuery.trim()) {
      const q = `%${this.searchQuery}%`;
      if (this.searchByTitle) query = query.ilike('title', q);
      else if (this.searchByAuthor) query = query.ilike('artist', q);
      else if (this.searchByTheme) query = query.ilike('theme', q);
      else if (this.searchByLyrics) query = query.ilike('lyrics', q);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching songs:', error);
      this.songs = [];
    } else {
      this.songs = data || [];
    }
  }

  async fetchTotalCount() {
    const { count, error } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true });

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
      this.songs = data || [];
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
      // 1) Check if already in setlist
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

      // 2) Get next position
      const { data: posRow, error: posErr } = await supabase
        .from('setlist_songs')
        .select('position')
        .eq('setlist_id', this.selectedSetlistId)
        .order('position', { ascending: false })
        .limit(1);

      if (posErr) throw posErr;

      const nextPos = (posRow && posRow[0]?.position ? posRow[0].position : 0) + 1;

      // 3) Insert
      const { error: insertErr } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: this.selectedSetlistId,
          song_id: this.selectedSong.id,
          position: nextPos
        });

      if (insertErr) throw insertErr;

      this.successMsg = 'Added to setlist!';
      // Optional: auto-close after a moment
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
      // 1) Create setlist
      const { data: created, error: createErr } = await supabase
        .from('setlists')
        .insert({ name: this.newSetlistName.trim() })
        .select('id')
        .single();

      if (createErr) throw createErr;

      const newId = created.id as string;

      // 2) Add first song at position 1
      const { error: insertErr } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: newId,
          song_id: this.selectedSong.id,
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
