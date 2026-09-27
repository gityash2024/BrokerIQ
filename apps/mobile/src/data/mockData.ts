export interface BrokerProfile {
  name: string;
  role: string;
  agency: string;
  city: string;
  reraNumber: string;
  phone: string;
  email: string;
  plan: string;
  planExpiry: string;
  teamSize: number;
  avatar: string;
}

export interface MetricSummary {
  newLeadsToday: number;
  newLeadsTrend: string;
  activeLeads: number;
  activeLeadsTrend: string;
  followUpsDue: number;
  siteVisitsScheduled: number;
  monthlyPipelineCr: string;
  closedThisMonthCr: string;
  commissionEarnedLakh: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  budgetMin: string;
  budgetMax: string;
  requirement: string;
  location: string;
  bhk: string;
  stage: "NEW" | "CONTACTED" | "SITE_VISIT" | "NEGOTIATION" | "WON" | "LOST";
  source: "Housing.com" | "MagicBricks" | "99acres" | "WhatsApp" | "Referral" | "Walk-in";
  priority: "HOT" | "WARM" | "COLD";
  followUpDate: string;
  followUpTime: string;
  notes: string;
  lastContacted: string;
  aiScore: number;
  aiInsight: string;
  matchingPropertyId?: string;
}

export interface Property {
  id: string;
  title: string;
  builder: string;
  location: string;
  subLocation: string;
  price: string;
  pricePerSqFt: string;
  bhk: string;
  areaSqFt: number;
  possession: string;
  reraId: string;
  furnishing: "Unfurnished" | "Semi-Furnished" | "Fully-Furnished";
  type: "Apartment" | "Penthouse" | "Villa" | "Commercial Office";
  purpose: "Sale" | "Rent";
  imageUrl: string;
  matchingLeadsCount: number;
  amenities: string[];
  description: string;
  contactPerson: string;
}

export interface FollowUpTask {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  propertyTitle: string;
  type: "Site Visit" | "Call" | "WhatsApp Brochure" | "Price Negotiation" | "Token Collection";
  date: string;
  time: string;
  status: "TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED";
  priority: "HIGH" | "MEDIUM" | "NORMAL";
  notes: string;
}

export const MOCK_BROKER: BrokerProfile = {
  name: "Rajesh Sharma",
  role: "Managing Principal Broker",
  agency: "AcreRise Realty & Advisory",
  city: "Mumbai, Maharashtra",
  reraNumber: "A51900028491",
  phone: "+91 98201 84729",
  email: "rajesh@acrerise.in",
  plan: "Enterprise Platinum",
  planExpiry: "31 Dec 2026",
  teamSize: 6,
  avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80",
};

export const MOCK_METRICS: MetricSummary = {
  newLeadsToday: 8,
  newLeadsTrend: "+3 vs yesterday",
  activeLeads: 184,
  activeLeadsTrend: "+14% this month",
  followUpsDue: 6,
  siteVisitsScheduled: 4,
  monthlyPipelineCr: "₹ 48.5 Cr",
  closedThisMonthCr: "₹ 7.2 Cr",
  commissionEarnedLakh: "₹ 14.4 L",
};

