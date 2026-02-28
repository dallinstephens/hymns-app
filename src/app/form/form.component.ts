import { Component, Input, OnInit, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ProductService } from '../services/product.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-form',
  standalone: false,
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.css']
})
export class FormComponent implements OnInit, OnChanges {
  @Input() email: string = '';       
  @Input() editSku: string = 'temporary'; 
  
  // ADJUSTED: Added cdnUrl to the type definition to resolve ts(2345)
  @Output() viewChange = new EventEmitter<{
    mode: 'dashboard' | 'form' | 'purchase', 
    sku?: string, 
    success?: boolean, 
    error?: boolean,
    cdnUrl?: string
  }>();

  productForm!: FormGroup;
  isSubmitting = false;
  submitError = '';
  customerEmail: string = ''; 
  isEditMode = false;

  fileStatus: { [key: string]: string } = {};

  // Standard options lists
  settingOptions = ['Clarinet and Piano', 'Organ Book', 'Other (please specify)', 'Piano', 'SA and Piano', 'SAB and Piano', 'SATB', 'SATB and Organ', 'SATB and Piano', 'SATB and Piano or Organ', 'SSA and Piano', 'SSAA Piano or Organ', 'SSAATTB and Piano or Organ', 'SSAATTBB and Organ', 'TB and Piano', 'TTBB and Organ', 'TTBB and Piano', 'TTBB and Piano or Organ', 'Vocal Duet', 'Vocal Solo', 'Vocal Solo Book'];
  primaryUseOptions = ['Church Choir', 'Congregational', 'Vocal Solo/Special Musical Number', 'Youth', 'Primary', 'Funeral Service', 'Concert/Festival', 'Home/Family Use'];
  paper1Options = ['First Chair Pre-printed Cover - 11 X 17', 'Choral - 11 X 17', 'Piano/Vocal - 12 X 18', 'Booklet Cover - 12 X 18', 'Booklet Inside - 12 X 18', 'Letter Nice - 8.5 X 11', 'Printer Paper - 8.5 X 11'];
  paper2Options = ['First Chair Pre-printed Cover - 11 X 17', 'Choral - 11 X 17', 'Piano/Vocal - 12 X 18', 'Booklet Cover - 12 X 18', 'Booklet Inside - 12 X 18', 'Letter Nice - 8.5 X 11', 'Printer Paper - 8.5 X 11'];
  difficultyOptions = ['Beginning', 'Early Intermediate', 'Intermediate', 'Late Intermediate', 'Advanced'];
  tagOptions = ['2-part Chorus', 'Choral_2-Part', 'Choral_A cappella', 'Choral_Cantata', "Choral_Children's Chorus", 'Choral_Congregation', 'Choral_General Conference', 'Choral_Hymnplicity', 'Choral_Oratorio', 'Choral_SA', 'Choral_SATB', 'Choral_TB', 'Christmas Concert', 'Instrumental_Cello', 'Instrumental_Clarinet', 'Instrumental_Db Bass', 'Instrumental_Flute', 'Instrumental_Oboe', 'Instrumental_Other', 'Instrumental_Viola', 'Instrumental_Violin', 'Languages_French', 'Languages_German', 'Languages_Italian', 'Languages_Portuguese', 'Orchestral_Orchestrations', 'Organ_Chains', 'Organ_Choir', 'Organ_Organ/Piano Duet', 'Organ_Postludes', 'Organ_Preludes', 'Organ_Solos', 'Piano_4 Hands', 'Piano_Advanced', 'Piano_Beginner', 'Piano_Intermediate', 'Piano_Piano/Organ duet', 'Piano_Postludes', 'Piano_Preludes', 'Piano_Solos', 'Seasonal Music_Christmas', 'Seasonal Music_Easter', "Seasonal Music_Father's Day", "Seasonal Music_Mother's Day", 'Seasonal Music_Patriotic', 'Seasonal Music_Pioneer Day', 'Seasonal Music_Thanksgiving', 'Special Events_Baptism and Confirmation', 'Special Events_Conference (Ward', 'Special Events_Funeral and Memorial', 'Special Events_Home and Family', 'Special Events_Missions', 'Special Events_Wedding', 'Special Events_Primary Program', 'Topics_Agency', 'Topics_Atonement', 'Topics_Baptism', 'Topics_Book of Mormon', 'Topics_Brotherhood', 'Topics_Charity', 'Topics_Chastity', 'Topics_Children', 'Topics_Christmas', 'Topics_Comfort', 'Topics_Commandments', 'Topics_Commitment', 'Topics_Courage', 'Topics_Duty', 'Topics_Easter', 'Topics_Encouragement', 'Topics_Enduring to the End', 'Topics_Eternal Life', 'Topics_Example', 'Topics_Faith', 'Topics_Family', 'Topics_Fatherhood', 'Topics_Forgiveness', 'Topics_Funeral', 'Topics_Gathering of Israel', 'Topics_God the Father', "Topics_God's Love", 'Topics_Gospel', 'Topics_Grace', 'Topics_Gratitude', 'Topics_Guidance', 'Topics_Holy Ghost', 'Topics_Home', 'Topics_Honesty', 'Topics_Hope', 'Topics_Humility', 'Topics_Jesus Christ - Birth', 'Topics_Jesus Christ - Creator', 'Topics_Jesus Christ - Example', 'Topics_Jesus Christ - Friend', 'Topics_Jesus Christ - Second Coming', 'Topics_Jesus Christ - Shepherd', 'Topics_Jesus Christ Son of God', 'Topics_Joy', 'Topics_Leadership', 'Topics_Love', 'Topics_Mercy', 'Topics_Millenum', 'Topics_Missionary Work', 'Topics_Motherhood', 'Topics_Obedience', 'Topics_Patience', 'Topics_Patriotism', 'Topics_Peace', 'Topics_Pioneers', 'Topics_Plan of Salvation', 'Topics_Praise and Worship', 'Topics_Prayer', 'Topics_Premortal Life', 'Topics_Preparedness', 'Topics_Priesthood', 'Topics_Prophets', 'Topics_Repentance', 'Topics_Restoration', 'Topics_Resurrection', 'Topics_Revelation', 'Topics_Reverence', 'Topics_Sabbath Day', 'Topics_Sacrament', 'Topics_Scriptures', 'Topics_Self Improvement', 'Topics_Service', 'Topics_Sisterhood', 'Topics_Spirituality', 'Topics_Supplication', 'Topics_Teaching', 'Topics_Temple and Family History', 'Topics_Testimony', 'Topics_Thanksgiving', 'Topics_Trials', 'Topics_Truth', 'Topics_Unity', 'Topics_Wisdom and Knowledge', 'Topics_Worthiness', 'Topics_Youth', 'Topics_Zion', 'Vocal_Duet', 'Vocal_Solo', 'Vocal_Solo W/Parts'];

