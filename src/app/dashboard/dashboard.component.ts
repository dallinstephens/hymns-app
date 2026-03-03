import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ProductService } from '../services/product.service';
import { firstValueFrom, Subscription, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() customerEmail: string = '';
  @Input() isLoading: boolean = false; 

  @Output() viewChange = new EventEmitter<{
    mode: 'dashboard' | 'form' | 'purchase', 
    sku?: string, 
    success?: boolean, 
    error?: boolean 
  }>();

  products: any[] = [];
  isLoadingData = true;
  isPublishing = false; // NEW: Controls the "Creating Product Page" overlay
  isDeleting = false;   // NEW: Ensures overlay doesn't show during deletion
  uploadProgress: number = 0;
  
  private pollingSub?: Subscription;
  private isPolling = false;

  constructor(
    private productService: ProductService,
    private cdr: ChangeDetectorRef 
  ) {}

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['isLoading']) {
      const wasLoading = changes['isLoading'].previousValue;
      const isNowLoading = changes['isLoading'].currentValue;
      
      if (isNowLoading === false && wasLoading === true) {
        this.uploadProgress = 0; 
        if (this.customerEmail) await this.loadUserProducts();
      }
    }
  }
  
  async ngOnInit() {
    if (this.customerEmail) {
      await this.loadUserProducts();
      this.checkAndStartPolling();
    } else {
      this.isLoadingData = false;
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private checkAndStartPolling() {
    const pendingSku = localStorage.getItem('pending_sku');
    if (pendingSku && pendingSku.startsWith('T') && !this.isLoading) {
      this.startGraduationPolling(pendingSku);
    }
  }

  private startGraduationPolling(oldSku: string) {
    if (this.isPolling) return;
    this.isPolling = true;
    let attempts = 0;

    this.pollingSub = interval(4000)
      .pipe(takeWhile(() => this.isPolling && attempts < 25))
      .subscribe(async () => {
        attempts++;
        const data = await this.productService.getProductsByEmail(this.customerEmail);
        
        const activeHSku = data.find((p: any) => p.sku?.startsWith('H') && p.status === 'active');
        const tSkuGone = !data.some((p: any) => p.sku === oldSku);

        if (activeHSku || (tSkuGone && data.some((p: any) => p.sku?.startsWith('H')))) {
          localStorage.removeItem('pending_sku');
          this.products = [...data].reverse();
          this.stopPolling();
          this.cdr.detectChanges();
        }
      });
  }

  private stopPolling() {
    this.isPolling = false;
    if (this.pollingSub) this.pollingSub.unsubscribe();
  }

  async loadUserProducts() {
    if (!this.customerEmail) return;
    this.isLoadingData = true;
    this.cdr.detectChanges();

    try {
      const data = await this.productService.getProductsByEmail(this.customerEmail);
      this.products = Array.isArray(data) ? [...data].reverse() : []; 
    } catch (error) {
      console.error("Dashboard: Error loading products", error);
      this.products = [];
    } finally {
      this.isLoadingData = false;
      this.cdr.detectChanges();
    }
  }

  onCreateNew() {
    this.viewChange.emit({ mode: 'form', sku: 'temporary' });
  }

  onEdit(sku: string) {
    this.viewChange.emit({ mode: 'form', sku: sku });
  }

  onPublish(product: any) {
    if (product.sku?.startsWith('H')) return;

    // Use isPublishing to trigger your 🚀 overlay in the HTML
    this.isPublishing = true; 
    this.uploadProgress = 15;
    this.cdr.detectChanges();

    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.floor(Math.random() * 5) + 2;
        this.cdr.detectChanges();
      }
    }, 600);

    const currentSku = product.sku || 'NOSKU';
    const currentEmail = this.customerEmail || '';
    const currentTitle = product.title || 'Product';
    const productUrl = `https://hymns.com/products/${currentSku}`;

    window.parent.postMessage({
      type: 'PRIME_BUTTON',
      sku: currentSku,
      title: currentTitle,
      url: productUrl
    }, '*');

    localStorage.setItem('pending_sku', currentSku);

    const variantId = '52656836149548'; 
    const shopDomain = '7iyyfy-u5.myshopify.com';
    
    const returnUrl = encodeURIComponent(
      `https://hymns.com/pages/self-publish?status=success&sku=${currentSku}&title=${encodeURIComponent(currentTitle)}&email=${encodeURIComponent(currentEmail)}&autoPublish=true`
    );
    
    const checkoutUrl = `https://${shopDomain}/cart/${variantId}:1?return_to=${returnUrl}&checkout[email]=${encodeURIComponent(currentEmail)}`;

    setTimeout(() => {
      clearInterval(progressInterval);
      window.location.href = checkoutUrl;
    }, 1200);
  }

  async onDelete(product: any) {
    const confirmDelete = confirm(`Permanently delete "${product.title || product.sku}"?`);
    if (!confirmDelete) return;

    this.isDeleting = true; // Prevents the publish overlay from flashing
    this.isLoadingData = true;
    this.cdr.detectChanges();
    
    try {
      const result = await firstValueFrom(this.productService.deleteProduct(product.sku, this.customerEmail));

      if (result && result.success) {
        await this.productService.deleteFromFirebase(this.customerEmail, product.sku);
        this.products = this.products.filter(p => p.sku !== product.sku);
      } else {
        alert('Delete failed: ' + (result?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      this.isDeleting = false;
      this.isLoadingData = false;
      this.cdr.detectChanges();
    }
  }

  async onManualRefresh() {
    this.stopPolling();
    await this.loadUserProducts();
  }

  /**
   * Optimizes the cover image for the dashboard view.
   * Standardizes dimensions to 75x100 (Portrait).
   */
  getSmallerCoverUrl(url: any): string {
    // Free dynamic placeholder with matching 75x100 dimensions
    const webPlaceholder = 'https://placehold.jp/14/222222/ffffff/75x100.png?text=Cover%0AImage';

    if (!url || typeof url !== 'string' || url === '') {
      return webPlaceholder;
    }
    
    if (url.includes('cdn.shopify.com')) {
      // We request _75x100 to match the portrait aspect ratio of sheet music
      return url.replace(/\.(jpg|jpeg|png|gif|webp)(?=\?|$)/i, '_75x100.$1');
    }

    // Return original (for Google Drive/Direct links)
    return url;
  }  

  getPreviewUrl(product: any): string {
    if (product.previewUrl) return product.previewUrl;
    
    // If no previewUrl, generate one from the title
    const title = product.title || 'Product';
    const handle = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')     // Remove special characters
      .replace(/[\s_-]+/g, '-')      // Replace spaces/underscores with hyphens
      .replace(/^-+|-+$/g, '');      // Trim hyphens from ends

    return `https://hymns.com/products/${handle}`;
  }  
}