export const MOCK_LEADS: Lead[] = [
  {
    id: "lead-1",
    name: "Vikramaditya Singhania",
    phone: "+91 98200 45129",
    email: "v.singhania@apexcapital.in",
    budgetMin: "₹ 8.0 Cr",
    budgetMax: "₹ 10.0 Cr",
    requirement: "Sea-facing luxury 4BHK with 3 covered car parks on higher floors",
    location: "Worli / Lower Parel",
    bhk: "4 BHK",
    stage: "SITE_VISIT",
    source: "Housing.com",
    priority: "HOT",
    followUpDate: "Today",
    followUpTime: "03:30 PM",
    notes: "Managing Partner at VC firm. Highly intent. Site visit scheduled at Lodha World One Unit 4802.",
    lastContacted: "2 hours ago",
    aiScore: 96,
    aiInsight: "96% Match with Lodha World One. High purchasing power confirmed.",
    matchingPropertyId: "prop-1",
  },
  {
    id: "lead-2",
    name: "Dr. Neha Agarwal",
    phone: "+91 91672 88390",
    email: "dr.neha.agarwal@gmail.com",
    budgetMin: "₹ 2.2 Cr",
    budgetMax: "₹ 2.8 Cr",
    requirement: "3BHK inside township with school & healthcare proximity for family",
    location: "Hiranandani Estate, Thane West",
    bhk: "3 BHK",
    stage: "NEGOTIATION",
    source: "MagicBricks",
    priority: "HOT",
    followUpDate: "Today",
    followUpTime: "05:00 PM",
    notes: "Cost sheet sent. Discussing 2% discount on floor rise charges with developer sales head.",
    lastContacted: "Yesterday",
    aiScore: 92,
    aiInsight: "92% Match with Oberoi Sky City. Ready for token payment this week.",
    matchingPropertyId: "prop-2",
  },
  {
    id: "lead-3",
    name: "Pradeep Goyal (NRI)",
    phone: "+971 50 829 4410",
    email: "pradeep.goyal@emiratesholdings.ae",
    budgetMin: "₹ 10.0 Cr",
    budgetMax: "₹ 15.0 Cr",
    requirement: "Duplex Penthouse or Ultra Luxury 4BHK in South Mumbai for investment",
    location: "Mahalaxmi / Lower Parel",
    bhk: "4 BHK",
    stage: "SITE_VISIT",
    source: "WhatsApp",
    priority: "HOT",
    followUpDate: "Tomorrow",
    followUpTime: "11:00 AM",
    notes: "Arriving in Mumbai Saturday. Video walkthrough done yesterday. Wants legal check on title deeds.",
    lastContacted: "3 hours ago",
    aiScore: 94,
    aiInsight: "High net worth overseas investor. Pre-approved for instant wire transfer.",
    matchingPropertyId: "prop-3",
  },
  {
    id: "lead-4",
    name: "Rohan & Ananya Deshpande",
    phone: "+91 98920 11984",
    email: "rohan.deshpande@techcorp.com",
    budgetMin: "₹ 1.8 Cr",
    budgetMax: "₹ 2.4 Cr",
    requirement: "Ready to Move 2BHK or compact 3BHK near Eastern Freeway / Monorail",
    location: "Wadala / Sewri",
    bhk: "2 BHK",
    stage: "NEW",
    source: "Housing.com",
    priority: "WARM",
    followUpDate: "Today",
    followUpTime: "06:15 PM",
    notes: "Tech leads at Google. Need home loan assistance. Looking to shift before Diwali.",
    lastContacted: "5 hours ago",
    aiScore: 88,
    aiInsight: "Strong match for Godrej Horizon Wadala. Loan eligibility already pre-vetted.",
    matchingPropertyId: "prop-4",
  },
  {
    id: "lead-5",
    name: "Col. Sanjeev Kapoor (Retd.)",
    phone: "+91 98199 77201",
    email: "sanjeev.kapoor.defence@gmail.com",
    budgetMin: "₹ 1.2 Cr",
    budgetMax: "₹ 1.6 Cr",
    requirement: "Peaceful 2BHK on lower floor with senior citizen walking tracks & clubhouse",
    location: "Ghodbunder Road, Thane",
    bhk: "2 BHK",
    stage: "CONTACTED",
    source: "Referral",
    priority: "WARM",
    followUpDate: "Today",
    followUpTime: "04:00 PM",
    notes: "Referred by Brig. Menon. Wants to see sample flat on Sunday morning.",
    lastContacted: "1 day ago",
    aiScore: 85,
    aiInsight: "Prefers quiet green surroundings with club amenities.",
    matchingPropertyId: "prop-5",
  },
  {
    id: "lead-6",
    name: "Kunal Shah & Partners",
    phone: "+91 98210 99420",
    email: "kunal@growthfin.in",
    budgetMin: "₹ 12.0 Cr",
    budgetMax: "₹ 16.0 Cr",
    requirement: "Commercial Grade-A Bare Shell Office Space (3,000 - 4,000 sq.ft) in BKC",
    location: "Bandra Kurla Complex (BKC)",
    bhk: "Commercial",
    stage: "NEGOTIATION",
    source: "99acres",
    priority: "HOT",
    followUpDate: "Tomorrow",
    followUpTime: "02:00 PM",
    notes: "Expanding fintech headquarters. Letter of Intent (LOI) draft in progress.",
    lastContacted: "4 hours ago",
    aiScore: 97,
    aiInsight: "Commercial Grade A match: One BKC Suite. Immediate possession required.",
    matchingPropertyId: "prop-6",
  },
  {
    id: "lead-7",
    name: "Sunita Deshmukh",
    phone: "+91 97690 33819",
    email: "sunita.deshmukh@hdfcbank.com",
    budgetMin: "₹ 95 Lakh",
    budgetMax: "₹ 1.25 Cr",
    requirement: "1BHK or compact 2BHK in gated society for self-occupation",
    location: "Panvel / Navi Mumbai",
    bhk: "1 BHK",
    stage: "WON",
    source: "Walk-in",
    priority: "COLD",
    followUpDate: "Completed",
    followUpTime: "Done",
    notes: "Deal Closed! Commission ₹2.4 Lakhs received. Key handover completed.",
    lastContacted: "Yesterday",
    aiScore: 100,
    aiInsight: "Deal Closed. Customer onboarding & referral survey pending.",
    matchingPropertyId: "prop-7",
  },
  {
    id: "lead-8",
    name: "Harish Chandra Iyer",
    phone: "+91 98400 66291",
    email: "hc.iyer@tatasons.com",
    budgetMin: "₹ 4.5 Cr",
    budgetMax: "₹ 5.5 Cr",
    requirement: "3BHK Sea-facing residence near Mahalaxmi Racecourse",
    location: "South Mumbai",
    bhk: "3 BHK",
    stage: "SITE_VISIT",
    source: "WhatsApp",
    priority: "HOT",
    followUpDate: "Today",
    followUpTime: "07:00 PM",
    notes: "Executive Vice President at Tata Sons. Interested in Piramal Mahalaxmi Tower 2.",
    lastContacted: "1 hour ago",
    aiScore: 95,
    aiInsight: "VIP Client. Request developer CRM to arrange private high-tea viewing.",
    matchingPropertyId: "prop-8",
  },
];

