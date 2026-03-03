import { Component, OnInit, ChangeDetectorRef, ViewChild, AfterViewChecked, NgZone } from '@angular/core';
import { ProductService } from './services/product.service'; 
import { firstValueFrom } from 'rxjs';
import { FormComponent } from './form/form.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewChecked {
  title = 'hymns-app';
  
  viewMode: 'dashboard' | 'form' | 'purchase' = 'dashboard'; 
  customerEmail: string = '';
  activeSku: string = 'temporary';
  url: string = '';
  isLoading: boolean = false;
  keepFormAlive: boolean = false;
  @ViewChild('productForm') productForm!: FormComponent; 

  // --- NEW: Height Tracking Variables ---
  private lastHeight = 0;
  private isResizing = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private productService: ProductService,
    private ngZone: NgZone // Added NgZone for performance-optimized height messaging
  ) {}

  // --- NEW: Lifecycle hook to detect and send height changes ---
  ngAfterViewChecked() {
    this.sendHeightToShopify();
  }

  private sendHeightToShopify() {
    // Add a simple debouncer to prevent rapid-fire updates that cause "jumping"
    if (this.isResizing) return;

    this.ngZone.runOutsideAngular(() => {
      // Use offsetHeight for a more stable measurement of the actual content box
      const currentHeight = document.documentElement.offsetHeight;

      // Only send message if height changed by more than 15px to avoid sub-pixel loops
      if (Math.abs(currentHeight - this.lastHeight) > 15) {
        this.isResizing = true;
        this.lastHeight = currentHeight;

        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'RESIZE_IFRAME',
            height: currentHeight
          }, '*');
        }

        // Release the lock after 200ms to allow the next legitimate change
        setTimeout(() => { this.isResizing = false; }, 200);
      }
    });
  }

  async ngOnInit() {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CHANGE_VIEW') {
        console.log("📥 View Change Received from Parent:", event.data.mode);
        this.viewMode = event.data.mode; 
        this.isLoading = false; 
        this.keepFormAlive = false; 
        this.activeSku = 'temporary'; 
        document.body.classList.remove('spinner-active');
        this.updateUrlParams(); 
        this.cdr.detectChanges();
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const rawEmail = urlParams.get('email');
    if (rawEmail) this.customerEmail = decodeURIComponent(rawEmail);

    const status = urlParams.get('status');
    const autoPublish = urlParams.get('autoPublish');
    const returnSku = urlParams.get('sku');

    if (status === 'success' && autoPublish === 'true' && returnSku && this.customerEmail) {
      this.activeSku = returnSku; 
      localStorage.setItem('pending_sku', returnSku);
      await this.triggerFinalization(returnSku, this.customerEmail);
    } else {
      const capturedSku = urlParams.get('sku');
      this.activeSku = (capturedSku && capturedSku !== 'temporary') ? capturedSku : 'temporary';
      this.generateProductUrl(urlParams.get('url'), urlParams.get('title'));
      this.viewMode = 'dashboard';
    }
  }

  async triggerFinalization(sku: string, email: string) {
    console.log("🏁 Finalizing purchase for SKU:", sku);
    this.viewMode = 'dashboard'; 
    this.isLoading = true;
    document.body.classList.add('spinner-active');
    this.cdr.detectChanges();
    const finalYoutube = this.productForm ? this.productForm.youtubeLink : '';
    const finalTags = this.productForm ? this.productForm.tags : '';

    try {
      const result: any = await firstValueFrom(
        this.productService.finalizeProduct(sku, email, finalYoutube, finalTags)
      );
      
      if (result && result.success) {
        this.activeSku = result.newSku || this.activeSku; 
        localStorage.removeItem('pending_sku');
        alert(`Success! Your product is now live.\nNew SKU: ${this.activeSku}`);
      } else {
        alert('Graduation failed: ' + (result?.error || 'The server encountered an error.'));
      }
    } catch (err) {
      console.error("Finalization Error:", err);
      alert('Communication error while activating your product.');
    } finally {
      this.isLoading = false;
      document.body.classList.remove('spinner-active');
      this.viewMode = 'dashboard';
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