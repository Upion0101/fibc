import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';
import { MarkdownModule } from 'ngx-markdown';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  trigger,
  transition,
  style,
  animate,
  query,
} from '@angular/animations';

@Component({
  selector: 'app-setlist-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './setlist-detail.component.html',
  styleUrls: ['./setlist-detail.component.scss'],
  animations: [
    trigger('listAnim', [
      transition('* <=> *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(-15px)' }),
            animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
          ],
          { optional: true }
        ),
        query(
          ':leave',
          [
            animate('250ms ease-in', style({ opacity: 0, transform: 'translateY(15px)' })),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })),
      ]),
    ]),
  ],
})
export class SetlistDetailComponent implements OnInit, OnDestroy {
  setlist: any = null;
  songs: Array<any> = [];
  loading = true;
  errorMsg: string | null = null;
  successMsg: string | null = null;
  actionLoading: string | null = null;

  editingName = false;
  newName = '';

  editingNotes = false;
  newNotes = '';
  noteChanges$ = new Subject<string>();
  noteSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMsg = 'No setlist ID provided.';
      this.loading = false;
      return;
    }

    // 🧠 Setup autosave debounce
    this.noteSub = this.noteChanges$
      .pipe(debounceTime(1500))
      .subscribe(() => this.saveNotes(true));

    await this.loadSetlist(id);
  }

  ngOnDestroy() {
    this.noteSub?.unsubscribe();
  }

  /** ───────────────────────────────
   * Load Setlist + Songs
   * ─────────────────────────────── */
  async loadSetlist(id: string) {
    this.loading = true;
    this.errorMsg = null;
    this.successMsg = null;

    try {
      const { data: setlist, error } = await supabase
        .from('setlists')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // ✅ Sync notes and force change detection
      this.setlist = setlist || {};
      this.newName = setlist?.name || '';
      this.newNotes = setlist?.notes || '';
      this.setlist.notes = this.newNotes;
      this.cdr.detectChanges(); // ✅ ensures markdown renders right away

      // Load songs
      const { data: setlistSongs, error: slErr } = await supabase
        .from('setlist_songs')
        .select('song_id, position, id')
        .eq('setlist_id', id)
        .order('position', { ascending: true });

      if (slErr) throw slErr;

      if (!setlistSongs?.length) {
        this.songs = [];
        return;
      }

      const songIds = setlistSongs.map((s) => s.song_id);
      const { data: songs, error: songsErr } = await supabase
        .from('songs')
        .select('id, title, artist')
        .in('id', songIds);

      if (songsErr) throw songsErr;

      this.songs = setlistSongs.map((slSong) => {
        const song = songs?.find((s) => s.id === slSong.song_id);
        return {
          ...song,
          position: slSong.position,
          setlistSongId: slSong.id,
        };
      });
    } catch (err: any) {
      console.error('❌ Error loading setlist detail:', err);
      this.errorMsg = err?.message || 'Failed to load setlist.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges(); // ensure updates reflect
    }
  }

  trackBySetlistSongId(_i: number, s: any) {
    return s.setlistSongId;
  }

  goBack() {
    this.router.navigate(['/setlists']);
  }

  goToSongCatalog() {
    this.router.navigate(['/songs']);
  }

  async removeSong(setlistSongId: string) {
    this.actionLoading = setlistSongId;
    this.successMsg = null;

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
  const index = this.songs.findIndex((s) => s.setlistSongId === setlistSongId);
  if (index === -1) return;

  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= this.songs.length) return;

  // 🎬 Capture pre-move positions
  const list = document.querySelectorAll<HTMLElement>('.song-row');
  const firstRects = Array.from(list).map((el) => el.getBoundingClientRect());

  // 🧩 Swap in-memory
  [this.songs[index], this.songs[neighborIndex]] = [
    this.songs[neighborIndex],
    this.songs[index],
  ];

  // ✅ Trigger re-render but wait a frame before measuring again
  this.cdr.detectChanges();
  await new Promise((r) => setTimeout(r));

  // 🎥 Capture post-move positions
  const lastRects = Array.from(list).map((el) => el.getBoundingClientRect());

  // 🪄 Apply FLIP animation (First–Last–Invert–Play)
  list.forEach((el, i) => {
    const dx = firstRects[i].left - lastRects[i].left;
    const dy = firstRects[i].top - lastRects[i].top;
    if (dx || dy) {
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
      requestAnimationFrame(() => {
        el.style.transform = '';
        el.style.transition = 'transform 300ms ease';
      });
    }
  });

  // 🔢 Update local positions
  this.songs.forEach((s, i) => (s.position = i + 1));

  // 💾 Save to Supabase (after animation starts)
  try {
    console.log('🟡 Saving new song order...');
    const updates = this.songs.map((s) => ({
      id: s.setlistSongId,
      position: s.position,
    }));

    const { data, error } = await supabase
      .from('setlist_songs')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
    console.log('🟢 Order saved successfully!');
    this.successMsg = '✅ Song order saved!';
  } catch (err: any) {
    console.error('❌ Supabase reorder error:', err);
    this.errorMsg = err.message || 'Failed to reorder songs.';
  }
}


  async saveName() {
    const name = this.newName.trim();
    if (!name) return;

    try {
      const { error } = await supabase
        .from('setlists')
        .update({ name })
        .eq('id', this.setlist.id);
      if (error) throw error;
      this.setlist.name = name;
      this.editingName = false;
      this.successMsg = 'Setlist name updated!';
    } catch (err: any) {
      this.errorMsg = err?.message || 'Failed to update setlist name.';
    }
  }

  startEditingNotes() {
    this.editingNotes = true;
    this.newNotes = this.setlist.notes || '';
  }

  cancelEditingNotes() {
    this.editingNotes = false;
    this.newNotes = this.setlist.notes || '';
  }

  onNoteInput() {
    this.noteChanges$.next(this.newNotes);
  }

  async saveNotes(auto = false) {
    const text = this.newNotes.trim();
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ notes: text })
        .eq('id', this.setlist.id);
      if (error) throw error;

      this.setlist.notes = text;
      this.newNotes = text;
      this.cdr.detectChanges(); // ✅ ensures live preview updates

      if (!auto) {
        this.editingNotes = false;
        this.successMsg = 'Notes updated!';
      }
    } catch (err: any) {
      console.error('❌ Error saving notes:', err);
      if (!auto) this.errorMsg = err?.message || 'Failed to update notes.';
    }
  }

  async deleteSetlist() {
    if (!confirm('Are you sure you want to delete this setlist?')) return;
    try {
      await supabase.from('setlist_songs').delete().eq('setlist_id', this.setlist.id);
      await supabase.from('setlists').delete().eq('id', this.setlist.id);
      this.router.navigate(['/setlists']);
    } catch (err: any) {
      this.errorMsg = err?.message || 'Failed to delete setlist.';
    }
  }

  exportText() {
    const lines = this.songs.map(
      (s, i) => `${i + 1}. ${s.title} (${s.artist || 'Unknown'})`
    );
    let text = `Setlist: ${this.setlist.name}\n\n${lines.join('\n')}`;
    if (this.setlist.notes) text += `\n\nNotes:\n${this.setlist.notes}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.setlist.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
