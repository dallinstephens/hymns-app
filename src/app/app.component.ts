import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'hymns-app';

  constructor(private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      const customerId = params['logged_in_customer_id'];
      if (customerId) {
        console.log("Found Shopify Customer ID:", customerId);
        // This is the "ID" we will use to look up their music in Firebase!
      } else {
        console.log("No customer logged in.");
      }
    });
  }
}
