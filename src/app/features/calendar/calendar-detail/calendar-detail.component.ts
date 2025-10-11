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
  /** Helper: get next Sunday in YYYY-MM-DD format */
  private getNextSunday(): string {
    const d = new Date();
    const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSunday);
    return d.toISOString().slice(0, 10);
  }

  event: any = {
    id: null,
    name: 'Sunday Service',
    event_date: '',
    start_time: '12:00',
    end_time: '15:00',
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
    this.event.event_date = this.getNextSunday();
    const routeId = this.route.snapshot.paramMap.get('id');

    // ===== Load dropdowns =====
    const { data: setlists } = await supabase.from('setlists').select('id, name');
    this.setlists = setlists || [];

    // ✅ Load correct list of users (admins + members only)
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, role')
      .in('role', ['admin', 'member'])
      .order('name', { ascending: true });

    if (userError) {
      console.error('❌ Error loading users:', userError);
      this.members = [];
    } else {
      this.members = users || [];
    }

    // ===== Determine new/existing event =====
    if (!routeId || routeId === 'new') {
      this.isNew = true;
      this.loading = false;
      return;
    }

    try {
      if (this.isUuid(routeId)) {
        await this.loadByDbId(routeId);
        this.isNew = false;
      } else {
        const found = await this.loadByGoogleIdFromDb(routeId);
        if (found) this.isNew = false;
        else {
          await this.prefillFromGoogle(routeId);
          this.isNew = true;
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

    const membersList = this.members
      .filter(m => this.assignedMemberIds.includes(m.id))
      .map(m => m.name)
      .join(', ');

    const setlistId = this.event.setlist_id || null;
    const setlist = await this.getSetlistSummary(setlistId);

    const songsText = setlist.songs.length
      ? setlist.songs
          .map(
            s =>
              `• ${s.title}${
                this.authorsToString(s.authors)
                  ? ' — ' + this.authorsToString(s.authors)
                  : ''
              }`
          )
          .join('\n')
      : '';

    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    const setlistUrl = setlistId ? `${origin}/setlists/${setlistId}` : null;
    const eventUrl = this.event.id ? `${origin}/calendar/${this.event.id}` : null;

    try {
      const googleAction = this.event.google_event_id ? 'update' : 'create';
      const gRes: any = await this.http
        .post('/.netlify/functions/calendar-sync', {
          action: googleAction,
          calendarEvent: {
            ...this.event,
            members: membersList,
            setlist_name: setlist.name,
            songs: setlist.songs.map(s => ({
              id: s.id,
              title: s.title,
              authors: this.authorsToString(s.authors)
            })),
            links: {
              setlist: setlistUrl,
              event: eventUrl,
              website: origin || null
            }
          }
        })
        .toPromise();

      const googleId = gRes?.id || this.event.google_event_id || null;

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
        const upd = await supabase
          .from('events')
          .update(dbPayload)
          .eq('id', dbId)
          .select('*'); // ✅ changed

        if (upd.error) throw upd.error;
        if (!upd.data?.length) {
          console.warn('⚠️ Update succeeded but no rows returned (possible RLS)');
        } else {
          this.event = { ...this.event, ...upd.data[0] };
        }
}

      if (dbId) {
        await supabase.from('event_members').delete().eq('event_id', dbId);
        const rows = this.assignedMemberIds.map(mid => ({ event_id: dbId, member_id: mid }));
        if (rows.length) await supabase.from('event_members').insert(rows);
      }

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
        await this.http
          .post('/.netlify/functions/calendar-sync', {
            action: 'delete',
            id: this.event.google_event_id
          })
          .toPromise();
      }

      console.log('✅ Event deleted');
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
