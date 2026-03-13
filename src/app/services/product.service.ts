import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timeout, catchError, map, firstValueFrom, retry } from 'rxjs';
import { getDatabase, ref, get, remove, set } from 'firebase/database';
import { Form } from '../app.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'https://script.google.com/macros/s/AKfycbwEhwadIs5Tb7jZtmnTG8Astvu6Yg3k4o3hPHFg0w_yOS36_zY3WJ4-HS3UOhImNZBOnQ/exec';

  constructor(private http: HttpClient) {}

  private getSafePath(identifier: string): string {
    return String(identifier).trim().replace(/\./g, ',');
  }

  finalizeProduct(sku: string, email: string, youtubeLink: string, tags: string, customerId: string): Observable<any> {
    const payload = { 
      action: 'finalize', 
      sku: sku, 
      email: email,
      youtubeLink: youtubeLink,
      tags: tags,
      customerId: customerId
    };
    return this.postToScript(payload, 180000); 
  }

  async getProductsByEmail(email: string, customerId: string): Promise<any[]> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(customerId || email);
  
    try {
      const dashboardRef = ref(db, `users/${lookupPath}/dashboard`);
      const snapshot = await get(dashboardRef);
  
      if (!snapshot.exists()) {
        // Fallback 1: try customerId-keyed skus node
        const userSkusRef = ref(db, `users/${lookupPath}/skus`);
        const skusSnapshot = await get(userSkusRef);

        // Fallback 2: try legacy email-keyed node if customerId lookup found nothing
        if (!skusSnapshot.exists() && customerId) {
          const emailPath = this.getSafePath(email);
          const emailSkusRef = ref(db, `users/${emailPath}/skus`);
          const emailSnapshot = await get(emailSkusRef);
          if (emailSnapshot.exists()) {
            const rawData = emailSnapshot.val();
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
          return [];
        }

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

  async getProductBySku(email: string, sku: string, customerId: string): Promise<any | null> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(customerId || email);
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

    // Fallback to legacy email-keyed node
    if (customerId) {
      const emailPath = this.getSafePath(email);
      const emailRef = ref(db, `users/${emailPath}/skus/${sku}`);
      const emailSnapshot = await get(emailRef);
      if (emailSnapshot.exists()) {
        const data = emailSnapshot.val();
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
    }

    return null;
  }

  async deleteFromFirebase(email: string, sku: string, customerId: string): Promise<void> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(customerId || email);
    
    const skuRef = ref(db, `users/${lookupPath}/skus/${sku}`);
    const dashboardRef = ref(db, `users/${lookupPath}/dashboard/${sku}`);
    
    await Promise.all([remove(skuRef), remove(dashboardRef)]);
  }

  submitForm(formData: any): Observable<any> {
    const payload = { 
      ...formData, 
      action: formData.action || 'createOrUpdateProduct' 
    };
    return this.postToScript(payload, 180000); // 3 minutes - shows error to user if 3 minutes used up
  }

  pollForSaveCompletion(
    email: string,
    sku: string,
    previousLastUpdated: string,
    customerId: string,
    maxWaitMs: number = 180000 // 3 minutes
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const lookupPath = this.getSafePath(customerId || email);
      const productRef = ref(db, `users/${lookupPath}/skus/${sku}`);
      const startTime = Date.now();
  
      const poll = async () => {
        try {
          const snapshot = await get(productRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            const lastUpdatedChanged = data.lastUpdated && data.lastUpdated !== previousLastUpdated;
            const hasCover = data.coverImageUrl && data.coverImageUrl.length > 0;
            const cdnReady = !hasCover || data.coverImageUrl.includes('cdn.shopify.com');
  
            if (lastUpdatedChanged && cdnReady) {
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
  
        setTimeout(poll, 3000);
      };
  
      setTimeout(poll, 3000);
    });
  }

  pollDashboardForCompletion(
    email: string,
    customerId: string,
    previousProducts: any[],
    isNewProduct: boolean,
    maxWaitMs: number = 180000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
  
      const poll = async () => {
        try {
          const current = await this.getProductsByEmail(email, customerId);
          
          if (isNewProduct) {
            // For new products — check if count increased
            if (current.length > previousProducts.length) {
              resolve(current);
              return;
            }
          } else {
            // For edits — check if any lastUpdated changed
            const changed = current.some(curr => {
              const prev = previousProducts.find(p => p.sku === curr.sku);
              return prev && curr.lastUpdated !== prev.lastUpdated;
            });
            if (changed) {
              resolve(current);
              return;
            }
          }
        } catch (e) {
          console.warn('Dashboard poll error:', e);
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

  deleteProduct(targetSku: string, email: string): Observable<any> {
    const payload = { action: 'delete', sku: targetSku, email: email };
    return this.postToScript(payload, 30000);
  }

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
    const maxAudioSize = 20 * 1024 * 1024; 

    return new Promise((resolve, reject) => {
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

  async saveDigitalSignature(email: string, customerId: string, sku: string, signature: string): Promise<void> {
    const db = getDatabase();
    const lookupPath = this.getSafePath(customerId || email);
    const signatureRef = ref(db, `users/${lookupPath}/skus/${sku}/digitalSignature`);
    
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')
      + ' '
      + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
    await set(signatureRef, {
      signature: signature,
      signedAt: formatted
    });
  }
}