export const MOCK_PROPERTIES: Property[] = [
  {
    id: "prop-1",
    title: "Lodha World One",
    builder: "Lodha Group",
    location: "Lower Parel, South Mumbai",
    subLocation: "Senapati Bapat Marg",
    price: "8.75 Cr",
    pricePerSqFt: "₹ 30,700 / sq.ft",
    bhk: "4 BHK Luxe",
    areaSqFt: 2850,
    possession: "Ready to Move",
    reraId: "P51900008345",
    furnishing: "Semi-Furnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 5,
    amenities: ["Sea Facing", "Private High-Speed Lift", "Olympic Pool", "Spa & Concierge", "3 Car Parks", "Helipad Access"],
    description: "Iconic tower offering 360-degree panoramic Arabian Sea views. Master bedroom with walk-in Italian closets and lavish marble finishes.",
    contactPerson: "Aditya Mehta (Developer Sales Head) - +91 98200 99881",
  },
  {
    id: "prop-2",
    title: "Oberoi Sky City",
    builder: "Oberoi Realty",
    location: "Borivali East, Western Suburbs",
    subLocation: "Western Express Highway",
    price: "3.40 Cr",
    pricePerSqFt: "₹ 23,940 / sq.ft",
    bhk: "3 BHK Grand",
    areaSqFt: 1420,
    possession: "Under Construction (Dec 2026)",
    reraId: "P51800003582",
    furnishing: "Unfurnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 8,
    amenities: ["Direct Metro Access", "25-Acre Integrated Township", "Grand Clubhouse", "Tennis Courts", "Multi-tier Security"],
    description: "Premier integrated living adjacent to Sanjay Gandhi National Park. Unobstructed lush green hill views with resort amenities.",
    contactPerson: "Nidhi Saxena - +91 98110 55432",
  },
  {
    id: "prop-3",
    title: "Kalpataru Avana",
    builder: "Kalpataru Developers",
    location: "Parel, Central Mumbai",
    subLocation: "Dr. Ambedkar Road",
    price: "6.20 Cr",
    pricePerSqFt: "₹ 31,300 / sq.ft",
    bhk: "3 BHK Signature",
    areaSqFt: 1980,
    possession: "Ready to Move",
    reraId: "P51900000843",
    furnishing: "Fully-Furnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 4,
    amenities: ["12.8 Ft Ceiling Height", "East-West Cross Ventilation", "Infinity Rooftop Pool", "Banquets", "3 Covered Parks"],
    description: "Ultra-spacious layout with 12.8 ft ceiling heights. Designer interiors done by top architectural firm. Immediate occupancy.",
    contactPerson: "Suresh Rao - +91 99201 44321",
  },
  {
    id: "prop-4",
    title: "Godrej Horizon",
    builder: "Godrej Properties",
    location: "Wadala, Mumbai",
    subLocation: "Rafi Ahmed Kidwai Road",
    price: "2.45 Cr",
    pricePerSqFt: "₹ 27,840 / sq.ft",
    bhk: "2 BHK Premium",
    areaSqFt: 880,
    possession: "Under Construction (June 2027)",
    reraId: "P51900034851",
    furnishing: "Semi-Furnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 6,
    amenities: ["Eastern Harbor Views", "Sky Lounge at 400ft", "Kids Play Zone", "Gymnasium", "EV Charging Station"],
    description: "Well-connected to Fort, BKC and Chembur via Eastern Freeway. High rental yield demand from corporate executives.",
    contactPerson: "Vikram Joshi - +91 98205 11234",
  },
  {
    id: "prop-5",
    title: "Hiranandani Estate — Rodas Enclave",
    builder: "Hiranandani Group",
    location: "Thane West",
    subLocation: "Ghodbunder Road",
    price: "1.95 Cr",
    pricePerSqFt: "₹ 17,700 / sq.ft",
    bhk: "2.5 BHK",
    areaSqFt: 1100,
    possession: "Ready to Move",
    reraId: "P51700001099",
    furnishing: "Semi-Furnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 7,
    amenities: ["Neo-Classical Architecture", "The Blue Lagoon Club", "Hiranandani Hospital 2 mins", "Suraj Water Park nearby"],
    description: "World-renowned neo-classical architecture in a fully self-contained township. Premium lifestyle with lush lakeside promenade.",
    contactPerson: "Priya Nair - +91 98922 66789",
  },
  {
    id: "prop-6",
    title: "One BKC Corporate Suite",
    builder: "Radius Developers",
    location: "Bandra Kurla Complex (BKC)",
    subLocation: "G Block BKC, Bandra East",
    price: "14.50 Cr",
    pricePerSqFt: "₹ 45,300 / sq.ft",
    bhk: "Commercial (Grade A)",
    areaSqFt: 3200,
    possession: "Ready to Move",
    reraId: "P51800001429",
    furnishing: "Unfurnished",
    type: "Commercial Office",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 3,
    amenities: ["LEED Gold Certified", "Central HVAC", "10 High Speed Elevators", "Double Height Lobby", "Food Court", "6 Car Parks"],
    description: "Prime corporate suite in Mumbai’s premier business district. Surrounded by leading multinational banks and consulate embassies.",
    contactPerson: "Farhan Contractor - +91 98200 12040",
  },
  {
    id: "prop-7",
    title: "Hiranandani Fortune City",
    builder: "Hiranandani Communities",
    location: "Panvel, Navi Mumbai",
    subLocation: "Old Mumbai-Pune Highway",
    price: "1.25 Cr",
    pricePerSqFt: "₹ 15,800 / sq.ft",
    bhk: "2 BHK Nature Luxe",
    areaSqFt: 790,
    possession: "Ready to Move",
    reraId: "P52000000854",
    furnishing: "Semi-Furnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 4,
    amenities: ["10 Mins to Navi Mumbai Airport", "Hiranandani Trust School", "Cricket Pitch", "Podium Gardens"],
    description: "Sprawling township poised for massive appreciation with the new Navi Mumbai International Airport opening.",
    contactPerson: "Sanjay Shinde - +91 98230 45678",
  },
  {
    id: "prop-8",
    title: "Piramal Mahalaxmi Tower 2",
    builder: "Piramal Realty",
    location: "Mahalaxmi, South Mumbai",
    subLocation: "Sanane Guruji Marg",
    price: "5.10 Cr",
    pricePerSqFt: "₹ 32,900 / sq.ft",
    bhk: "3 BHK Sea & Racecourse",
    areaSqFt: 1550,
    possession: "Ready to Move",
    reraId: "P51900016482",
    furnishing: "Semi-Furnished",
    type: "Apartment",
    purpose: "Sale",
    imageUrl: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&auto=format&fit=crop&q=80",
    matchingLeadsCount: 6,
    amenities: ["Lifetime Mahalaxmi Racecourse View", "Arabian Sea Vistas", "Clubhouse by Wilson Associates", "Heated Indoor Lap Pool"],
    description: "Unrivaled views of the historic 225-acre Mahalaxmi Racecourse and the glistening Arabian Sea. Luxury living at its finest.",
    contactPerson: "Kavita Menon - +91 98211 88902",
  },
];

