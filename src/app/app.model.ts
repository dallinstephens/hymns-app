export interface Form {
    // --- IDENTITY LOCK & STATUS ---
    sku: string;
    email: string;           // Now required for the Identity Lock
    status?: 'active' | 'unlisted'; // Tracks if it's a Draft (T) or Live (H)
    previewUrl?: string;     // Stores the Shopify CDN/Preview link
    
    // --- CORE DATA ---
    title: string;
    setting: string;
    settingOther?: string;
    artistName: string;
    originalComposer: string;
    sourceTitle: string;
    churchOwned: string;
    primaryUse: string;
    
    // --- CALCULATIONS ---
    paper1Calculation: string;
    paper1SheetCount: string;
    paper2Calculation: string;
    paper2SheetCount: string;
    inkBlackWhite: string;
    inkColor: string;
    weight: string;
    includeSaddleStitch: string;
    
    // --- CONTENT ---
    descriptionParagraph1: string;
    descriptionParagraph2: string;
    titlesIncluded: string;
    composers: string;
    arrangers: string;
    lyricists: string;
    difficulty: string[];
    performanceTime: string;
    scriptureReferences: string;
    tags: string[];
    publishDate: string;
    
    // --- MEDIA (Stay or Swap Logic) ---
    // These can be a File string (Base64) OR a URL (if keeping existing)
    coverImage?: string;
    audioFile?: string;
    youtubeLink?: string;
    soundcloudLink?: string;
    digitalCopy?: string;
    offerCoilBinding: string;
    offerDigitalCopy: string;
  
    // Thumbnails
    thumbnail1?: string; thumbnail2?: string; thumbnail3?: string;
    thumbnail4?: string; thumbnail5?: string; thumbnail6?: string;
    thumbnail7?: string; thumbnail8?: string; thumbnail9?: string;
    thumbnail10?: string;
  }