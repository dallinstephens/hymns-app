import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
// Updated path: removed /components/
import { ProductBriefFormComponent } from './product-brief-form/product-brief-form.component';
import { ProductBriefService } from './services/product-brief.service';

@NgModule({
  declarations: [
    AppComponent 
    // Remember: Standalone components NEVER go here
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    HttpClientModule,
    ProductBriefFormComponent // This stays here because it is Standalone
  ],
  providers: [ProductBriefService],
  bootstrap: [AppComponent]
})
export class AppModule { }