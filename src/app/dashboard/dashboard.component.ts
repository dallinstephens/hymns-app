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
  @Input() customerId: string = '';
  @Input() isLoading: boolean = false;
  @Input() isCheckingOut: boolean = false;
  @Input() pendingProduct: any = null;
  @Input() isSavingInBackground: boolean = false;
  @Input() previousProducts: any[] = [];

  @Output() viewChange = new EventEmitter<{
    mode: 'dashboard' | 'form' | 'purchase', 
    sku?: string, 
    success?: boolean, 
    error?: boolean,
    background?: boolean
  }>();

  products: any[] = [];
  isLoadingData = true;
  isPublishing = false;
  isDeleting = false;
  uploadProgress: number = 0;
  
  private pollingSub?: Subscription;
  private isPolling = false;
  private isSavePolling = false;
  private savePollingTimeout?: any;
  private countdownInterval: any;

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
  
    if (changes['isSavingInBackground']) {
      const wasSaving = changes['isSavingInBackground'].previousValue;
      const isNowSaving = changes['isSavingInBackground'].currentValue;
      if (isNowSaving === true && this.customerEmail) {
        setTimeout(() => this.startSavePolling(), 15000); // wait 15s before polling
      } else if (isNowSaving === false && wasSaving === true) {
        this.stopSavePolling();
        if (this.customerEmail) await this.loadUserProducts();
      }
    }
  }

  private startSavePolling() {
    if (this.isSavePolling) return;
    this.isSavePolling = true;
  
    // Use previousProducts as baseline if available, otherwise fall back to current products
    const baseline = this.previousProducts.length > 0 ? this.previousProducts : this.products;
    const knownSkus = new Set(baseline.map((p: any) => p.sku));
    const knownLastUpdated: { [sku: string]: string } = {};
    baseline.forEach((p: any) => {
      if (p.sku && p.lastUpdated) knownLastUpdated[p.sku] = p.lastUpdated;
    });
  
    let attempts = 0;
    const maxAttempts = 24;
  
    const poll = async () => {
      if (!this.isSavePolling) return;
      attempts++;
  
      try {
        const data = await this.productService.getProductsByEmail(this.customerEmail, this.customerId);
  
        const newRow = data.find((p: any) => !knownSkus.has(p.sku));
        const updatedRow = data.find((p: any) => 
          knownSkus.has(p.sku) &&
          p.lastUpdated &&
          knownLastUpdated[p.sku] &&
          p.lastUpdated !== knownLastUpdated[p.sku]
        );
  
        if (newRow || updatedRow) {
          this.stopSavePolling();
          setTimeout(async () => {
            this.products = [...data].reverse();
            this.isLoadingData = false;
            this.viewChange.emit({ 
              mode: 'dashboard', 
              success: true, 
              background: false 
            });
            this.cdr.detectChanges();
          }, 10000); // 10 second delay after completion detected
          return;
        }
      } catch (e) {
        console.warn('Save polling error:', e);
      }
  
      if (attempts >= maxAttempts) {
        this.stopSavePolling();
        setTimeout(async () => {
          await this.loadUserProducts();
          this.viewChange.emit({ 
            mode: 'dashboard', 
            success: true, 
            background: false 
          });
        }, 10000);
        return;
      }      
  
      this.savePollingTimeout = setTimeout(poll, 5000);
    };
  
    this.savePollingTimeout = setTimeout(poll, 5000);
  }

  private stopSavePolling() {
    this.isSavePolling = false;
    if (this.savePollingTimeout) {
      clearTimeout(this.savePollingTimeout);
      this.savePollingTimeout = undefined;
    }
  }
  
  async ngOnInit() {
    if (this.customerEmail) {
      await this.loadUserProducts();
      this.checkAndStartPolling();
    } else {
      this.isLoadingData = false;
    }
    this.countdownInterval = setInterval(() => {
      if (this.pendingProduct) {
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.stopPolling();
    this.stopSavePolling();
    if (this.countdownInterval) clearInterval(this.countdownInterval);
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
        const data = await this.productService.getProductsByEmail(this.customerEmail, this.customerId);
        
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
      const data = await this.productService.getProductsByEmail(this.customerEmail, this.customerId);
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
  
    // Stop spinner and go to contract instead of checkout
    setTimeout(() => {
      clearInterval(progressInterval);
      this.isPublishing = false;
      this.uploadProgress = 0;
      this.cdr.detectChanges();
      this.viewChange.emit({ mode: 'contract' as any, sku: currentSku, product: product } as any);
    }, 1200);
  }

  async onDelete(product: any) {
    const confirmDelete = confirm(`Permanently delete "${product.title || product.sku}"?`);
    if (!confirmDelete) return;

    window.parent.postMessage({ type: 'SCROLL_TOP' }, '*');

    this.isDeleting = true;
    this.isLoadingData = true;
    this.cdr.detectChanges();
    
    try {
      const result = await firstValueFrom(this.productService.deleteProduct(product.sku, this.customerEmail));

      if (result && result.success) {
        await this.productService.deleteFromFirebase(this.customerEmail, product.sku, this.customerId);
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

  getSmallerCoverUrl(url: any): string {
    const webPlaceholder = 'https://placehold.jp/14/222222/ffffff/75x100.png?text=Cover%0AImage';
  
    if (!url || typeof url !== 'string' || url === '') {
      return webPlaceholder;
    }
    
    if (url.includes('cdn.shopify.com')) {
      if (!url.includes('/files/')) {
        return url.replace(/\.(jpg|jpeg|png|gif|webp)(?=\?|$)/i, '_75x100.$1');
      }
      return url;
    }
  
    return url;
  } 

  getPreviewUrl(product: any): string {
    let url = '';
    
    if (product.previewUrl) {
      url = product.previewUrl.split('?')[0];
    } else {
      const title = product.title || 'Product';
      const handle = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      url = `https://hymns.com/products/${handle}`;
    }
  
    return url + '?t=' + Date.now() + '#reload';
  }

  // Add a getter for the full product list including pending row
  get displayProducts(): any[] {
    if (!this.pendingProduct) return this.products;
    
    const existingIndex = this.products.findIndex(p => p.sku === this.pendingProduct.sku);
    
    if (existingIndex === -1) {
      // New product — add pending row at top
      return [this.pendingProduct, ...this.products];
    } else {
      // Edit — replace existing row with pending version
      const updated = [...this.products];
      updated[existingIndex] = {
        ...this.products[existingIndex],
        ...this.pendingProduct,
        isPending: true
      };
      return updated;
    }
  }

  getCountdown(product: any): string {
    if (!product.isPending || !product.pendingStartTime) return '';
    const elapsed = Math.floor((Date.now() - product.pendingStartTime) / 1000);
    const remaining = Math.max(180 - elapsed, 0);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  openPreview(product: any) {
    window.open(this.getPreviewUrl(product), '_blank');
  }
}