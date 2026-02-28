import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http'; // Keep the Module

// 1. Firebase Imports
import { initializeApp } from 'firebase/app';

// Component Imports
import { AppComponent } from './app.component';
import { FormComponent } from './form/form.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PreviewPageComponent } from './preview-page/preview-page.component';
import { PurchaseProductPageComponent } from './purchase-product-page/purchase-product-page.component';

// Service Import
import { ProductService } from './services/product.service';

// 2. Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyIdFdi3diFgTo6tefJBB8U_AcKJyiIwM",
  authDomain: "hymns-app-135767.firebaseapp.com",
  databaseURL: "https://hymns-app-135767-default-rtdb.firebaseio.com",
  projectId: "hymns-app-135767",
  storageBucket: "hymns-app-135767.firebasestorage.app",
  messagingSenderId: "465556189392",
  appId: "1:465556189392:web:88d09b31b9d93e6122aed5",
};

// 3. Initialize Firebase immediately
initializeApp(firebaseConfig);

@NgModule({
  declarations: [
    AppComponent,
    FormComponent,
    DashboardComponent,
    PreviewPageComponent,
    PurchaseProductPageComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    HttpClientModule // This handles the HttpClient provision automatically
  ],
  providers: [
    // Leave this array empty. 
    // ProductService is already provided via 'providedIn: root'
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }