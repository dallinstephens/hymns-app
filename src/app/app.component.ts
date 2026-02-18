import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'hymns-app';
  customerEmail: string = '';
  sku: string = '';
  url: string = '';
  isSuccess: boolean = false; // Added to help trigger the button visibility

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const urlParams = new URLSearchParams(window.location.search);
      
      // 1. Capture basic identity
      const customerId = params['logged_in_customer_id'] || urlParams.get('logged_in_customer_id');
      const rawEmail = params['email'] || urlParams.get('email');
      this.isSuccess = (params['status'] === 'success' || urlParams.get('status') === 'success');

      if (rawEmail) {
        this.customerEmail = decodeURIComponent(rawEmail);
      }
  
      // 2. Capture URL Parts
      this.sku = params['sku'] || urlParams.get('sku') || '';
      const productTitle = params['title'] || urlParams.get('title');
      const passedUrl = params['url'] || urlParams.get('url');

      // 3. Logic for the "View Product" Link
      if (passedUrl) {
        // PRIORITY 1: Perfect URL passed back from the redirect
        this.url = decodeURIComponent(passedUrl);
        console.log("AppComponent: Using Perfect Passed-in URL:", this.url);
      } else if (this.sku) {
        if (productTitle) {
          // PRIORITY 2: Reconstruct handle (Slugify)
          const decodedTitle = decodeURIComponent(productTitle.replace(/\+/g, ' '));
          const handle = decodedTitle
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')    
            .replace(/[\s_-]+/g, '-')     
            .replace(/^-+|-+$/g, '');     
          
          this.url = `https://hymns.com/products/${handle}`;
          console.log("AppComponent: Reconstructed URL from Title:", this.url);
        } else {
          // PRIORITY 3: Fallback
          this.url = `https://hymns.com/products/${this.sku}`;
        }
      }
  
      // Debug logs for you to see in the browser console
      if (this.isSuccess) {
        console.log("SUCCESS detected. URL assigned to button:", this.url);
      }
    });
  }
}