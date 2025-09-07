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

  it('should have defaults set', () => {
    expect(component.currentPage).toBe(1);
    expect(component.pageSize).toBe(15);
    expect(component.searchByTitle).toBeTrue();
  });

  it('trackById should prefer id if present', () => {
    const withId = { id: 123, title: 'X' } as any;
    const withoutId = { title: 'Y' } as any;
    expect(component.trackById(5, withId)).toBe(123);
    expect(component.trackById(7, withoutId)).toBe(7);
  });
});
