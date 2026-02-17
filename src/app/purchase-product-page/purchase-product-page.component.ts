import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProductBriefService } from '../services/product-brief.service';

@Component({
  selector: 'app-purchase-product-page',
  standalone: false, // Match your other components
  templateUrl: './purchase-product-page.component.html',
  styleUrls: ['./purchase-product-page.component.css']
})
export class PurchaseProductPageComponent {
  @Input() sku: string = ''; // Receives '01964' from the parent
  @Output() backToPreview = new EventEmitter<void>();

  isFinalizing = false;

  constructor(private productBriefService: ProductBriefService) {}

  // THIS IS THE MISSING FUNCTION
  onFinalPublish() {
    if (!this.sku) {
      alert("Error: No SKU found to publish.");
      return;
    }

    this.isFinalizing = true;
    
    this.productBriefService.finalizePublication(this.sku).subscribe({
      next: (response: any) => {
        alert('Congratulations! Your song is now live on Shopify.');
        this.isFinalizing = false;
        // Optionally redirect to the home page or the new product
      },
      error: (err) => {
        console.error('Finalize error:', err);
        alert('Payment was successful, but there was an error updating Shopify. Please contact support.');
        this.isFinalizing = false;
      }
    });
  }
}