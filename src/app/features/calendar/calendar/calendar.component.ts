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
    const { data, error } = await supabase
      .from('events')
      .select('id, event_date, type, setlist_id, notes')
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
    this.router.navigate(['/events', eventId]);
  }
}
