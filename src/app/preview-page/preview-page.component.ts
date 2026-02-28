import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ProductService } from '../services/product.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-preview-page',
  standalone: false,
  templateUrl: './preview-page.component.html',
  styleUrls: ['./preview-page.component.css']
})
export class PreviewPageComponent implements OnInit, OnChanges {
  // Inputs from Parent (AppComponent)
  @Input() isLoading: boolean = false;
  @Input() success: boolean = false;
  @Input() error: string = '';
  
  // Product data
  @Input() email: string = '';         
  @Input() sku: string = ''; 
  @Input() title: string = '';
  @Input() urlFromParent: string = ''; 

  // Local UI states
  isFinalizing = false;
  isDeleting = false;

  @Output() viewChange = new EventEmitter<{mode: 'dashboard' | 'form' | 'purchase', sku?: string}>();

  constructor(private productService: ProductService) {}

  ngOnInit() {
    /**
     * Scroll reset logic: Ensures the view is fresh when the preview loads.
     */
    this.forceScrollToTop();
  }

  /**
   * REACTIVE UI LOGIC
   * 1. Handles the scroll-to-top when the view loads.
   * 2. Handles the auto-redirect when submission finishes.
   */
  ngOnChanges(changes: SimpleChanges) {
    // Force scroll again if isLoading changes to true
    if (changes['isLoading'] && changes['isLoading'].currentValue === true) {
      this.forceScrollToTop();
    }

    // AUTO-REDIRECT: When success flips from false to true (triggered by Parent)
    if (changes['success'] && changes['success'].currentValue === true) {
      setTimeout(() => {
        this.onBackClick();
      }, 2000); // 2-second buffer to see the success checkmark
    }
  }

  /**
   * THE SHOPIFY IFRAME SCROLL FIX
   * Attempts to scroll both the local window and the parent Shopify frame.
   */
  private forceScrollToTop() {
    window.scrollTo(0, 0);
    
    try {
      // Accessing the parent window scroll is necessary for Shopify App iframes
      if (window.parent && window.parent !== window) {
        window.parent.scrollTo(0, 0);
      }
    } catch (e) {
      // Cross-origin safety check for Shopify iframes
      console.log('Shopify parent scroll handled by CSS pinning or restricted by browser.');
    }
  }

  onBackClick() {
    this.viewChange.emit({ mode: 'dashboard' });
  }

  /**
   * DELETE LOGIC
   */
  async onDeleteClick() {
    const confirmDelete = confirm(`Are you sure you want to delete "${this.title}"?`);
    if (!confirmDelete) return;

    this.isDeleting = true;
    try {
      const responseText = await firstValueFrom(this.productService.deleteProduct(this.sku, this.email));
      const result = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;

      if (result.success) {
        await this.productService.deleteFromFirebase(this.email, this.sku);
        this.onBackClick();
      } else {
        alert('Delete failed: ' + (result.error || 'Unknown error'));
        this.isDeleting = false;
      }
    } catch (err) {
      console.error('Delete error:', err);
      this.isDeleting = false;
    }
  }

  /**
   * PUBLISH LOGIC (Shopify Checkout)
   */
  onPublishClick() {
    this.isFinalizing = true;
    const currentSku = this.sku || 'NOSKU'; 
    const currentEmail = this.email || '';
    const currentTitle = this.title || 'product';
  
    const variantId = '52656836149548'; 
    const shopDomain = '7iyyfy-u5.myshopify.com';
    
    const returnUrl = encodeURIComponent(
      `https://hymns.com/pages/self-publish?status=success&sku=${currentSku}&title=${encodeURIComponent(currentTitle)}&email=${encodeURIComponent(currentEmail)}&autoPublish=true`
    );
    
    const checkoutUrl = `https://${shopDomain}/cart/${variantId}:1?return_to=${returnUrl}${currentEmail ? '&checkout[email]=' + encodeURIComponent(currentEmail) : ''}`;
  
    window.location.href = checkoutUrl;
  }
}