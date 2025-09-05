import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-calendar-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-detail.component.html',
  styleUrls: ['./calendar-detail.component.scss']
})
export class CalendarDetailComponent implements OnInit {
  event: any = { event_date: '', type: '', notes: '', setlist_id: null };
  isNew = true;

  setlists: Array<{ id: string; name: string }> = [];
  loading = true;

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');

    // 🔹 Load setlists
    const { data: setlistData, error: setlistErr } = await supabase
      .from('setlists')
      .select('id, name')
      .order('created_at', { ascending: false });

    if (setlistErr) {
      console.error('❌ Error loading setlists:', setlistErr);
      this.setlists = [];
    } else {
      this.setlists = setlistData || [];
    }

    // 🔹 Load event if editing
    if (id && id !== 'new') {
      this.isNew = false;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Error loading event:', error);
      } else if (data) {
        this.event = data;
      }
    }

    this.loading = false;
  }

  async saveEvent() {
  const payload = {
    event_date: this.event.event_date
      ? new Date(this.event.event_date).toISOString().slice(0, 10) // store as `date`
      : null,
    type: this.event.type || 'service',
    notes: this.event.notes || '',
    setlist_id: this.event.setlist_id || null,
    name: this.event.name || '' // required column
  };

  console.log('🟢 Saving event payload:', payload);

  let error;
  if (this.isNew) {
    ({ error } = await supabase.from('events').insert([payload]));
  } else {
    ({ error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', this.event.id));
  }

  if (error) {
    console.error('❌ Error saving event:', error);
  } else {
    this.router.navigate(['/calendar']);
  }
}

  goBack() {
    this.router.navigate(['/calendar']);
  }
}
