import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ProductBriefService, ProductBriefForm } from '../services/product-brief.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-product-brief-form',
  standalone: false,
  templateUrl: './product-brief-form.component.html',
  styleUrls: ['./product-brief-form.component.css']
})

export class ProductBriefFormComponent implements OnInit {
  productForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  previewUrl = ''; 

  // Controls which component/view is visible
  viewMode: 'form' | 'preview' = 'form';

  settingOptions = [
    'Clarinet and Piano', 'Organ Book', 'Other (please specify)', 'Piano',
    'SA and Piano', 'SAB and Piano', 'SATB', 'SATB and Organ',
    'SATB and Piano', 'SATB and Piano or Organ', 'SSA and Piano',
    'SSAA Piano or Organ', 'SSAATTB and Piano or Organ', 'SSAATTBB and Organ',
    'TB and Piano', 'TTBB and Organ', 'TTBB and Piano',
    'TTBB and Piano or Organ', 'Vocal Duet', 'Vocal Solo', 'Vocal Solo Book'
  ];

  primaryUseOptions = [
    'Church Choir', 'Congregational', 'Vocal Solo/Special Musical Number',
    'Youth', 'Primary', 'Funeral Service', 'Concert/Festival', 'Home/Family Use'
  ];

  paper1Options = [
    'First Chair Pre-printed Cover - 11 X 17', 'Choral - 11 X 17',
    'Piano/Vocal - 12 X 18', 'Booklet Cover - 12 X 18', 'Booklet Inside - 12 X 18',
    'Letter Nice - 8.5 X 11', 'Printer Paper - 8.5 X 11'
  ];

  paper2Options = [
    'First Chair Pre-printed Cover - 11 X 17', 'Choral - 11 X 17',
    'Piano/Vocal - 12 X 18', 'Booklet Cover - 12 X 18', 'Booklet Inside - 12 X 18',
    'Letter Nice - 8.5 X 11', 'Printer Paper - 8.5 X 11'
  ];

  difficultyOptions = ['Beginning', 'Early Intermediate', 'Intermediate', 'Late Intermediate', 'Advanced'];

  tagOptions = [
    '2-part Chorus', 'Choral_2-Part', 'Choral_A cappella', 'Choral_Cantata',
    "Choral_Children's Chorus", 'Choral_Congregation', 'Choral_General Conference',
    'Choral_Hymnplicity', 'Choral_Oratorio', 'Choral_SA', 'Choral_SATB', 'Choral_TB',
    'Christmas Concert', 'Instrumental_Cello', 'Instrumental_Clarinet', 'Instrumental_Db Bass',
    'Instrumental_Flute', 'Instrumental_Oboe', 'Instrumental_Other', 'Instrumental_Viola',
    'Instrumental_Violin', 'Languages_French', 'Languages_German', 'Languages_Italian',
    'Languages_Portuguese', 'Orchestral_Orchestrations', 'Organ_Chains', 'Organ_Choir',
    'Organ_Organ/Piano Duet', 'Organ_Postludes', 'Organ_Preludes', 'Organ_Solos',
    'Piano_4 Hands', 'Piano_Advanced', 'Piano_Beginner', 'Piano_Intermediate',
    'Piano_Piano/Organ duet', 'Piano_Postludes', 'Piano_Preludes', 'Piano_Solos',
    'Seasonal Music_Christmas', 'Seasonal Music_Easter', "Seasonal Music_Father's Day",
    "Seasonal Music_Mother's Day", 'Seasonal Music_Patriotic', 'Seasonal Music_Pioneer Day',
    'Seasonal Music_Thanksgiving', 'Special Events_Baptism and Confirmation',
    'Special Events_Conference (Ward', 'Special Events_Funeral and Memorial',
    'Special Events_Home and Family', 'Special Events_Missions', 'Special Events_Wedding',
    'Special Events_Primary Program', 'Topics_Agency', 'Topics_Atonement', 'Topics_Baptism',
    'Topics_Book of Mormon', 'Topics_Brotherhood', 'Topics_Charity', 'Topics_Chastity',
    'Topics_Children', 'Topics_Christmas', 'Topics_Comfort', 'Topics_Commandments',
    'Topics_Commitment', 'Topics_Courage', 'Topics_Duty', 'Topics_Easter', 'Topics_Encouragement',
    'Topics_Enduring to the End', 'Topics_Eternal Life', 'Topics_Example', 'Topics_Faith',
    'Topics_Family', 'Topics_Fatherhood', 'Topics_Forgiveness', 'Topics_Funeral',
    'Topics_Gathering of Israel', 'Topics_God the Father', "Topics_God's Love", 'Topics_Gospel',
    'Topics_Grace', 'Topics_Gratitude', 'Topics_Guidance', 'Topics_Holy Ghost', 'Topics_Home',
    'Topics_Honesty', 'Topics_Hope', 'Topics_Humility', 'Topics_Jesus Christ - Birth',
    'Topics_Jesus Christ - Creator', 'Topics_Jesus Christ - Example', 'Topics_Jesus Christ - Friend',
    'Topics_Jesus Christ - Second Coming', 'Topics_Jesus Christ - Shepherd',
    'Topics_Jesus Christ Son of God', 'Topics_Joy', 'Topics_Leadership', 'Topics_Love',
    'Topics_Mercy', 'Topics_Millenum', 'Topics_Missionary Work', 'Topics_Motherhood',
    'Topics_Obedience', 'Topics_Patience', 'Topics_Patriotism', 'Topics_Peace', 'Topics_Pioneers',
    'Topics_Plan of Salvation', 'Topics_Praise and Worship', 'Topics_Prayer', 'Topics_Premortal Life',
    'Topics_Preparedness', 'Topics_Priesthood', 'Topics_Prophets', 'Topics_Repentance',
    'Topics_Restoration', 'Topics_Resurrection', 'Topics_Revelation', 'Topics_Reverence',
    'Topics_Sabbath Day', 'Topics_Sacrament', 'Topics_Scriptures', 'Topics_Self Improvement',
    'Topics_Service', 'Topics_Sisterhood', 'Topics_Spirituality', 'Topics_Supplication',
    'Topics_Teaching', 'Topics_Temple and Family History', 'Topics_Testimony', 'Topics_Thanksgiving',
    'Topics_Trials', 'Topics_Truth', 'Topics_Unity', 'Topics_Wisdom and Knowledge',
    'Topics_Worthiness', 'Topics_Youth', 'Topics_Zion', 'Vocal_Duet', 'Vocal_Solo', 'Vocal_Solo W/Parts'
  ];

