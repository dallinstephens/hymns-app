import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-contract',
  standalone: false,
  templateUrl: './contract.component.html',
  styleUrls: ['./contract.component.css']
})
export class ContractComponent implements OnInit {
  @Input() customerEmail: string = '';
  @Input() customerId: string = '';
  @Input() product: any = null;

  @Output() viewChange = new EventEmitter<{
    mode: 'dashboard' | 'form' | 'purchase' | 'contract',
    sku?: string,
    success?: boolean,
    error?: boolean
  }>();

  digitalSignature: string = '';
  isSubmitting: boolean = false;
  hasScrolledToBottom: boolean = false;
  submitError: string = '';

  constructor(
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {}

  onScroll(event: any) {
    const element = event.target;
    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    if (atBottom) {
      this.hasScrolledToBottom = true;
      this.cdr.detectChanges();
    }
  }

  get canProceed(): boolean {
    return this.digitalSignature.trim().length > 2 && this.hasScrolledToBottom;
  }

  async onAgreeAndProceed() {
    if (!this.canProceed || this.isSubmitting) return;
  
    this.isSubmitting = true;
    this.submitError = '';
  
    try {
      // Save digital signature to Firebase
      await this.productService.saveDigitalSignature(
        this.customerEmail,
        this.customerId,
        this.product.sku,
        this.digitalSignature.trim()
      );
  
      // Emit purchase mode to trigger spinner in app.component
      this.viewChange.emit({ mode: 'purchase', sku: this.product.sku, isCheckout: true } as any);
  
      // Do the checkout redirect — same as onPublish previously did
      const currentSku = this.product.sku || 'NOSKU';
      const currentEmail = this.customerEmail || '';
      const currentTitle = this.product.title || 'Product';
      const variantId = '52656836149548';
      const shopDomain = '7iyyfy-u5.myshopify.com';
  
      const returnUrl = encodeURIComponent(
        `https://hymns.com/pages/self-publish?status=success&sku=${currentSku}&title=${encodeURIComponent(currentTitle)}&email=${encodeURIComponent(currentEmail)}&customerId=${encodeURIComponent(this.customerId)}&autoPublish=true`
      );
  
      const checkoutUrl = `https://${shopDomain}/cart/${variantId}:1?return_to=${returnUrl}&checkout[email]=${encodeURIComponent(currentEmail)}`;
  
      setTimeout(() => {
        window.location.href = checkoutUrl;
      }, 1200);
  
    } catch (err) {
      console.error('Contract error:', err);
      this.submitError = 'Failed to save signature. Please try again.';
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  onCancel() {
    this.viewChange.emit({ mode: 'dashboard' });
  }
}