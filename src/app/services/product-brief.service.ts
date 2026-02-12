import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProductBriefForm {
  sku: string;
  title: string;
  setting: string;
  settingOther?: string;
  artistName: string;
  coverImage?: string;
  audioFile?: string;
  youtubeLink?: string;
  originalComposer: string;
  sourceTitle: string;
  churchOwned: string;
  primaryUse: string;
  paper1Calculation: string;
  paper1SheetCount: string;
  paper2Calculation: string;
  paper2SheetCount: string;
  inkBlackWhite: string;
  inkColor: string;
  includeSaddleStitch: string;
  descriptionParagraph1: string;
  descriptionParagraph2: string;
  titlesIncluded: string;
  composers: string;
  arrangers: string;
  lyricists: string;
  difficulty: string[];
  performanceTime: string;
  scriptureReferences: string;
  weight: string;
  offerCoilBinding: string;
  offerDigitalCopy: string;
  digitalCopy?: string;
  soundcloudLink?: string;
  thumbnail1?: string;
  thumbnail2?: string;
  thumbnail3?: string;
  thumbnail4?: string;
  thumbnail5?: string;
  thumbnail6?: string;
  thumbnail7?: string;
  thumbnail8?: string;
  thumbnail9?: string;
  thumbnail10?: string;
  tags: string[];
  publishDate: string;
  rowNumber?: string;
  previewUrl?: string; // Added to interface for consistency
}

@Injectable({
  providedIn: 'root'
})
export class ProductBriefService {
  private apiUrl = 'https://script.google.com/macros/s/AKfycbyyjuJIAm1o0LtQyqzDHR7TjKFJyew036gaW6Cbgwq4AI9HJwR4N5yyZxE-X28jLT4jtw/exec';

  constructor(private http: HttpClient) {}

  submitForm(formData: ProductBriefForm): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'text/plain' 
    });
  
    // We keep responseType: 'text' because Google Apps Script 
    // redirects cause JSON parsing errors in Angular otherwise.
    return this.http.post(this.apiUrl, JSON.stringify(formData), { 
      headers,
      responseType: 'text' 
    });
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