export const MOCK_FOLLOW_UPS: FollowUpTask[] = [
  {
    id: "task-1",
    leadId: "lead-1",
    leadName: "Vikramaditya Singhania",
    phone: "+91 98200 45129",
    propertyTitle: "Lodha World One (Unit 4802)",
    type: "Site Visit",
    date: "Today",
    time: "03:30 PM",
    status: "TODAY",
    priority: "HIGH",
    notes: "Meet client at Tower 1 Lobby. Developer sales rep Aditya Mehta will escort.",
  },
  {
    id: "task-2",
    leadId: "lead-2",
    leadName: "Dr. Neha Agarwal",
    phone: "+91 91672 88390",
    propertyTitle: "Oberoi Sky City 3BHK",
    type: "Price Negotiation",
    date: "Today",
    time: "05:00 PM",
    status: "TODAY",
    priority: "HIGH",
    notes: "Finalize discount on car parking and club membership charges.",
  },
  {
    id: "task-3",
    leadId: "lead-4",
    leadName: "Rohan Deshpande",
    phone: "+91 98920 11984",
    propertyTitle: "Godrej Horizon Wadala",
    type: "Call",
    date: "Today",
    time: "06:15 PM",
    status: "TODAY",
    priority: "MEDIUM",
    notes: "Confirm home loan pre-approval status with HDFC bank manager.",
  },
  {
    id: "task-4",
    leadId: "lead-5",
    leadName: "Col. Sanjeev Kapoor",
    phone: "+91 98199 77201",
    propertyTitle: "Rodas Enclave Thane",
    type: "WhatsApp Brochure",
    date: "Yesterday (Overdue)",
    time: "Overdue by 1 day",
    status: "OVERDUE",
    priority: "HIGH",
    notes: "Share high-res layout plans and maintenance fee structure on WhatsApp.",
  },
  {
    id: "task-5",
    leadId: "lead-3",
    leadName: "Pradeep Goyal (NRI)",
    phone: "+971 50 829 4410",
    propertyTitle: "Kalpataru Avana Parel",
    type: "Call",
    date: "Overdue by 2 days",
    time: "Overdue",
    status: "OVERDUE",
    priority: "HIGH",
    notes: "Confirm Dubai arrival date and luxury car pickup from Mumbai airport.",
  },
  {
    id: "task-6",
    leadId: "lead-6",
    leadName: "Kunal Shah",
    phone: "+91 98210 99420",
    propertyTitle: "One BKC Corporate Suite",
    type: "Token Collection",
    date: "Tomorrow",
    time: "02:00 PM",
    status: "UPCOMING",
    priority: "HIGH",
    notes: "Meet company legal counsel for signing Letter of Intent (LOI) & ₹25L token cheque.",
  },
  {
    id: "task-7",
    leadId: "lead-8",
    leadName: "Harish Chandra Iyer",
    phone: "+91 98400 66291",
    propertyTitle: "Piramal Mahalaxmi Tower 2",
    type: "Site Visit",
    date: "Tomorrow",
    time: "04:30 PM",
    status: "UPCOMING",
    priority: "MEDIUM",
    notes: "Sunset viewing from 42nd floor sample suite. Coffee arrangement made.",
  },
  {
    id: "task-8",
    leadId: "lead-7",
    leadName: "Sunita Deshmukh",
    phone: "+91 97690 33819",
    propertyTitle: "Hiranandani Fortune City",
    type: "Token Collection",
    date: "Yesterday",
    time: "Completed",
    status: "COMPLETED",
    priority: "NORMAL",
    notes: "Agreement registered at Panvel sub-registrar office. All fees cleared.",
  },
];

export const MOCK_ACTIVITY_LOGS = [
  { id: "1", time: "10 mins ago", title: "New Lead Ingested", detail: "Vikramaditya Singhania submitted inquiry on Lodha World One (Housing.com)", type: "LEAD" },
  { id: "2", time: "45 mins ago", title: "WhatsApp Brochure Sent", detail: "Sent 12-page PDF brochure of Piramal Mahalaxmi to Harish Iyer", type: "WHATSAPP" },
  { id: "3", time: "2 hours ago", title: "Site Visit Confirmed", detail: "Dr. Neha Agarwal confirmed site visit today at 5:00 PM", type: "VISIT" },
  { id: "4", time: "4 hours ago", title: "Stage Updated to NEGOTIATION", detail: "Kunal Shah moved to Negotiation stage for One BKC Commercial Suite", type: "DEAL" },
  { id: "5", time: "1 day ago", title: "Payment Received", detail: "₹ 2,40,000 Brokerage commission credited for Sunita Deshmukh deal", type: "PAYMENT" },
];
