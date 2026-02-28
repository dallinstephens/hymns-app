import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timeout, catchError, map, firstValueFrom } from 'rxjs';
import { Form } from '../app.model';
import { getDatabase, ref, get, remove } from 'firebase/database';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'https://script.google.com/macros/s/AKfycbwcylvDCmuZZsvXAPkjUKxGBohifpEo98EU2LbDKEPF-kqtDHDGh5a9-ZjqcB2taaqD5Q/exec';

  constructor(private http: HttpClient) {}

  private getSafePath(email: string): string {
    return email.toLowerCase().trim().replace(/\./g, ',');
  }

  /**
   * Finalizes a product (Graduates T-SKU to H-SKU)
   * This is called by AppComponent after a successful Shopify checkout.
   */
  finalizeProduct(sku: string, email: string): Observable<any> {
    const payload = { 
      action: 'finalize', 
      sku: sku, 
      email: email 
    };
    // Re-using postToScript to handle the timeout, JSON parsing, and headers automatically
    return this.postToScript(payload, 45000); 
  }

  /**
   * Gets the list of products for the dashboard
   */
   async getProductsByEmail(email: string): Promise<any[]> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(email);
    
    try {
      const userSkusRef = ref(db, `users/${lookupPath}/skus`);
      const snapshot = await get(userSkusRef);
      
      if (!snapshot.exists()) return [];

      const rawData = snapshot.val();
      return Object.keys(rawData).map(skuKey => {
        const details = rawData[skuKey];
        let finalUrl = details.previewUrl || '';

        // Safety: Peeling logic for legacy stringified JSON in previewUrl
        if (typeof finalUrl === 'string' && finalUrl.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(finalUrl);
            finalUrl = parsed.previewUrl || finalUrl;
          } catch (e) {
            console.warn(`Could not parse previewUrl for SKU ${skuKey}:`, e);
          }
        }

        return {
          ...details,
          sku: skuKey, 
          previewUrl: finalUrl,
          title: details.title || details.productTitle || `Product ${skuKey}`,
          // Ensure thumbnails are always an array for the UI
          thumbnailUrls: Array.isArray(details.thumbnailUrls) ? details.thumbnailUrls : []
        };
      });
    } catch (error) {
      console.error("❌ Firebase Retrieval Error:", error);
      return [];
    }
  }

  /**
   * Fetches single product details for pre-filling the edit form.
   */
   async getProductBySku(email: string, sku: string): Promise<any | null> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(email);
    const productRef = ref(db, `users/${lookupPath}/skus/${sku}`);
    const snapshot = await get(productRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      return { 
        ...data, 
        sku: sku,
        title: data.title || data.productTitle || '',
        audioFileUrl: data.audioFileUrl || '',
        coverImageUrl: data.coverImageUrl || '',
        digitalCopyUrl: data.digitalCopyUrl || '',
        thumbnailUrls: Array.isArray(data.thumbnailUrls) ? data.thumbnailUrls : []
      };
    }
    return null;
  }

  async deleteFromFirebase(email: string, sku: string): Promise<void> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(email);
    const productRef = ref(db, `users/${lookupPath}/skus/${sku}`);
    return remove(productRef);
  }

  /**
   * ADJUSTED: Ensures action is 'createOrUpdateProduct' to match the backend orchestration.
   * Increased timeout to handle Shopify's image ingestion latency.
   */
  submitForm(formData: any): Observable<any> {
    const payload = { 
      ...formData, 
      action: formData.action || 'createOrUpdateProduct' 
    };
    // 60s timeout to allow for Shopify image processing and the 8s sleep in GAS
    return this.postToScript(payload, 60000); 
  }

  // Maintaining this for backward compatibility if needed elsewhere
  finalizePublication(targetSku: string, email: string): Observable<any> {
    return this.finalizeProduct(targetSku, email);
  }

  deleteProduct(targetSku: string, email: string): Observable<any> {
    const payload = { action: 'delete', sku: targetSku, email: email };
    return this.postToScript(payload, 30000);
  }

  /**
   * Centralized POST handler
   */
  private postToScript(payload: any, timeoutMs: number = 25000): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'text/plain' });
    return this.http.post(this.apiUrl, JSON.stringify(payload), { headers, responseType: 'text' }).pipe(
      timeout(timeoutMs),
      map(response => {
        try { return typeof response === 'string' ? JSON.parse(response) : response; }
        catch (e) { return { success: true, message: response }; }
      }),
      catchError(error => {
        console.error('Service Post Error:', error);
        return throwError(() => new Error('Server communication failed.'));
      })
    );
  }

  fileToBase64(file: File, maxWidth: number = 1200): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.onerror = error => reject(error);
    });
  }
}