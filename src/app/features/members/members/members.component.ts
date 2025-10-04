// src/app/features/members/members.component.ts
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
  currentUserMember: any = null; // Logged-in user's record
  loading = true;
  userId: string | null = null;
  isAdmin = false;

  // ===== Computed getters for counts (used in template) =====
  get adminCount(): number {
    return this.members.filter(m => m.role === 'admin').length;
  }

  get memberCount(): number {
    return this.members.filter(m => m.role === 'member').length;
  }

  async ngOnInit() {
    await this.loadCurrentUser();
    await this.loadMembers();
  }

  // ===== Load Current Authenticated User =====
  async loadCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ Error fetching current user:', error);
      return;
    }

    if (!user) {
      console.warn('⚠️ No logged-in user');
      return;
    }

    this.userId = user.id;

    // Fetch their matching member record
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (memberError) {
      console.error('❌ Error loading current user member record:', memberError);
      return;
    }

    this.currentUserMember = memberData;

    // ✅ Simple admin check for 2-role system
    const role = memberData?.role?.toLowerCase();
    this.isAdmin = role === 'admin';
  }

  // ===== Load All Members =====
  async loadMembers() {
    this.loading = true;

    const { data, error } = await supabase
      .from('members')
      .select(`
        id, name, email, role, user_id,
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

  // ===== Add New Member (Admin Only) =====
  async addMember() {
    if (!this.isAdmin) {
      alert('Only admins can add members.');
      return;
    }

    const name = prompt('Enter member name:');
    if (!name) return;

    const email = prompt('Enter email (optional):');
    const role = 'member'; // always default new members to "member"

    const payload = {
      user_id: null, // Admins can add members not linked to a Supabase user yet
      name,
      email,
      role
    };

    const { error } = await supabase.from('members').insert(payload);

    if (error) {
      console.error('❌ Error adding member:', error);
    } else {
      console.log('✅ Member added:', name);
      await this.loadMembers();
    }
  }

  // ===== Edit Member (Current User or Admin) =====
  async editMember(member: any) {
    const canEdit = this.isAdmin || member.user_id === this.userId;
    if (!canEdit) {
      alert('You don’t have permission to edit this member.');
      return;
    }

    const newName = prompt('Edit name:', member.name);
    if (!newName) return;

    const { error } = await supabase
      .from('members')
      .update({ name: newName })
      .eq('id', member.id);

    if (error) {
      console.error('❌ Error updating member:', error);
    } else {
      console.log('✅ Member updated:', member.id);
      await this.loadMembers();
    }
  }

  // ===== Change Role (Admin Only) =====
  async changeRole(member: any, newRole: 'admin' | 'member') {
    if (!this.isAdmin) {
      alert('Only admins can change roles.');
      return;
    }

    if (member.user_id === this.userId) {
      alert('You cannot change your own role.');
      return;
    }

    if (member.role === newRole) return;

    const { error } = await supabase
      .from('members')
      .update({ role: newRole })
      .eq('id', member.id);

    if (error) {
      console.error('❌ Error changing role:', error);
    } else {
      console.log(`✅ Changed ${member.name}'s role to ${newRole}`);
      await this.loadMembers();
    }
  }

  // ===== Delete Member (Admin Only) =====
  async deleteMember(id: string) {
    if (!this.isAdmin) {
      alert('Only admins can delete members.');
      return;
    }

    const member = this.members.find(m => m.id === id);
    if (member?.user_id === this.userId) {
      alert('You cannot delete yourself.');
      return;
    }

    if (!confirm('Are you sure you want to remove this member?')) return;

    const { error, count } = await supabase
      .from('members')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting member:', error);
    } else if (count === 0) {
      console.warn('⚠️ No member deleted — likely blocked by RLS or wrong ID');
    } else {
      console.log('✅ Member deleted:', id);
      await this.loadMembers();
    }
  }
}
