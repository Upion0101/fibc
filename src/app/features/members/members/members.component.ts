import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { supabase } from '../../../../../supabaseClient';

@Component({
  selector: 'app-members-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss']
})
export class MembersComponent implements OnInit {
  members: any[] = [];
  loading = true;

  async ngOnInit() {
    await this.loadMembers();
  }

  async loadMembers() {
    this.loading = true;

    const { data, error } = await supabase
      .from('members')
      .select(`
        id, name, email, role,
        event_members (
          events (
            id, name, event_date, type,
            setlists (
              id, name,
              setlist_songs (
                position,
                songs ( id, title, artist )
              )
            )
          )
        )
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error loading members:', error);
      this.members = [];
    } else {
      // Flatten the nested events into assignments for easier rendering
      this.members = (data || []).map((m: any) => ({
        ...m,
        assignments: m.event_members?.map((em: any) => ({
          ...em.events,
          setlist: em.events?.setlists
        })) || []
      }));
    }

    this.loading = false;
  }

  async addMember() {
    const name = prompt('Enter member name:');
    const email = prompt('Enter email (optional):');
    const role = prompt('Enter role (optional):');

    if (!name) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ No logged-in user found');
      return;
    }

    const payload = {
      user_id: user.id,
      name,
      email,
      role
    };

    const { error } = await supabase.from('members').insert(payload).select('*');

    if (error) {
      console.error('❌ Error adding member:', error);
    } else {
      await this.loadMembers();
    }
  }

async deleteMember(id: string) {
  if (!confirm('Are you sure you want to remove this member?')) return;

  const { data, error, count } = await supabase
    .from('members')
    .delete({ count: 'exact' }) // ✅ tell PostgREST to return affected row count
    .eq('id', id);

  console.log("🟢 Delete response:", { data, error, count });

  if (error) {
    console.error('❌ Error deleting member:', error);
  } else if (count === 0) {
    console.warn('⚠️ No member deleted — likely blocked by RLS or wrong ID');
  } else {
    console.log('✅ Member deleted:', id);
    await this.loadMembers(); // refresh from DB
  }
}

}
