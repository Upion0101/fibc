import { Component, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Member {
  name: string;
  role: string;
  email: string;
  phone: string;
  photo: string;
}

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [NgFor, HttpClientModule],
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss']
})
export class MembersComponent implements OnInit {
  members: Member[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<Member[]>('/assets/data/members.json')
      .subscribe(data => this.members = data);
  }
}
