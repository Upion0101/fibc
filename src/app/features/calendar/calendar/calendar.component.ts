import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

type UiEvent = {
  id: string;
  name: string;
  event_date: string | Date;
  start_time?: string | null;
  end_time?: string | null;
  type?: string | null;
  notes?: string | null;
  google_event_id?: string | null;
};

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  /**
   * MUST match the calendar you write to in the Netlify function (GOOGLE_CALENDAR_ID)
   * Example provided by you:
   * e5cc593264eb87e4b7a8c2533b8a47be8ae8424baa1fddee7700ed05ea3b77a2@group.calendar.google.com
   */
  calendarId = 'e5cc593264eb87e4b7a8c2533b8a47be8ae8424baa1fddee7700ed05ea3b77a2@group.calendar.google.com';

  /** Time zone to show in embed (the working iframe you pasted used America/New_York) */
  ctz = 'America/New_York';

  /** Sanitized embed URL (built exactly like Google’s “Integrate calendar” code) */
  embedUrl: SafeResourceUrl | null = null;

  loading = true;
  events: UiEvent[] = [];

  constructor(
    private sanitizer: DomSanitizer,
    private router: Router
  ) {}

  ngOnInit() {
    this.setEmbedFromKnownGood();
    this.loadEvents().catch(() => {});
  }

  /**
   * Build the embed URL exactly like Google’s embed code you pasted.
   * This avoids hitting any non-embeddable /u/0/ pages that set frame-ancestors 'self'.
   */
  private setEmbedFromKnownGood() {
    // src is the calendar ID, URL-encoded; ctz must be URL-encoded too
    const src = encodeURIComponent(this.calendarId);
    const ctz = encodeURIComponent(this.ctz);

    const raw = `https://calendar.google.com/calendar/embed?src=${src}&ctz=${ctz}`;
    this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(raw);
  }

  /**
   * Helper for the “Subscribe” link (Google expects the raw CID in the url param).
   * We still URL-encode it for safety in the template.
   */
  encodeSubscribeCid(id: string): string {
    return encodeURIComponent(id);
  }

  async loadEvents() {
    this.loading = true;
    try {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);

      const res = await fetch('/.netlify/functions/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          timeMin: start.toISOString(),
          timeMax: end.toISOString()
        })
      });
      if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
      const items = await res.json();

      this.events = (items || []).map((e: any) => ({
        id: e.id,
        name: e.summary || '(Untitled)',
        event_date: e.start?.date || e.start?.dateTime || new Date().toISOString(),
        start_time: e.start?.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null,
        end_time: e.end?.dateTime
          ? new Date(e.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null,
        type: e.eventType || null,
        notes: e.description || null,
        google_event_id: e.id,
      }));
    } catch (err) {
      console.error('Calendar list fetch failed', err);
      this.events = [];
    } finally {
      this.loading = false;
    }
  }

  openEvent(id: string) {
    this.router.navigate(['/calendar', id]);
  }

  async deleteEvent(id: string) {
    if (!confirm('Remove this event?')) return;
    try {
      const res = await fetch('/.netlify/functions/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      this.events = this.events.filter(e => e.id !== id);
      // No need to rebuild embed URL unless you want to force a visual refresh; the embed will refresh on its own.
    } catch (err) {
      console.error(err);
      alert('Failed to delete event.');
    }
  }

  createEvent() {
    this.router.navigate(['/calendar/new']);
  }
}
