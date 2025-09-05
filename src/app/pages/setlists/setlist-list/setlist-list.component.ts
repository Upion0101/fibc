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

  async ngOnInit() {
    await this.fetchSetlists();
  }

  async fetchSetlists() {
    this.loading = true;
    const { data, error } = await supabase
      .from('setlists')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching setlists:', error);
      this.setlists = [];
    } else {
      this.setlists = data || [];
    }
    this.loading = false;
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
