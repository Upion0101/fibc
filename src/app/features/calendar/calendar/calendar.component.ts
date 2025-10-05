import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

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
  calendarId =
    'e5cc593264eb87e4b7a8c2533b8a47be8ae8424baa1fddee7700ed05ea3b77a2@group.calendar.google.com';
  ctz = 'America/New_York';
  embedUrl: SafeResourceUrl | null = null;

  loading = true;
  events: UiEvent[] = [];
  showSubscribeModal = false;

  constructor(private sanitizer: DomSanitizer, private router: Router) {}

  ngOnInit() {
    this.setEmbedFromKnownGood();
    this.loadEvents().catch(() => {});
  }

  private setEmbedFromKnownGood() {
    const src = encodeURIComponent(this.calendarId);
    const ctz = encodeURIComponent(this.ctz);
    const raw = `https://calendar.google.com/calendar/embed?src=${src}&ctz=${ctz}`;
    this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(raw);
  }

  encodeSubscribeCid(id: string): string {
    return encodeURIComponent(id);
  }

  /** Public iCal feed (works for both Outlook and Apple) */
  get outlookSubscribeUrl(): string {
    return `https://calendar.google.com/calendar/ical/${this.calendarId}/public/basic.ics`;
  }

  /** Improved Apple detection & behavior */
  private isAppleDevice(): boolean {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /Macintosh|MacIntel|MacPPC|Mac68K|iPhone|iPad|iPod/i.test(ua);
  }

  openAppleSubscribe() {
    const isApple = this.isAppleDevice();

    if (isApple) {
      const webcalUrl = this.outlookSubscribeUrl.replace(/^https?:\/\//, 'webcal://');

      // Attempt to open Apple Calendar directly
      try {
        window.location.href = webcalUrl;

        // In case the protocol handler is blocked, fallback after 2s
        setTimeout(() => {
          if (!document.hidden) {
            alert(
              'If the Calendar app did not open automatically, please copy the link manually and add it via Calendar → File → New Calendar Subscription.'
            );
          }
        }, 2000);
      } catch {
        alert('Could not open Apple Calendar. Please copy the link manually.');
      }
    } else {
      this.showSubscribeModal = true;
    }
  }

  copyIcsLink() {
    navigator.clipboard.writeText(this.outlookSubscribeUrl).then(() => {
      alert('📋 Link copied to clipboard!');
    });
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
          ? new Date(e.start.dateTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          : null,
        end_time: e.end?.dateTime
          ? new Date(e.end.dateTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          : null,
        type: e.eventType || null,
        notes: e.description || null,
        google_event_id: e.id
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
      if (!res.ok) throw new Error(`Google delete failed (${res.status})`);

      const { error } = await supabase.from('events').delete().eq('google_event_id', id);
      if (error) throw error;

      this.events = this.events.filter((e) => e.id !== id);
      console.log(`✅ Event ${id} deleted from Google & Supabase`);
    } catch (err) {
      console.error('❌ Failed to delete event:', err);
      alert('Failed to delete event.');
    }
  }

  createEvent() {
    this.router.navigate(['/calendar/new']);
  }
}