  constructor(
    private fb: FormBuilder, 
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.customerEmail = this.email;
    this.initForm();
    if (this.editSku && this.editSku !== 'temporary') {
      this.isEditMode = true;
      this.loadProductData(this.editSku);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editSku'] && this.productForm) {
      const newSku = changes['editSku'].currentValue;
      if (newSku && newSku !== 'temporary') {
        this.isEditMode = true;
        this.loadProductData(newSku);
      } else {
        this.isEditMode = false;
        this.fileStatus = {}; 
        this.productForm.reset();
        this.initForm();
      }
    }
  }

  initForm() {
    this.productForm = this.fb.group({
      sku: [this.editSku || 'temporary'],
      title: [''],
      setting: ['Piano'],
      settingOther: [''],
      artistName: [''],
      coverImage: [null],
      audioFile: [null],
      digitalCopy: [null],
      coverImageUrl: [''],
      audioFileUrl: [''],
      digitalCopyUrl: [''],
      thumbnailUrls: [[]],
      youtubeLink: [''],
      originalComposer: [''],
      sourceTitle: [''],
      churchOwned: ['No'],
      primaryUse: ['Church Choir'],
      paper1Calculation: [''],
      paper1SheetCount: [''],
      paper2Calculation: [''],
      paper2SheetCount: [''],
      inkBlackWhite: [''],
      inkColor: [''],
      includeSaddleStitch: ['No'],
      descriptionParagraph1: [''],
      descriptionParagraph2: [''],
      titlesIncluded: [''],
      composers: [''],
      arrangers: [''],
      lyricists: [''],
      difficulty: this.fb.array([]),
      performanceTime: [''],
      scriptureReferences: [''],
      weight: [''],
      offerCoilBinding: ['No'],
      offerDigitalCopy: ['No'],
      soundcloudLink: [''],
      thumbnail1: [null], thumbnail2: [null], thumbnail3: [null], thumbnail4: [null], thumbnail5: [null],
      thumbnail6: [null], thumbnail7: [null], thumbnail8: [null], thumbnail9: [null], thumbnail10: [null],
      tags: this.fb.array([]),
      publishDate: [''],
      email: [this.email],
      status: ['unlisted']
    });
  }

