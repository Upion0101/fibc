import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { supabase } from '../../../../../supabaseClient';

type SongSummary = { id: string; title: string; authors?: any };

@Component({
  selector: 'app-calendar-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-detail.component.html',
  styleUrls: ['./calendar-detail.component.scss']
})
export class CalendarDetailComponent implements OnInit {
  event: any = {
    id: null,                 // DB uuid
    name: '',
    event_date: '',
    start_time: '',
    end_time: '',
    type: 'service',
    notes: '',
    setlist_id: null,
    google_event_id: null
  };

  isNew = true;
  setlists: any[] = [];
  members: any[] = [];
  assignedMemberIds: string[] = [];
  loading = true;
  errorMsg: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    const routeId = this.route.snapshot.paramMap.get('id');

    // Load dropdowns
    const { data: setlists } = await supabase.from('setlists').select('id, name');
    this.setlists = setlists || [];

    const { data: members } = await supabase.from('members').select('id, name, role');
    this.members = members || [];

    // New event route
    if (!routeId || routeId === 'new') {
      this.isNew = true;
      this.loading = false;
      return;
    }

    // Existing: routeId might be a DB uuid OR a Google event id
    try {
      if (this.isUuid(routeId)) {
        await this.loadByDbId(routeId);
        this.isNew = false;
      } else {
        const found = await this.loadByGoogleIdFromDb(routeId);
        if (found) {
          this.isNew = false;
        } else {
          await this.prefillFromGoogle(routeId);
          this.isNew = true; // no DB row yet
        }
      }
    } catch (err: any) {
      console.error(err);
      this.errorMsg = err?.message || 'Failed to load event.';
    } finally {
      this.loading = false;
    }
  }

  private isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  private async loadByDbId(id: string) {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error || !data) throw new Error(error?.message || 'Event not found');

    this.event = { ...this.event, ...data };

    const { data: assigned } = await supabase
      .from('event_members')
      .select('member_id')
      .eq('event_id', id);
    this.assignedMemberIds = (assigned || []).map(a => a.member_id);
  }

  private async loadByGoogleIdFromDb(googleId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('google_event_id', googleId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return false;

    this.event = { ...this.event, ...data };

    const { data: assigned } = await supabase
      .from('event_members')
      .select('member_id')
      .eq('event_id', data.id);
    this.assignedMemberIds = (assigned || []).map(a => a.member_id);

    return true;
  }

  private async prefillFromGoogle(googleId: string) {
    const res: any = await this.http.post('/.netlify/functions/calendar-sync', {
      action: 'get',
      id: googleId
    }).toPromise();

    const start = res?.start;
    const end = res?.end;
    const toYmd = (s: any) =>
      s?.date || (s?.dateTime ? new Date(s.dateTime).toISOString().slice(0, 10) : '');
    const toHHmm = (s: any) =>
      s?.dateTime ? new Date(s.dateTime).toTimeString().slice(0, 5) : '';

    this.event = {
      ...this.event,
      id: null,
      name: res?.summary || '',
      event_date: toYmd(start) || '',
      start_time: toHHmm(start) || '',
      end_time: toHHmm(end) || '',
      type: 'service',
      notes: res?.description || '',
      setlist_id: null,
      google_event_id: res?.id || googleId
    };

    this.assignedMemberIds = [];
  }

  isMemberAssigned(memberId: string): boolean {
    return this.assignedMemberIds.includes(memberId);
  }

  toggleMember(memberId: string) {
    if (this.isMemberAssigned(memberId)) {
      this.assignedMemberIds = this.assignedMemberIds.filter(id => id !== memberId);
    } else {
      this.assignedMemberIds.push(memberId);
    }
  }

  /** Load setlist name and songs (title/authors) robustly with 2 queries */
  private async getSetlistSummary(setlistId: string | null): Promise<{ name: string | null; songs: SongSummary[] }> {
    if (!setlistId) return { name: null, songs: [] };

    const { data: set, error: setErr } = await supabase
      .from('setlists')
      .select('id, name')
      .eq('id', setlistId)
      .single();

    if (setErr) return { name: null, songs: [] };

    const { data: rows, error: relErr } = await supabase
      .from('setlist_songs')
      .select('song_id')
      .eq('setlist_id', setlistId);

    if (relErr || !rows?.length) return { name: set?.name || null, songs: [] };

    const songIds = rows.map(r => r.song_id).filter(Boolean);
    if (!songIds.length) return { name: set?.name || null, songs: [] };

    const { data: songs, error: songsErr } = await supabase
      .from('songs')
      .select('id, title, authors')
      .in('id', songIds);

    if (songsErr) return { name: set?.name || null, songs: [] };

    return { name: set?.name || null, songs: (songs || []) as SongSummary[] };
  }

  private authorsToString(authors: any): string {
    if (!authors) return '';
    if (Array.isArray(authors)) return authors.join(', ');
    if (typeof authors === 'string') {
      try {
        const j = JSON.parse(authors);
        return Array.isArray(j) ? j.join(', ') : (typeof j === 'string' ? j : '');
      } catch {
        return authors;
      }
    }
    return '';
  }

  async saveEvent(form?: NgForm) {
    if (form && (!form.valid || !this.event.name?.trim())) {
      this.errorMsg = 'Please enter a name.';
      return;
    }
    this.errorMsg = null;

    // Compose members list
    const membersList = this.members
      .filter(m => this.assignedMemberIds.includes(m.id))
      .map(m => m.name)
      .join(', ');

    // Fetch setlist details if any
    const setlistId = this.event.setlist_id || null;
    const setlist = await this.getSetlistSummary(setlistId);

    // Build songs text (Title — Authors)
    const songsText = setlist.songs.length
      ? setlist.songs.map(s => `• ${s.title}${this.authorsToString(s.authors) ? ' — ' + this.authorsToString(s.authors) : ''}`).join('\n')
      : '';

    // Build website links
    const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
    const setlistUrl = setlistId ? `${origin}/setlists/${setlistId}` : null;
    const eventUrl = this.event.id ? `${origin}/calendar/${this.event.id}` : null;

    try {
      // 1) Sync with Google (create/update chosen by google_event_id presence)
      const googleAction = this.event.google_event_id ? 'update' : 'create';
      const gRes: any = await this.http.post('/.netlify/functions/calendar-sync', {
        action: googleAction,
        calendarEvent: {
          ...this.event,
          members: membersList,
          // NEW: richer info
          setlist_name: setlist.name,
          songs: setlist.songs.map(s => ({ id: s.id, title: s.title, authors: this.authorsToString(s.authors) })),
          links: {
            setlist: setlistUrl,
            event: eventUrl,
            website: origin || null
          }
        }
      }).toPromise();

      const googleId = gRes?.id || this.event.google_event_id || null;

      // 2) Upsert in Supabase (insert if new, update if existing)
      const dbPayload = {
        name: this.event.name?.trim() || null,
        event_date: this.event.event_date || null,
        start_time: this.event.start_time || null,
        end_time: this.event.end_time || null,
        type: this.event.type || null,
        notes: this.event.notes || null,
        setlist_id: setlistId,
        google_event_id: googleId
      };

      let dbId = this.event.id;

      if (!dbId) {
        const ins = await supabase.from('events').insert([dbPayload]).select('*').single();
        if (ins.error) throw ins.error;
        dbId = ins.data.id;
        this.event = { ...this.event, ...ins.data };
      } else {
        const upd = await supabase.from('events').update(dbPayload).eq('id', dbId).select('*').single();
        if (upd.error) throw upd.error;
        this.event = { ...this.event, ...upd.data };
      }

      // 3) Update event_members
      if (dbId) {
        await supabase.from('event_members').delete().eq('event_id', dbId);
        const rows = this.assignedMemberIds.map(mid => ({ event_id: dbId, member_id: mid }));
        if (rows.length) await supabase.from('event_members').insert(rows);
      }

      // Ensure google_event_id persisted if we just created on Google
      if (googleAction === 'create' && googleId && dbId) {
        await supabase.from('events').update({ google_event_id: googleId }).eq('id', dbId);
        this.event.google_event_id = googleId;
      }

      console.log(`✅ Event ${googleAction}d in Google Calendar & saved in DB`);
      this.router.navigate(['/calendar']);
    } catch (err) {
      console.error('❌ Failed to save event:', err);
      this.errorMsg = 'Failed to save event.';
    }
  }

  async deleteEvent() {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      if (this.event.id) {
        const { error } = await supabase.from('events').delete().eq('id', this.event.id);
        if (error) throw error;
      }

      if (this.event.google_event_id) {
        await this.http.post('/.netlify/functions/calendar-sync', {
          action: 'delete',
          id: this.event.google_event_id
        }).toPromise();
      }

      console.log(`✅ Event deleted`);
      this.router.navigate(['/calendar']);
    } catch (err) {
      console.error('❌ Error deleting event:', err);
      this.errorMsg = 'Failed to delete event.';
    }
  }

  goBack() {
    this.router.navigate(['/calendar']);
  }
}
