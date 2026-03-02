import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timeout, catchError, map, firstValueFrom, retry } from 'rxjs';
import { Form } from '../app.model';
import { getDatabase, ref, get, remove } from 'firebase/database';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'https://script.google.com/macros/s/AKfycbwEhwadIs5Tb7jZtmnTG8Astvu6Yg3k4o3hPHFg0w_yOS36_zY3WJ4-HS3UOhImNZBOnQ/exec';

  constructor(private http: HttpClient) {}

  private getSafePath(email: string): string {
    return email.toLowerCase().trim().replace(/\./g, ',');
  }

  /**
   * Finalizes a product (Graduates T-SKU to H-SKU)
   */
  finalizeProduct(sku: string, email: string, youtubeLink: string, tags: string): Observable<any> {
    const payload = { 
      action: 'finalize', 
      sku: sku, 
      email: email,
      youtubeLink: youtubeLink,
      tags: tags
    };
    // Increased timeout for graduation because Shopify + Spreadsheet + Firebase takes time
    return this.postToScript(payload, 50000); 
  }

  /**
   * Gets the list of products for the dashboard
   */
/**
   * Gets the list of products for the dashboard
   * ADJUSTED: Handles both Flat and Nested Firebase structures
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
        const entry = rawData[skuKey];
        
        // DETECTION LOGIC: 
        // If 'entry' is an object that contains another object with the actual data, 
        // we flatten it. This handles the inconsistency between v6 and older versions.
        let details = entry;
        if (entry && typeof entry === 'object' && !entry.title && !entry.productTitle) {
            const firstSubKey = Object.keys(entry)[0];
            if (entry[firstSubKey] && typeof entry[firstSubKey] === 'object') {
                details = entry[firstSubKey];
            }
        }

        let finalUrl = details.previewUrl || '';

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
          status: details.status || 'unlisted',
          // PRIORITY: Check every possible title key found in your Firebase screenshot
          title: details.title || details.productTitle || details.Product_Title || `Product ${skuKey}`,
          // IMAGE FIX: Use the keys confirmed in your Firebase screenshot
          coverImageUrl: details.coverImageUrl || details.coverImage || details.imageUrl || '',
          thumbnailUrls: Array.isArray(details.thumbnailUrls) ? details.thumbnailUrls : []
        };
      });
    } catch (error) {
      console.error("❌ Firebase Retrieval Error:", error);
      return [];
    }
  }

  /**
   * Fetches single product details
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
        status: data.status || 'unlisted', // Safety fallback
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

  submitForm(formData: any): Observable<any> {
    const payload = { 
      ...formData, 
      action: formData.action || 'createOrUpdateProduct' 
    };
    return this.postToScript(payload, 180000); 
  }

  finalizePublication(targetSku: string, email: string, youtubeLink: string = '', tags: string = ''): Observable<any> {
    return this.finalizeProduct(targetSku, email, youtubeLink, tags);;
  }

  deleteProduct(targetSku: string, email: string): Observable<any> {
    const payload = { action: 'delete', sku: targetSku, email: email };
    return this.postToScript(payload, 30000);
  }

  /**
   * Centralized POST handler
   * ADJUSTED: Improved JSON cleaning to handle Google Script's specific response formatting
   */
  private postToScript(payload: any, timeoutMs: number = 25000): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'text/plain' });
    return this.http.post(this.apiUrl, JSON.stringify(payload), { headers, responseType: 'text' }).pipe(
      timeout(timeoutMs),
      map(response => {
        // CLEANING LOGIC: Google Scripts sometimes wrap responses in extra characters or HTML if they error
        let cleaned = response.trim();
        try { 
          return JSON.parse(cleaned); 
        } catch (e) { 
          // If it's not JSON, it might be a raw success message
          if (cleaned.toLowerCase().includes("success")) return { success: true, message: cleaned };
          throw new Error("Invalid server response format");
        }
      }),
      catchError(error => {
        console.error('Service Post Error:', error);
        return throwError(() => new Error(error.message || 'Server communication failed.'));
      })
    );
  }

  fileToBase64(file: File, maxWidth: number = 1200): Promise<string> {
    if (file.size > 15 * 1024 * 1024) { 
        return Promise.reject(new Error(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please keep files under 15MB.`));
    }

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