  async loadProductData(sku: string) {
    try {
      const data = await this.productService.getProductBySku(this.customerEmail, sku);
      
      if (data) { 
        this.difficultyArray.clear();
        this.tagsArray.clear();
  
        this.productForm.patchValue({
          sku: sku,
          title: data.title || '',
          setting: data.setting || 'Piano',
          settingOther: data.settingOther || '',
          artistName: data.artistName || '',
          youtubeLink: data.youtubeLink || '',
          originalComposer: data.originalComposer || '',
          sourceTitle: data.sourceTitle || '',
          churchOwned: data.churchOwned || 'No',
          primaryUse: data.primaryUse || 'Church Choir',
          paper1Calculation: data.paper1Calculation || '',
          paper1SheetCount: data.paper1SheetCount || '',
          paper2Calculation: data.paper2Calculation || '',
          paper2SheetCount: data.paper2SheetCount || '',
          inkBlackWhite: data.inkBlackWhite || '',
          inkColor: data.inkColor || '',
          includeSaddleStitch: data.includeSaddleStitch || 'No',
          descriptionParagraph1: data.descriptionParagraph1 || '',
          descriptionParagraph2: data.descriptionParagraph2 || '',
          titlesIncluded: data.titlesIncluded || '',
          composers: data.composers || '',
          arrangers: data.arrangers || '',
          lyricists: data.lyricists || '',
          performanceTime: data.performanceTime || '',
          scriptureReferences: data.scriptureReferences || '',
          weight: data.weight || '',
          offerCoilBinding: data.offerCoilBinding || 'No',
          offerDigitalCopy: data.offerDigitalCopy || 'No',
          soundcloudLink: data.soundcloudLink || '',
          publishDate: data.publishDate || '',
          status: data.status || 'unlisted',
          audioFileUrl: data.audioFileUrl || '',
          coverImageUrl: data.coverImageUrl || '',
          digitalCopyUrl: data.digitalCopyUrl || '',
          thumbnailUrls: data.thumbnailUrls || []
        });
  
        this.hydrateFormArray(this.difficultyArray, data.difficulty);
        this.hydrateFormArray(this.tagsArray, data.tags);
        this.updateFileStatusIndicators(data);
        this.cdr.detectChanges();
      }
    } catch (err) { 
      console.error("❌ Error loading product data:", err); 
    }
  }

  private updateFileStatusIndicators(data: any) {
    this.fileStatus = {};
    if (data.audioFileUrl) this.fileStatus['audioFile'] = '✅ Current audio is loaded';
    if (data.coverImageUrl) this.fileStatus['coverImage'] = '✅ Current cover is loaded';
    if (data.digitalCopyUrl) this.fileStatus['digitalCopy'] = '✅ Current PDF is loaded';
    if (data.thumbnailUrls && data.thumbnailUrls.some((url: string) => url && url !== "")) {
      this.fileStatus['thumbnail1'] = '✅ Gallery images exist';
    }
  }

  private hydrateFormArray(formArray: FormArray, values: any) {
    formArray.clear();
    if (!values) return;
    const vals = Array.isArray(values) ? values : (typeof values === 'string' ? values.split(',').map(v => v.trim()) : []);
    vals.forEach(val => { if (val) formArray.push(this.fb.control(val)); });
  }

  get difficultyArray(): FormArray { return this.productForm.get('difficulty') as FormArray; }
  get tagsArray(): FormArray { return this.productForm.get('tags') as FormArray; }

  onDifficultyChange(option: string, event: any) {
    const array = this.difficultyArray;
    if (event.target.checked) { array.push(this.fb.control(option)); } 
    else { const index = array.controls.findIndex(x => x.value === option); if(index > -1) array.removeAt(index); }
  }

  onTagChange(option: string, event: any) {
    const array = this.tagsArray;
    if (event.target.checked) { array.push(this.fb.control(option)); } 
    else { const index = array.controls.findIndex(x => x.value === option); if(index > -1) array.removeAt(index); }
  }

  async onFileSelect(event: any, fieldName: string) {
    const file = event.target.files[0];
    if (file) {
      this.fileStatus[fieldName] = `⌛ Processing ${file.name}...`;
      try {
        const base64 = await this.productService.fileToBase64(file);
        this.productForm.patchValue({ [fieldName]: base64 });
        this.fileStatus[fieldName] = `✅ Selected: ${file.name}`;
      } catch (error) { 
        this.fileStatus[fieldName] = '❌ File conversion failed';
      }
    }
  }

  async onSubmit() {
    if (this.productForm.invalid) return;
  
    this.isSubmitting = true;
    this.submitError = '';
    const currentSku = this.productForm.get('sku')?.value;
    
    this.viewChange.emit({ mode: 'purchase', sku: currentSku });
  
    try {
      const payload = {
        ...this.productForm.getRawValue(),
        difficulty: this.difficultyArray.value,
        tags: this.tagsArray.value,
        email: this.customerEmail,
        action: 'createOrUpdateProduct',
        isInitialCreate: !this.isEditMode, 
        status: 'unlisted' 
      };
  
      const result = await firstValueFrom(this.productService.submitForm(payload));
      
      if (result && result.success) {
        this.viewChange.emit({ 
          mode: 'dashboard', 
          sku: result.sku || currentSku, 
          success: true,
          cdnUrl: result.finalCoverUrl
        });
        
        this.productForm.reset(); 
        this.initForm(); 
      } else {
        throw new Error(result?.error || 'Server reported failure');
      }
    } catch (error: any) {
      console.error("Submission Error:", error);
      this.submitError = error.message || 'An error occurred.';
      this.viewChange.emit({ mode: 'form', sku: currentSku, error: true });
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel() {
    this.isEditMode = false;
    this.fileStatus = {};
    this.productForm.reset();
    this.viewChange.emit({ mode: 'dashboard' });
    window.parent.postMessage({ type: 'SCROLL_TOP' }, '*');
  }
}