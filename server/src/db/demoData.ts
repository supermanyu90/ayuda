// FICTIONAL DEMO DATASET.
// Every organisation below is invented for demonstration. Names carry a
// "(Demo)" suffix, contacts use reserved example.org / 555 numbers, and rows
// are stored with is_demo = true so the UI always labels them as fictional.
// Coordinates are placed around Bandra / Khar / Santacruz, Mumbai purely so
// the distance logic has something realistic to work on.

import type { Category, VerificationStatus } from '../domain/taxonomy.js';

export interface DemoOpportunity {
  title: string;
  activity: string;
  skills: string[];
  beneficiaries: string[];
  assistance_types: string[];
  languages: string[];
  days: string[];
  times_of_day: string[];
  min_minutes: number;
  max_minutes: number;
  min_age?: number;
  eligibility?: string[];
  physical_requirement?: string;
  background_check?: boolean;
}

export interface DemoOrganisation {
  name: string;
  category: Category;
  description: string;
  locality: string;
  lat: number;
  lng: number;
  verification_status: VerificationStatus;
  safeguarding_notes: string;
  opportunities: DemoOpportunity[];
}

/** Demo centre used by Demo Mode (Bandra West, Mumbai). */
export const DEMO_CENTRE = { lat: 19.0596, lng: 72.8295, label: 'Bandra West, Mumbai (demo location)' };

const WEEKEND = ['saturday', 'sunday'];
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const ALL_DAYS = [...WEEKDAYS, ...WEEKEND];