  constructor(
    private fb: FormBuilder,
    private productBriefService: ProductBriefService
  ) {}

  ngOnInit() {
    this.productForm = this.fb.group({
      sku: ['01968', Validators.required],
      title: ['My Title', Validators.required],
      setting: ['Piano', Validators.required],
      settingOther: [''],
      artistName: ['Dallin', Validators.required],
      coverImage: [null],
      audioFile: [null],
      youtubeLink: ['https://www.youtube.com/watch?v=BRLIM9snZEg'],
      originalComposer: ['Original Composer'],
      sourceTitle: ['Source Title'],
      churchOwned: ['Yes', Validators.required],
      primaryUse: ['Church Choir', Validators.required],
      paper1Calculation: ['First Chair Pre-printed Cover - 11 X 17'],
      paper1SheetCount: ['1'],
      paper2Calculation: ['Choral - 11 X 17'],
      paper2SheetCount: ['2'],
      inkBlackWhite: ['3'],
      inkColor: ['4'],
      includeSaddleStitch: ['Yes'],
      descriptionParagraph1: ['p1'],
      descriptionParagraph2: ['p2'],
      titlesIncluded: ['A Poor Wayfaring Man of Grief; Each Life That Touches Ours for Good; I\'m Trying to Be like Jesus'],
      composers: ['Comp Dallin'],
      arrangers: ['Arr Dallin'],
      lyricists: ['Lyr Dallin'],
      difficulty: this.fb.array([]),
      performanceTime: ['3:50'],
      scriptureReferences: ['John 3:16'],
      weight: ['5'],
      offerCoilBinding: ['Yes'],
      offerDigitalCopy: ['Yes'],
      digitalCopy: [null],
      soundcloudLink: ['https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/912654358&amp;color=%23ff5500&amp;auto_play=false&amp;hide_related=false&amp;show_comments=false&amp;show_user=false&amp;show_reposts=false&amp;show_teaser=false'],
      thumbnail1: [null],
      thumbnail2: [null],
      thumbnail3: [null],
      thumbnail4: [null],
      thumbnail5: [null],
      thumbnail6: [null],
      thumbnail7: [null],
      thumbnail8: [null],
      thumbnail9: [null],
      thumbnail10: [null],
      tags: this.fb.array([]),
      publishDate: [''],
      rowNumber: ['']
    });
  }

  get difficultyArray(): FormArray {
    return this.productForm.get('difficulty') as FormArray;
  }

  get tagsArray(): FormArray {
    return this.productForm.get('tags') as FormArray;
  }

  onDifficultyChange(option: string, event: any) {
    const array = this.difficultyArray;
    if (event.target.checked) {
      array.push(this.fb.control(option));
    } else {
      const index = array.controls.findIndex(x => x.value === option);
      array.removeAt(index);
    }
  }

  onTagChange(option: string, event: any) {
    const array = this.tagsArray;
    if (event.target.checked) {
      array.push(this.fb.control(option));
    } else {
      const index = array.controls.findIndex(x => x.value === option);
      array.removeAt(index);
    }
  }

  async onFileSelect(event: any, fieldName: string) {
    const file = event.target.files[0];
    if (file) {
      try {
        const base64 = await this.productBriefService.fileToBase64(file);
        this.productForm.patchValue({ [fieldName]: base64 });
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
  }

  // --- VIEW NAVIGATION HELPERS ---
  
  // Goes back to the form so you can edit details or start over
  returnToForm() {
    this.viewMode = 'form';
    this.submitSuccess = false;
    this.submitError = '';
    this.isSubmitting = false;

    // Smoothly scroll the user back to the top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async onSubmit() {
    // 1. Immediately switch to the preview/loading view
    this.viewMode = 'preview';
    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = false;
    this.previewUrl = ''; 
  
    try {
      const formData: ProductBriefForm = {
        ...this.productForm.value,
        difficulty: this.difficultyArray.value,
        tags: this.tagsArray.value
      };
  
      // 2. Perform the submission
      const responseText = await firstValueFrom(this.productBriefService.submitForm(formData));
      const result = JSON.parse(responseText);
  
      if (result.success) {
        this.submitSuccess = true;
        this.previewUrl = result.previewUrl || '';
      } else {
        this.submitError = result.error || 'The spreadsheet rejected the data.';
        // Optional: you could stay in 'preview' to show the error, 
        // which matches your request for a success/failure view.
      }
    } catch (error) {
      this.submitError = 'Network error! Please check your connection and try again.';
      console.error('Submit error:', error);
    } finally {
      // 3. Stop the spinner so the Result View (Success/Failure) can show
      this.isSubmitting = false;
    }
  }
}