import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-setlist-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './setlist-list.component.html',
  styleUrls: ['./setlist-list.component.scss']
})
export class SetlistListComponent implements OnInit {
  setlists: any[] = [];
  loading = true;

  newSetlistName = '';
  creating = false;
  errorMsg: string | null = null;

  songSearch = '';
  searchTimeout: any;

  async ngOnInit() {
    await this.fetchSetlists();
  }

  async fetchSetlists() {
    this.loading = true;
    const { data, error } = await supabase
      .from('setlists')
      .select(`
        id,
        name,
        created_at,
        songs:setlist_songs(song_id, songs(title))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching setlists:', error);
      this.setlists = [];
    } else {
      this.setlists = data || [];
    }
    this.loading = false;
  }

  async fetchSetlistsBySong(songName: string) {
    if (!songName.trim()) {
      return await this.fetchSetlists();
    }

    this.loading = true;

    const { data, error } = await supabase
      .from('setlists')
      .select(`
        id,
        name,
        created_at,
        songs:setlist_songs(song_id, songs(title))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching by song:', error);
      this.errorMsg = 'Failed to search by song.';
      this.setlists = [];
    } else {
      // Filter by matching song name
      this.setlists = (data || []).filter((s: any) =>
        s.songs?.some(
          (x: any) =>
            x.songs?.title?.toLowerCase().includes(songName.toLowerCase())
        )
      );
    }

    this.loading = false;
  }

  async onSongSearchChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.fetchSetlistsBySong(this.songSearch);
    }, 400);
  }

  clearSearch() {
    this.songSearch = '';
    this.fetchSetlists();
  }

  async createSetlist() {
    if (!this.newSetlistName.trim()) return;
    this.creating = true;
    this.errorMsg = null;

    const { error } = await supabase
      .from('setlists')
      .insert({ name: this.newSetlistName.trim() });

    if (error) {
      console.error(error);
      this.errorMsg = 'Failed to create setlist.';
    } else {
      this.newSetlistName = '';
      await this.fetchSetlists();
    }

    this.creating = false;
  }
}
