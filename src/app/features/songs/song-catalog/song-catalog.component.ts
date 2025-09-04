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

  async ngOnInit() {
    await this.fetchSongs();
    await this.fetchTotalCount();
  }

  // Fetch songs for current page
  async fetchSongs() {
    const from = (this.currentPage - 1) * this.pageSize;
    const to = from + this.pageSize - 1;

    let query = supabase
      .from('songs')
      .select('*')
      .range(from, to);

    // Apply search filters server-side
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

  // Fetch total song count (for pagination)
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

  // Search
  async onSearch() {
    this.currentPage = 1;
    await this.fetchSongs();
    await this.fetchTotalCount();
  }

  // Alphabet filter
  async filterByLetter(letter: string) {
  this.currentPage = 1;

  const from = (this.currentPage - 1) * this.pageSize;
  const to = from + this.pageSize - 1;

  // only fetch songs that START with the chosen letter
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .ilike('title', `${letter}%`) // 👈 starts with letter
    .range(from, to);

  if (error) {
    console.error('Error filtering by letter:', error);
    this.songs = [];
  } else {
    this.songs = data || [];
  }
}

  // Pagination
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
}
