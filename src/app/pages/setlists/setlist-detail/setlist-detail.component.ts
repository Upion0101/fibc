import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-setlist-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setlist-detail.component.html',
  styleUrls: ['./setlist-detail.component.scss']
})
export class SetlistDetailComponent implements OnInit {
  setlist: any = null;
  songs: Array<any> = [];
  loading = true;
  errorMsg: string | null = null;
  successMsg: string | null = null;
  actionLoading: string | null = null; // for song actions
  editingName = false;
  newName = '';

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMsg = 'No setlist ID provided.';
      this.loading = false;
      return;
    }
    await this.loadSetlist(id);
  }

  async loadSetlist(id: string) {
    this.loading = true;
    this.errorMsg = null;

    try {
      const { data: setlist, error: setlistErr } = await supabase
        .from('setlists')
        .select('*')
        .eq('id', id)
        .single();

      if (setlistErr) throw setlistErr;
      this.setlist = setlist;
      this.newName = setlist.name;

      const { data: setlistSongs, error: slErr } = await supabase
        .from('setlist_songs')
        .select('song_id, position, id')
        .eq('setlist_id', id)
        .order('position', { ascending: true });

      if (slErr) throw slErr;

      if (!setlistSongs?.length) {
        this.songs = [];
        this.loading = false;
        return;
      }

      const songIds = setlistSongs.map(s => s.song_id);

      const { data: songs, error: songsErr } = await supabase
        .from('songs')
        .select('id, title, artist')   // ✅ no duration
        .in('id', songIds);


      if (songsErr) throw songsErr;

      this.songs = setlistSongs.map(slSong => {
        const song = songs?.find(s => s.id === slSong.song_id);
        return {
          ...song,
          position: slSong.position,
          setlistSongId: slSong.id
        };
      });
    } catch (err: any) {
      console.error('❌ Error loading setlist detail:', err);
      this.errorMsg = err?.message || 'Failed to load setlist.';
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    this.router.navigate(['/setlists']);
  }

  goToSongCatalog() {
    this.router.navigate(['/songs']);
  }

  async removeSong(setlistSongId: string) {
    this.actionLoading = setlistSongId;
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', setlistSongId);

      if (error) throw error;

      await this.loadSetlist(this.setlist.id);
      this.successMsg = 'Song removed from setlist!';
    } catch (err: any) {
      console.error('❌ Error removing song:', err);
      this.errorMsg = err?.message || 'Failed to remove song.';
    } finally {
      this.actionLoading = null;
    }
  }

  async moveSong(setlistSongId: string, direction: 'up' | 'down') {
    const index = this.songs.findIndex(s => s.setlistSongId === setlistSongId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.songs.length) return;

    const current = this.songs[index];
    const target = this.songs[targetIndex];

    try {
      // Swap positions
      await supabase.from('setlist_songs')
        .update({ position: target.position })
        .eq('id', current.setlistSongId);

      await supabase.from('setlist_songs')
        .update({ position: current.position })
        .eq('id', target.setlistSongId);

      await this.loadSetlist(this.setlist.id);
    } catch (err) {
      console.error('❌ Error reordering songs:', err);
    }
  }

  async saveName() {
    if (!this.newName.trim()) return;
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ name: this.newName.trim() })
        .eq('id', this.setlist.id);

      if (error) throw error;
      this.setlist.name = this.newName.trim();
      this.editingName = false;
      this.successMsg = 'Setlist name updated!';
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to update setlist name.';
    }
  }

  async deleteSetlist() {
    if (!confirm('Are you sure you want to delete this setlist?')) return;

    try {
      await supabase.from('setlist_songs').delete().eq('setlist_id', this.setlist.id);
      await supabase.from('setlists').delete().eq('id', this.setlist.id);
      this.router.navigate(['/setlists']);
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to delete setlist.';
    }
  }

  exportText() {
    const lines = this.songs.map(s => `${s.position}. ${s.title} (${s.artist || 'Unknown'})`);
    const text = `Setlist: ${this.setlist.name}\n\n${lines.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.setlist.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
