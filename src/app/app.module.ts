import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http'; // Keep the Module

// 1. Firebase Imports
import { initializeApp } from 'firebase/app'; // Added back for immediate initialization
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { environment } from '../environments/environment';

// Component Imports: Firebase Configuration in environments folder
import { AppComponent } from './app.component';
import { FormComponent } from './form/form.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PreviewPageComponent } from './preview-page/preview-page.component';
import { PurchaseProductPageComponent } from './purchase-product-page/purchase-product-page.component';

// 2. Initialize Firebase immediately (Just like your old code did)
// This ensures that services like ProductService find Firebase ready to go.
initializeApp(environment.firebase);

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
    HttpClientModule, // This handles the HttpClient provision automatically
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
  ],
  providers: [
    // Leave this array empty.
    // ProductService is already provided via 'providedIn: root'
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }