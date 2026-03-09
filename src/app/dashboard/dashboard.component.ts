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
  @Input() isSavingInBackground: boolean = false;

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
      const isNowSaving = changes['isSavingInBackground'].currentValue;
      if (isNowSaving === true && this.customerEmail) {
        this.startSavePolling();
      } else if (isNowSaving === false) {
        this.stopSavePolling();
      }
    }
  }

  private startSavePolling() {
    if (this.isSavePolling) return;
    this.isSavePolling = true;

    // Snapshot current SKUs and their lastUpdated values before save
    const knownSkus = new Set(this.products.map((p: any) => p.sku));
    const knownLastUpdated: { [sku: string]: string } = {};
    this.products.forEach((p: any) => {
      if (p.sku && p.lastUpdated) knownLastUpdated[p.sku] = p.lastUpdated;
    });

    let attempts = 0;
    const maxAttempts = 24; // 24 x 5s = 2 minutes max

    const poll = async () => {
      if (!this.isSavePolling) return;
      attempts++;

      try {
        const data = await this.productService.getProductsByEmail(this.customerEmail);

        // CREATE: a SKU appeared that wasn't there before
        const newRow = data.find((p: any) => !knownSkus.has(p.sku));

        // EDIT: an existing SKU has a different lastUpdated than before
        const updatedRow = data.find((p: any) => 
          knownSkus.has(p.sku) &&
          p.lastUpdated &&
          knownLastUpdated[p.sku] &&
          p.lastUpdated !== knownLastUpdated[p.sku]
        );

        if (newRow || updatedRow) {
          this.stopSavePolling();
          this.products = [...data].reverse();
          this.isLoadingData = false;
          this.viewChange.emit({ 
            mode: 'dashboard', 
            success: true, 
            background: false 
          });
          this.cdr.detectChanges();
          return;
        }
      } catch (e) {
        console.warn('Save polling error:', e);
      }

      if (attempts >= maxAttempts) {
        // Timed out — show dashboard anyway with whatever data we have
        this.stopSavePolling();
        await this.loadUserProducts();
        this.viewChange.emit({ 
          mode: 'dashboard', 
          success: true, 
          background: false 
        });
        return;
      }

      // Schedule next poll in 5 seconds
      this.savePollingTimeout = setTimeout(poll, 5000);
    };

    // First poll after 5 seconds
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
  }

  ngOnDestroy() {
    this.stopPolling();
    this.stopSavePolling();
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
    // console.log('loadUserProducts: starting');
    this.isLoadingData = true;
    this.cdr.detectChanges();
  
    try {
      // console.log('loadUserProducts: calling getProductsByEmail');
      const data = await this.productService.getProductsByEmail(this.customerEmail);
      // console.log('loadUserProducts: got data, count:', data.length);
      this.products = Array.isArray(data) ? [...data].reverse() : []; 
    } catch (error) {
      console.error("Dashboard: Error loading products", error);
      this.products = [];
    } finally {
      // console.log('loadUserProducts: finally block, setting isLoadingData = false');
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

    window.parent.postMessage({ type: 'SCROLL_TOP' }, '*');

    this.isDeleting = true;
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

  getSmallerCoverUrl(url: any): string {
    const webPlaceholder = 'https://placehold.jp/14/222222/ffffff/75x100.png?text=Cover%0AImage';
  
    if (!url || typeof url !== 'string' || url === '') {
      return webPlaceholder;
    }
    
    if (url.includes('cdn.shopify.com')) {
      // Size transformation only works for /products/ and /collections/ paths
      // /files/ path does not support Shopify image resizing
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
      url = product.previewUrl.split('?')[0]; // strip old ?t=
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
}