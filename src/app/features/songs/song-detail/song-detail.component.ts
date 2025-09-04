import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-song-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-detail.component.html',
  styleUrls: ['./song-detail.component.scss']
})
export class SongDetailComponent implements OnInit {
  song: any = null;
  loading = true;

  constructor(private route: ActivatedRoute) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    console.log('🔎 Looking up song by id =', id);

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
    console.log('✅ Raw song row from DB:', this.song);

    // Parse authors + lyrics if stored as string
    if (typeof this.song.authors === 'string') {
      try { this.song.authors = JSON.parse(this.song.authors); }
      catch { this.song.authors = []; }
    }
    if (typeof this.song.lyrics === 'string') {
      try { this.song.lyrics = JSON.parse(this.song.lyrics); }
      catch { this.song.lyrics = {}; }
    }

    // Get signed URL for audio
    if (this.song.audio_path) {
      console.log('📂 audio_path from DB:', this.song.audio_path);

      try {
        const res = await fetch(
          `/.netlify/functions/b2-sign?path=${encodeURIComponent(this.song.audio_path)}`
        );
        const json = await res.json();

        if (json.url) {
          this.song.audio_url = json.url;
          console.log('🎧 Final Backblaze signed URL:', this.song.audio_url);
        } else {
          console.warn('⚠️ No URL returned from b2-sign:', json);
        }
      } catch (err) {
        console.error('❌ Exception fetching signed URL:', err);
      }
    }

    this.loading = false;
  }
}
