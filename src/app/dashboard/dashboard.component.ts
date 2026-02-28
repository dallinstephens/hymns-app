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
  uploadProgress: number = 0;
  
  // Polling properties to handle the T -> H transition automatically
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
      
      // If parent finishes graduation, reload data
      if (isNowLoading === false && wasLoading === true) {
        this.uploadProgress = 0; 
        if (this.customerEmail) await this.loadUserProducts();
      }
    }
  }
  
  async ngOnInit() {
    if (this.customerEmail) {
      await this.loadUserProducts();
      // Check if we just returned from Shopify and need to watch for the H-SKU
      this.checkAndStartPolling();
    } else {
      this.isLoadingData = false;
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  /**
   * AUTOMATED GRADUATION WATCHER
   * If a user returns from checkout, this polls Firebase until the SKU swaps.
   */
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
      .pipe(takeWhile(() => this.isPolling && attempts < 20))
      .subscribe(async () => {
        attempts++;
        const data = await this.productService.getProductsByEmail(this.customerEmail);
        const hasHSku = data.some((p: any) => p.sku?.startsWith('H'));
        const tSkuGone = !data.some((p: any) => p.sku === oldSku);

        if (hasHSku || tSkuGone) {
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

  // --- UI ACTIONS ---

  onCreateNew() {
    this.viewChange.emit({ mode: 'form', sku: 'temporary' });
  }

  onEdit(sku: string) {
    this.viewChange.emit({ mode: 'form', sku: sku });
  }

  onPublish(product: any) {
    if (product.sku?.startsWith('H')) return;

    this.isLoading = true; 
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
    const currentTitle = product.title || product.productTitle || 'product';

    localStorage.setItem('pending_sku', currentSku);

    const variantId = '52656836149548'; 
    const shopDomain = '7iyyfy-u5.myshopify.com';
    
    // Optimized Return URL with all required query params
    const returnUrl = encodeURIComponent(
      `https://hymns.com/pages/self-publish?status=success&sku=${currentSku}&email=${encodeURIComponent(currentEmail)}&autoPublish=true`
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

    this.isLoadingData = true;
    this.cdr.detectChanges();
    
    try {
      // Use standard firstValueFrom to catch the API response
      const result = await firstValueFrom(this.productService.deleteProduct(product.sku, this.customerEmail));

      // Result from postToScript is already parsed as JSON
      if (result && result.success) {
        await this.productService.deleteFromFirebase(this.customerEmail, product.sku);
        this.products = this.products.filter(p => p.sku !== product.sku);
      } else {
        alert('Delete failed: ' + (result?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      this.isLoadingData = false;
      this.cdr.detectChanges();
    }
  }

  async onManualRefresh() {
    this.stopPolling();
    await this.loadUserProducts();
  }
}