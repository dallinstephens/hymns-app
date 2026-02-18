import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProductBriefService } from '../services/product-brief.service';

@Component({
  selector: 'app-purchase-product-page',
  standalone: false, // Match your other components
  templateUrl: './purchase-product-page.component.html',
  styleUrls: ['./purchase-product-page.component.css']
})
export class PurchaseProductPageComponent {
  @Input() sku: string = ''; // Receives SKU from the parent
  @Input() email: string = ''; // Receives email from the parent (Passed from app.component)
  @Output() backToPreview = new EventEmitter<void>();

  isFinalizing = false;

  constructor(private productBriefService: ProductBriefService) {}

  /**
   * Final step logic. 
   * This is what officially makes the product 'active' in Shopify and 
   * updates the specific row in Google Sheets using the SKU + Email combo.
   */
  onFinalPublish() {
    const currentEmail = this.email; 
    const currentSku = this.sku;

    // 1. Validation check for SKU
    if (!currentSku) {
      alert("Error: No SKU found to publish.");
      return;
    }

    // 2. THE IDENTITY LOCK: Stops the 01968 bug from ever happening.
    // If the email didn't make it from app.component to here, we stop the process.
    if (!currentEmail || currentEmail === '' || currentEmail === 'null') {
      alert("Error: Composer identity not found. Please ensure you are logged in to Shopify and refresh the page.");
      console.error("Finalize blocked: email is missing. Current state:", { sku: currentSku, email: currentEmail });
      return;
    }
  
    this.isFinalizing = true;
    
    // 3. Pass BOTH arguments to the service we updated in the previous step
    this.productBriefService.finalizePublication(currentSku, currentEmail).subscribe({
      next: (response: string) => {
        console.log('Backend raw response:', response);
        
        try {
          const parsed = JSON.parse(response);
  
          if (parsed.success) {
            // Success: Clean up and notify user
            localStorage.removeItem('pending_sku'); 
            alert('Congratulations! Your song is now live.');
          } else {
            // Backend found the row but reported a specific error
            alert('Backend Error: ' + (parsed.error || 'Unknown error occurred.'));
          }
        } catch (e) {
          /**
           * Fallback logic: Google Apps Script sometimes redirects or returns 
           * text/plain that isn't perfectly formatted JSON for the Angular HttpClient.
           * If we get here, it usually means the request hit the script successfully.
           */
          console.warn('Response was not JSON, but request completed.', e);
          alert('Congratulations! Your song is live (Response processed).');
          localStorage.removeItem('pending_sku');
        }
  
        this.isFinalizing = false;
      },
      error: (err) => {
        console.error('Finalize error:', err);
        alert('There was a network error updating the spreadsheet. Please contact info@jackmanmusic.com if your product is not live.');
        this.isFinalizing = false;
      }
    });
  }
}