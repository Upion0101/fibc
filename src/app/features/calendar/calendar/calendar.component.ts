import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  events: any[] = [];
  loading = true;

  constructor(private router: Router) {}

  async ngOnInit() {
    await this.loadEvents();
  }

  async loadEvents() {
    this.loading = true;
    const { data, error } = await supabase
      .from('events')
      .select('id, event_date, type, setlist_id, notes, name, start_time, end_time')
      .order('event_date', { ascending: true });

    if (error) {
      console.error('❌ Error loading events:', error);
      this.events = [];
    } else {
      this.events = data || [];
    }

    this.loading = false;
  }

  openEvent(eventId: string) {
    this.router.navigate(['/calendar', eventId]);
  }

  createEvent() {
    this.router.navigate(['/calendar/new']);
  }

  async deleteEvent(eventId: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) {
      console.error('❌ Error deleting event:', error);
    } else {
      this.events = this.events.filter(e => e.id !== eventId);
      console.log(`✅ Event ${eventId} deleted`);
    }
  }
}
