import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-purchase-product-page',
  standalone: false,
  templateUrl: './purchase-product-page.component.html',
  styleUrls: ['./purchase-product-page.component.css']
})
export class PurchaseProductPageComponent {
  @Input() sku: string = ''; // The T-SKU or H-SKU from the form/local storage
  @Input() email: string = ''; // The locked-in composer email
  @Output() backToPreview = new EventEmitter<void>();

  isFinalizing = false;
  graduationComplete = false;

  constructor(private productService: ProductService) {}

  /**
   * Final step logic. 
   * This officially graduates the product from 'unlisted' to 'active'.
   */
  onFinalPublish() {
    const currentEmail = this.email; 
    const currentSku = this.sku;

    // 1. Validation check for SKU
    if (!currentSku || currentSku === 'temporary') {
      alert("Error: No valid SKU found to publish. Please return to the form and save your draft first.");
      return;
    }

    // 2. THE IDENTITY LOCK check
    if (!currentEmail || currentEmail === '' || currentEmail === 'null') {
      alert("Error: Identity lock failed. We cannot confirm who is publishing this product. Please refresh the page.");
      console.error("Finalize blocked: email is missing. State:", { sku: currentSku, email: currentEmail });
      return;
    }
  
    this.isFinalizing = true;
    
    // 3. Trigger the service to flip the status in Shopify and Sheets
    this.productService.finalizePublication(currentSku, currentEmail).subscribe({
      next: (response: string) => {
        console.log('Finalization Response:', response);
        
        try {
          const parsed = JSON.parse(response);
  
          if (parsed.success) {
            this.handleSuccess();
          } else {
            alert('Backend Error: ' + (parsed.error || 'Unknown error.'));
          }
        } catch (e) {
          // Fallback: If GAS returns text/plain but no error, we assume success
          console.warn('Non-JSON response received, assuming graduation success.', e);
          this.handleSuccess();
        }
  
        this.isFinalizing = false;
      },
      error: (err) => {
        console.error('Finalize network error:', err);
        alert('Connection error. If your payment went through, your product will be activated manually by our team shortly.');
        this.isFinalizing = false;
      }
    });
  }

  /**
   * Cleans up local state and celebrates the live product
   */
  private handleSuccess() {
    this.graduationComplete = true;
    localStorage.removeItem('pending_sku'); 
    localStorage.removeItem('pending_title');
    alert('Congratulations! Your product is officially graduated and live on hymns.com.');
  }

  onBackToPreview() {
    this.backToPreview.emit();
  }
}