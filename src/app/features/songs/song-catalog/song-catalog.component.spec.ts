import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SongCatalogComponent } from './song-catalog.component';

describe('SongCatalogComponent', () => {
  let component: SongCatalogComponent;
  let fixture: ComponentFixture<SongCatalogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SongCatalogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SongCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