export const DEMO_ORGANISATIONS: DemoOrganisation[] = [
  {
    name: 'Little Lanterns Reading Club (Demo)',
    category: 'education_literacy',
    description: 'Weekend spoken-English and reading sessions for children aged 8–12 from nearby communities.',
    locality: 'Bandra West',
    lat: 19.0632,
    lng: 72.8347,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Volunteers work in pairs; a staff member is always present. Photo ID required on first visit.',
    opportunities: [
      {
        title: 'Sunday spoken-English circle',
        activity: 'Lead a small-group conversation and reading session in English with 5–6 children.',
        skills: ['teaching', 'english'],
        beneficiaries: ['children'],
        assistance_types: ['teaching', 'mentoring'],
        languages: ['english', 'hindi'],
        days: ['sunday'],
        times_of_day: ['morning'],
        min_minutes: 60,
        max_minutes: 120,
        min_age: 18,
        background_check: true,
      },
    ],
  },
  {
    name: 'Khar Homework Hub (Demo)',
    category: 'child_support',
    description: 'After-school homework help for primary school children.',
    locality: 'Khar West',
    lat: 19.0717,
    lng: 72.8362,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Sessions held in an open hall. Never be alone with a child.',
    opportunities: [
      {
        title: 'Weekend homework helper',
        activity: 'Help children with English and maths homework.',
        skills: ['teaching', 'english'],
        beneficiaries: ['children'],
        assistance_types: ['teaching'],
        languages: ['english', 'hindi', 'marathi'],
        days: ['saturday', 'sunday'],
        times_of_day: ['morning', 'afternoon'],
        min_minutes: 90,
        max_minutes: 180,
        min_age: 18,
        background_check: true,
      },
    ],
  },
  {
    name: 'Silver Threads Elder Home (Demo)',
    category: 'elderly_care',
    description: 'Residential home for 40 seniors. Looking for companionship and smartphone help.',
    locality: 'Bandra West',
    lat: 19.0553,
    lng: 72.8341,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Do not share personal phone numbers with residents. Sign in at reception.',
    opportunities: [
      {
        title: 'Smartphone help for seniors',
        activity: 'Teach residents to video-call family, use WhatsApp and spot scam messages.',
        skills: ['digital_literacy', 'technology'],
        beneficiaries: ['elderly'],
        assistance_types: ['technology_help', 'teaching'],
        languages: ['english', 'hindi'],
        days: ALL_DAYS,
        times_of_day: ['evening'],
        min_minutes: 45,
        max_minutes: 90,
      },
      {
        title: 'Companionship visits',
        activity: 'Spend time talking, reading newspapers aloud or playing carrom with residents.',
        skills: ['companionship'],
        beneficiaries: ['elderly'],
        assistance_types: ['companionship'],
        languages: ['hindi', 'marathi', 'english'],
        days: ALL_DAYS,
        times_of_day: ['afternoon', 'evening'],
        min_minutes: 30,
        max_minutes: 120,
      },
    ],
  },
  {
    name: 'Paws & Whiskers Shelter (Demo)',
    category: 'animal_shelter',
    description: 'Rescue shelter for street dogs and cats.',
    locality: 'Santacruz West',
    lat: 19.0821,
    lng: 72.8371,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Closed shoes required. Do not handle animals marked red without staff.',
    opportunities: [
      {
        title: 'Dog walking & kennel cleaning',
        activity: 'Walk shelter dogs and help clean kennels.',
        skills: ['physical_work'],
        beneficiaries: ['animals'],
        assistance_types: ['animal_care', 'cleaning'],
        languages: [],
        days: ALL_DAYS,
        times_of_day: ['morning'],
        min_minutes: 60,
        max_minutes: 180,
        min_age: 16,
        physical_requirement: 'Able to walk 2–3 km and lift 10 kg',
      },
    ],
  },
  {
    name: 'Annapurna Community Kitchen (Demo)',
    category: 'community_kitchen',
    description: 'Cooks and serves around 300 free meals a day.',
    locality: 'Bandra East',
    lat: 19.0606,
    lng: 72.8489,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Hair covered and hands washed before entering the kitchen.',
    opportunities: [
      {
        title: 'Lunch prep and serving',
        activity: 'Chop vegetables, cook and serve lunch.',
        skills: ['cooking', 'physical_work'],
        beneficiaries: ['homeless', 'general_community'],
        assistance_types: ['food_preparation'],
        languages: [],
        days: ALL_DAYS,
        times_of_day: ['morning'],
        min_minutes: 60,
        max_minutes: 180,
      },
    ],
  },
  {
    name: 'Open Hands Disability Centre (Demo)',
    category: 'disability_support',
    description: 'Day centre for adults with intellectual disabilities.',
    locality: 'Khar East',
    lat: 19.0745,
    lng: 72.8468,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Short orientation required before first session.',
    opportunities: [
      {
        title: 'Art and activity assistant',
        activity: 'Support staff running art, music and life-skills activities.',
        skills: ['companionship', 'event_support'],
        beneficiaries: ['persons_with_disabilities'],
        assistance_types: ['companionship', 'event_support'],
        languages: ['hindi', 'english'],
        days: WEEKDAYS,
        times_of_day: ['afternoon'],
        min_minutes: 120,
        max_minutes: 180,
        min_age: 18,
      },
    ],
  },
  {
    name: 'Mithi River Clean-up Collective (Demo)',
    category: 'environment',
    description: 'Monthly river-bank and mangrove clean-ups.',
    locality: 'Kalina',
    lat: 19.0761,
    lng: 72.8655,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Gloves provided. Wear closed shoes. Under-16s need a guardian.',
    opportunities: [
      {
        title: 'Saturday river clean-up',
        activity: 'Collect and sort waste along the river bank.',
        skills: ['physical_work'],
        beneficiaries: ['environment'],
        assistance_types: ['outdoor_work', 'cleaning'],
        languages: [],
        days: ['saturday', 'sunday'],
        times_of_day: ['morning'],
        min_minutes: 120,
        max_minutes: 180,
        physical_requirement: 'Outdoor work in heat and mud',
      },
    ],
  },
  {
    name: 'Bright Futures Tutoring (Demo)',
    category: 'education_literacy',
    description: 'English and computer basics for teenagers.',
    locality: 'Vile Parle West',
    lat: 19.1012,
    lng: 72.8402,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Background check required before working with minors.',
    opportunities: [
      {
        title: 'Teen English and computer basics',
        activity: 'Teach English writing and basic computer skills to teenagers.',
        skills: ['teaching', 'english', 'technology'],
        beneficiaries: ['children'],
        assistance_types: ['teaching', 'technology_help'],
        languages: ['english', 'hindi'],
        days: ['sunday'],
        times_of_day: ['morning', 'afternoon'],
        min_minutes: 60,
        max_minutes: 120,
        min_age: 18,
        background_check: true,
      },
    ],
  },
  {
    name: 'Seaside Senior Club (Demo)',
    category: 'elderly_care',
    description: 'Day club for retired residents.',
    locality: 'Juhu',
    lat: 19.1075,
    lng: 72.8263,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Sign in at the front desk.',
    opportunities: [
      {
        title: 'Help with pension and bank paperwork',
        activity: 'Help seniors fill forms and understand bank statements. Never handle their cash or PINs.',
        skills: ['accounting', 'administration'],
        beneficiaries: ['elderly'],
        assistance_types: ['administration'],
        languages: ['english', 'hindi', 'gujarati'],
        days: ['saturday'],
        times_of_day: ['morning'],
        min_minutes: 60,
        max_minutes: 120,
      },
    ],
  },
  {
    name: 'Dharavi Learning Corner (Demo)',
    category: 'child_support',
    description: 'Community library and reading room for children.',
    locality: 'Dharavi',
    lat: 19.0408,
    lng: 72.8553,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Volunteers must not photograph children.',
    opportunities: [
      {
        title: 'Story-time reader',
        activity: 'Read stories aloud in English or Hindi and run a short discussion.',
        skills: ['teaching', 'english'],
        beneficiaries: ['children'],
        assistance_types: ['teaching', 'mentoring'],
        languages: ['english', 'hindi'],
        days: ['saturday', 'sunday'],
        times_of_day: ['afternoon'],
        min_minutes: 60,
        max_minutes: 90,
        min_age: 18,
        background_check: true,
      },
    ],
  },
  {
    // Pending verification: never appears in the trusted default results.
    name: 'New Dawn Youth Mentors (Demo, pending)',
    category: 'child_support',
    description: 'Mentoring programme awaiting verification.',
    locality: 'Bandra West',
    lat: 19.0581,
    lng: 72.8312,
    verification_status: 'PENDING',
    safeguarding_notes: 'Verification in progress.',
    opportunities: [
      {
        title: 'Sunday mentoring',
        activity: 'Career mentoring for teenagers.',
        skills: ['teaching', 'english'],
        beneficiaries: ['children'],
        assistance_types: ['mentoring'],
        languages: ['english'],
        days: ['sunday'],
        times_of_day: ['morning'],
        min_minutes: 60,
        max_minutes: 120,
      },
    ],
  },
  {
    // Unverified: also excluded by default.
    name: 'Quick Help Network (Demo, unverified)',
    category: 'community_service',
    description: 'Unverified listing used to demonstrate filtering.',
    locality: 'Bandra West',
    lat: 19.0612,
    lng: 72.8301,
    verification_status: 'UNVERIFIED',
    safeguarding_notes: 'Not verified.',
    opportunities: [
      {
        title: 'General help',
        activity: 'Various tasks.',
        skills: ['teaching'],
        beneficiaries: ['children'],
        assistance_types: ['teaching'],
        languages: ['english'],
        days: ['sunday'],
        times_of_day: ['morning'],
        min_minutes: 30,
        max_minutes: 120,
      },
    ],
  },
  {
    name: 'Thane Green Belt Trust (Demo)',
    category: 'environment',
    description: 'Tree planting on the city edge. Far from the demo centre on purpose.',
    locality: 'Thane',
    lat: 19.2183,
    lng: 72.9781,
    verification_status: 'VERIFIED',
    safeguarding_notes: 'Outdoor work.',
    opportunities: [
      {
        title: 'Monsoon tree planting',
        activity: 'Plant and mulch saplings.',
        skills: ['gardening', 'physical_work'],
        beneficiaries: ['environment'],
        assistance_types: ['outdoor_work'],
        languages: [],
        days: WEEKEND,
        times_of_day: ['morning'],
        min_minutes: 120,
        max_minutes: 240,
      },
    ],
  },
];
