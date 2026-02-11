import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router'; // <--- 1. Add this import

import { AppComponent } from './app.component';
import { ProductBriefFormComponent } from './product-brief-form/product-brief-form.component';
import { ProductBriefService } from './services/product-brief.service';

@NgModule({
  declarations: [
    AppComponent,
    ProductBriefFormComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot([]) // <--- 2. Add this to initialize the router
  ],
  providers: [
    ProductBriefService,
    HttpClient
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }