import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-preview-page',
  standalone: false,
  templateUrl: './preview-page.component.html',
  styleUrls: ['./preview-page.component.css']
})
export class PreviewPageComponent implements OnInit {
  @Input() isLoading: boolean = false;
  @Input() error: string = '';
  @Input() success: boolean = false;
  @Input() url: string = '';
  @Input() customerEmail: string = ''; // Decoded email from the parent
  @Input() sku: string = ''; // Current SKU from the form
  @Input() title: string = '';
  isFinalizing = false;

  @Output() back = new EventEmitter<void>();

  ngOnInit() {
    /**
     * Scroll reset logic: Ensures the view is fresh when the preview loads.
     */
    window.scrollTo(0, 0);
    
    try {
      if (window.parent) {
        window.parent.scrollTo(0, 0);
      }
    } catch (e) {
      // Cross-origin safety check for Shopify iframes
      console.log('Shopify parent scroll handled by CSS pinning.');
    }
  }

  onBackClick() {
    this.back.emit();
  }

  /**
   * Generates the Shopify checkout link.
   * Includes the SKU and Email in the return URL to prevent the 01968 bug 
   * after the user finishes payment and returns to the app.
   */
   onPublishClick() {
    this.isFinalizing = true;
    this.isLoading = false; 
  
    const currentSku = this.sku || 'NOSKU'; 
    const currentEmail = this.customerEmail || '';
    const currentTitle = this.title || 'product';
  
    // --- NEW: Generate the URL and shout it to the Parent ---
    const handle = currentTitle.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    const previewUrl = `/products/${handle}`;
    
    window.parent.postMessage({ 
      type: 'PRIME_BUTTON', 
      url: previewUrl, 
      sku: currentSku 
    }, '*');
    // -------------------------------------------------------
  
    localStorage.setItem('pending_title', currentTitle);
    localStorage.setItem('pending_sku', currentSku);
  
    const variantId = '52656836149548'; 
    const shopDomain = '7iyyfy-u5.myshopify.com';
    const returnUrl = encodeURIComponent(`https://hymns.com/pages/self-publish?status=success&sku=${currentSku}&title=${encodeURIComponent(currentTitle)}&email=${encodeURIComponent(currentEmail)}&autoPublish=true`);
    const emailParam = currentEmail ? `&checkout[email]=${encodeURIComponent(currentEmail)}` : '';
    const checkoutUrl = `https://${shopDomain}/cart/${variantId}:1?return_to=${returnUrl}${emailParam}`;
  
    window.location.href = checkoutUrl;
  }
}