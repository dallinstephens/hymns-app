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
  @Input() customerEmail: string = '';
  @Input() sku: string = '';

  @Output() back = new EventEmitter<void>();

  ngOnInit() {
    /**
     * Because we are using 'position: fixed' in the CSS, the component 
     * automatically jumps to the user's eye level instantly.
     * * We keep these scroll commands as a "silent background reset" so that
     * when the user eventually clicks 'Back', the main form is already 
     * waiting for them at the top.
     */
    window.scrollTo(0, 0);
    
    try {
      if (window.parent) {
        window.parent.scrollTo(0, 0);
      }
    } catch (e) {
      // Cross-origin safety check
      console.log('Shopify parent scroll handled by CSS pinning.');
    }
  }

  onBackClick() {
    this.back.emit();
  }

  onPublishClick() {
    const variantId = '52656836149548'; 
    const shopDomain = '7iyyfy-u5.myshopify.com';
    
    // Use 'this.sku' or whatever variable name you defined for the SKU in this component
    const currentSku = this.sku || 'NOSKU'; 
    
    // Build the return URL with the SKU parameter included
    const returnUrl = encodeURIComponent(`https://hymns.com/pages/self-publish?status=success&sku=${currentSku}`);
  
    const emailParam = this.customerEmail 
      ? `&checkout[email]=${encodeURIComponent(this.customerEmail)}` 
      : '';
  
    const checkoutUrl = `https://${shopDomain}/cart/${variantId}:1?return_to=${returnUrl}${emailParam}`;
  
    // Navigates the iframe to Shopify
    window.location.href = checkoutUrl;
  }
}