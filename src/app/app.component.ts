import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ProductService } from './services/product.service'; 
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'hymns-app';
  
  viewMode: 'dashboard' | 'form' = 'dashboard'; 
  customerEmail: string = '';
  activeSku: string = 'temporary';
  url: string = '';
  isLoading: boolean = false;
  keepFormAlive: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private productService: ProductService 
  ) {}

  async ngOnInit() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 1. Always capture Identity first
    const rawEmail = urlParams.get('email');
    if (rawEmail) this.customerEmail = decodeURIComponent(rawEmail);

    // 2. Capture Redirect Parameters
    const status = urlParams.get('status');
    const autoPublish = urlParams.get('autoPublish');
    const returnSku = urlParams.get('sku');

    // 3. PRIORITY: Check for return from Shopify
    if (status === 'success' && autoPublish === 'true' && returnSku && this.customerEmail) {
      this.activeSku = returnSku; // Temporarily set to T-SKU while processing
      await this.triggerFinalization(returnSku, this.customerEmail);
    } else {
      // Normal dashboard load logic
      const capturedSku = urlParams.get('sku');
      this.activeSku = (capturedSku && capturedSku !== 'temporary') ? capturedSku : 'temporary';
      this.generateProductUrl(urlParams.get('url'), urlParams.get('title'));
      this.viewMode = 'dashboard';
    }
  }

  /**
   * Triggers the Google Script 'finalize' action to swap T-SKU to H-SKU
   */
  async triggerFinalization(sku: string, email: string) {
    console.log("🏁 Finalizing purchase for SKU:", sku);
    this.isLoading = true;
    document.body.classList.add('spinner-active');
    this.cdr.detectChanges();

    try {
      // Calling the service method we defined earlier
      const result: any = await firstValueFrom(this.productService.finalizeProduct(sku, email));
      
      if (result && result.success) {
        // Success! Update local SKU to the new H-number returned by the script
        this.activeSku = result.newSku || this.activeSku; 
        alert(`Success! Your product is now live.\nNew SKU: ${this.activeSku}`);
      } else {
        alert('Graduation failed: ' + (result?.error || 'The server encountered an error.'));
      }
    } catch (err) {
      console.error("Finalization Error:", err);
      alert('Communication error while activating your product. Please check your internet connection.');
    } finally {
      this.isLoading = false;
      document.body.classList.remove('spinner-active');
      this.viewMode = 'dashboard';
      
      // Clean the URL so a refresh doesn't trigger graduation again
      this.updateUrlParams(); 
      this.cdr.detectChanges();
    }
  }

  handleViewChange(event: {
    mode: 'dashboard' | 'form' | 'purchase', 
    sku?: string, 
    success?: boolean, 
    error?: boolean 
  }) {
    // Nav logic preserved exactly as requested
    if (event.error === true) {
      document.body.classList.remove('spinner-active');
      this.isLoading = false; 
      this.viewMode = 'form'; 
      this.keepFormAlive = false;
    } else if (event.success === true) {
      document.body.classList.remove('spinner-active');
      window.scrollTo(0, 0);
      this.isLoading = false;
      this.viewMode = 'dashboard';
      this.keepFormAlive = false; 
      this.activeSku = 'temporary';
      this.updateUrlParams();
    } else if (event.mode === 'purchase') {
      window.scrollTo(0, 0);
      document.body.classList.add('spinner-active');
      this.isLoading = true;
      this.viewMode = 'dashboard';
      this.keepFormAlive = true; 
    } else if (event.mode === 'form') {
      document.body.classList.remove('spinner-active');
      this.activeSku = event.sku || 'temporary';
      this.viewMode = 'form';
      this.isLoading = false;
      this.keepFormAlive = false;
    } else if (event.mode === 'dashboard') {
      document.body.classList.remove('spinner-active');
      this.viewMode = 'dashboard';
      this.isLoading = false;
      this.keepFormAlive = false;
      this.activeSku = 'temporary'; 
      this.updateUrlParams();
    }
    this.cdr.detectChanges();
  }

  generateProductUrl(passedUrl: string | null, productTitle: string | null) {
    if (passedUrl) {
      let decodedUrl = decodeURIComponent(passedUrl);
      // Ensure we catch any variation of the myshopify domain
      this.url = decodedUrl.replace(/.*\.myshopify\.com/, 'https://hymns.com');
    } else if (this.activeSku !== 'temporary') {
      if (productTitle) {
        const handle = decodeURIComponent(productTitle.replace(/\+/g, ' '))
          .toLowerCase().trim()
          .replace(/[^\w\s-]/g, '')    
          .replace(/[\s_-]+/g, '-')     
          .replace(/^-+|-+$/g, '');     
        this.url = `https://hymns.com/products/${handle}`;
      } else {
        this.url = `https://hymns.com/products/${this.activeSku}`;
      }
    }
  }

  showDashboard() {
    this.handleViewChange({ mode: 'dashboard' });
  }

  private updateUrlParams() {
    const cleanUrl = window.location.pathname + 
      (this.customerEmail ? `?email=${encodeURIComponent(this.customerEmail)}` : '');
    window.history.replaceState({}, '', cleanUrl);
  }
}