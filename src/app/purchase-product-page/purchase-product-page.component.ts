import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-purchase-product-page',
  standalone: false,
  templateUrl: './purchase-product-page.component.html',
  styleUrls: ['./purchase-product-page.component.css']
})
export class PurchaseProductPageComponent {
  @Output() backToPreview = new EventEmitter<void>();

  onBackClick() {
    this.backToPreview.emit();
  }
}