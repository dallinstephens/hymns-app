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

  async getProductsByEmail(email: string): Promise<any[]> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(email);
  
    try {
      // Read from lightweight dashboard index instead of full skus node
      const dashboardRef = ref(db, `users/${lookupPath}/dashboard`);
      const snapshot = await get(dashboardRef);
  
      if (!snapshot.exists()) {
        // Fallback to skus node if dashboard index not yet populated
        const userSkusRef = ref(db, `users/${lookupPath}/skus`);
        const skusSnapshot = await get(userSkusRef);
        if (!skusSnapshot.exists()) return [];
        const rawData = skusSnapshot.val();
        return Object.keys(rawData).map(skuKey => {
          const entry = rawData[skuKey];
          if (!entry || typeof entry !== 'object') {
            return { sku: skuKey, title: `Product ${skuKey}`, status: 'unlisted', coverImageUrl: '', thumbnailUrls: [], previewUrl: '', lastUpdated: '', publishDate: '', artistName: '', setting: '' };
          }
          return {
            sku: skuKey,
            title: entry.title || entry.productTitle || `Product ${skuKey}`,
            status: entry.status || 'unlisted',
            coverImageUrl: entry.coverImageUrl || '',
            thumbnailUrls: Array.isArray(entry.thumbnailUrls) ? entry.thumbnailUrls : [],
            previewUrl: entry.previewUrl || '',
            lastUpdated: entry.lastUpdated || '',
            publishDate: entry.publishDate || '',
            artistName: entry.artistName || '',
            setting: entry.setting || ''
          };
        });
      }
  
      // Fast path — dashboard index exists
      const rawData = snapshot.val();
      return Object.keys(rawData).map(skuKey => {
        const entry = rawData[skuKey] || {};
        return {
          sku: skuKey,
          title: entry.title || `Product ${skuKey}`,
          status: entry.status || 'unlisted',
          coverImageUrl: entry.coverImageUrl || '',
          thumbnailUrls: [],
          previewUrl: entry.previewUrl || '',
          lastUpdated: entry.lastUpdated || '',
          publishDate: entry.publishDate || '',
          artistName: entry.artistName || '',
          setting: entry.setting || ''
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
        status: data.status || 'unlisted',
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
    
    const skuRef = ref(db, `users/${lookupPath}/skus/${sku}`);
    const dashboardRef = ref(db, `users/${lookupPath}/dashboard/${sku}`);
    
    await Promise.all([remove(skuRef), remove(dashboardRef)]);
  }

  /**
   * Fire-and-forget submit — posts to GAS and returns within 15s.
   * GAS continues running in the background after the connection drops.
   * Use pollForSaveCompletion() to detect when GAS is done.
   */
  submitForm(formData: any): Observable<any> {
    const payload = { 
      ...formData, 
      action: formData.action || 'createOrUpdateProduct' 
    };
    // 15s timeout — GAS keeps running in the background after this drops
    return this.postToScript(payload, 15000);
  }

  pollForSaveCompletion(
    email: string,
    sku: string,
    previousLastUpdated: string,
    maxWaitMs: number = 120000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const lookupPath = this.getSafePath(email);
      const productRef = ref(db, `users/${lookupPath}/skus/${sku}`);
      const startTime = Date.now();
  
      const poll = async () => {
        try {
          const snapshot = await get(productRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.lastUpdated && data.lastUpdated !== previousLastUpdated) {
              resolve(data);
              return;
            }
          }
        } catch (e) {
          console.warn('Poll error:', e);
        }
  
        if (Date.now() - startTime >= maxWaitMs) {
          reject(new Error('Save timed out — please refresh to see your changes.'));
          return;
        }
  
        setTimeout(poll, 5000);
      };
  
      setTimeout(poll, 5000);
    });
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
        let cleaned = response.trim();
        try { 
          return JSON.parse(cleaned); 
        } catch (e) { 
          if (cleaned.toLowerCase().includes("success")) return { success: true, message: cleaned };
          throw new Error("Invalid server response format");
        }
      }),
      catchError(error => {
        // A timeout or status 0 on submitForm is expected — GAS is still running in background.
        // Return synthetic success so the caller proceeds to Firebase polling.
        if (error.name === 'TimeoutError' || error.status === 0) {
          console.log('GAS is running in background — proceeding to Firebase polling.');
          return [{ success: true, background: true }];
        }
        console.error('Service Post Error:', error);
        return throwError(() => new Error(error.message || 'Server communication failed.'));
      })
    );
  }

  fileToBase64(file: File, maxWidth: number = 1200): Promise<string> {
    const isImage = file.type.startsWith('image/');
    // 20MB is the "sweet spot" for 5-minute high-quality MP3s
    const maxAudioSize = 20 * 1024 * 1024; 

    return new Promise((resolve, reject) => {
      // --- HANDLE AUDIO & PDF (Non-Images) ---
      if (!isImage) {
        if (file.size > maxAudioSize) {
          return reject(new Error(
            `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
            `Please keep audio (MP3) and PDF files under 20MB.`
          ));
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        return;
      }

      // --- HANDLE IMAGES (Any size allowed, will be compressed) ---
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; 
          let height = img.height;
          
          if (width > maxWidth) { 
            height = (height * maxWidth) / width; 
            width = maxWidth; 
          }
          
          canvas.width = width; 
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.onerror = error => reject(error);
    });
  }
}