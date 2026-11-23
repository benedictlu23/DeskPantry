import {
  ChatThread,
  CommissionType,
  EWalletPost,
  FulfillmentType,
  InternalApp,
  LoanRecord,
  MarketplaceListing,
  NotificationItem,
  PautanganSettings,
  PaymentMethod,
  PaymentMethodConfig,
  PaymentProof,
  StoreConfig,
  StoreItem,
  StoreOrder,
  SuggestionItem,
  UserAccount,
  UserRole,
} from '../types';

export const HERO_IMAGE = '/src/assets/images/hero_pantry_counter_1795142298843.jpg';

export const ITEM_IMAGE_PRESETS = [
  { label: 'Iced Coffee Bottle', path: '/src/assets/images/item_iced_coffee_1795142299223.jpg' },
  { label: 'Cookies & Crackers', path: '/src/assets/images/item_pantry_snacks_1795142298218.jpg' },
  { label: 'Bento & Green Tea', path: '/src/assets/images/item_cup_meals_1795142298690.jpg' },
  { label: 'Pantry Counter Stock', path: '/src/assets/images/hero_pantry_counter_1795142298843.jpg' },
];

export const GCASH_ICON_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="22" fill="#007DFE"/>
      <circle cx="48" cy="48" r="26" fill="none" stroke="#FFFFFF" stroke-width="7"/>
      <path d="M51 48H68C68 59.046 59.046 68 48 68C36.954 68 28 59.046 28 48C28 36.954 36.954 28 48 28C54.2 28 59.7 30.8 63.3 35.2" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
      <circle cx="48" cy="48" r="5" fill="#FFFFFF"/>
    </svg>`
  );

export const MAYA_ICON_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="22" fill="#0E1726"/>
      <rect x="14" y="14" width="68" height="68" rx="16" fill="#00D66C"/>
      <text x="48" y="57" font-family="sans-serif" font-size="22" font-weight="800" fill="#0E1726" text-anchor="middle">maya</text>
    </svg>`
  );

export const MARIBANK_ICON_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="22" fill="#EA580C"/>
      <text x="48" y="56" font-family="sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" text-anchor="middle">Mari</text>
    </svg>`
  );

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'pm-cash',
    title: 'Cash',
    type: 'cash',
    enabled: true,
    instructions: 'Pay exact cash at Pantry Counter B or directly to the delivery runner.',
  },
  {
    id: 'pm-debt',
    title: 'Store Credit (Debt)',
    type: 'debt',
    enabled: true,
    instructions: 'Charged to your coworker ledger and settled on the 15th / 30th cutoff.',
  },
  {
    id: 'pm-gcash',
    title: 'GCash',
    type: 'digital',
    enabled: true,
    iconImage: GCASH_ICON_DATA_URL,
    accountNumber: '0917-555-0194',
    accountName: 'DeskPantry Ops',
    instructions: 'Scan QR or send via Express Send, then upload your receipt for Admin review.',
  },
  {
    id: 'pm-maya',
    title: 'Maya',
    type: 'digital',
    enabled: true,
    iconImage: MAYA_ICON_DATA_URL,
    accountNumber: '0918-882-3310',
    accountName: 'DeskPantry Ops',
    instructions: 'Transfer via Maya wallet or QR Ph and attach your reference number.',
  },
  {
    id: 'pm-maribank',
    title: 'MariBank',
    type: 'digital',
    enabled: true,
    iconImage: MARIBANK_ICON_DATA_URL,
    accountNumber: '1049-8821-7704',
    accountName: 'DeskPantry Ops',
    instructions: 'InstaPay transfer to MariBank account and attach your confirmation screenshot.',
  },
];

export const INITIAL_STORE_CATEGORIES: string[] = [
  'Coffee & Drinks',
  'Snacks & Pastries',
  'Meals & Pantry',
  'Desk Essentials',
];

export const INITIAL_STORE_CONFIG: StoreConfig = {
  storeAnnouncement: 'Fresh Iced Spanish Latte & Batangas Suman restocked today. Cutoffs every 15th & 30th. Desk delivery fee goes 100% to delivery staff.',
  deliveryEnabled: true,
  deliveryFee: 15,
  walletAccountName: 'DeskPantry Ops',
  walletAccountNumber: '0917-555-0194',
  categories: INITIAL_STORE_CATEGORIES,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};

export const SAMPLE_RECEIPT_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="440" viewBox="0 0 360 440">
  <rect width="360" height="440" fill="#F0FDFA"/>
  <rect x="24" y="24" width="312" height="392" rx="16" fill="#FFFFFF" stroke="#D6D3D1"/>
  <rect x="24" y="24" width="312" height="64" rx="16" fill="#0F766E"/>
  <text x="180" y="62" font-family="sans-serif" font-size="18" font-weight="700" fill="#FFFFFF" text-anchor="middle">GCash Express Send Receipt</text>
  <text x="180" y="132" font-family="sans-serif" font-size="13" fill="#78716C" text-anchor="middle">Amount Paid</text>
  <text x="180" y="166" font-family="monospace" font-size="28" font-weight="700" fill="#1C1917" text-anchor="middle">PHP 450.00</text>
  <line x1="48" y1="196" x2="312" y2="196" stroke="#E7E5E4" stroke-dasharray="4 4"/>
  <text x="48" y="232" font-family="sans-serif" font-size="12" fill="#78716C">Recipient</text>
  <text x="312" y="232" font-family="sans-serif" font-size="12" font-weight="600" fill="#1C1917" text-anchor="end">DeskPantry Ops</text>
  <text x="48" y="264" font-family="sans-serif" font-size="12" fill="#78716C">Ref No.</text>
  <text x="312" y="264" font-family="monospace" font-size="12" font-weight="600" fill="#1C1917" text-anchor="end">GC-904821735</text>
  <text x="48" y="296" font-family="sans-serif" font-size="12" fill="#78716C">Date</text>
  <text x="312" y="296" font-family="sans-serif" font-size="12" fill="#1C1917" text-anchor="end">Nov 19, 2026 · 2:14 PM</text>
  <rect x="48" y="336" width="264" height="44" rx="10" fill="#DCFCE7"/>
  <text x="180" y="363" font-family="sans-serif" font-size="13" font-weight="600" fill="#166534" text-anchor="middle">Transfer Successful</text>
</svg>
`);

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'u-clarisse',
    name: 'Clarisse Mendoza',
    email: 'clarisse.m@company.ph',
    department: 'Product Design',
    role: UserRole.Member,
    debtBalance: 865,
    pautanganEnabled: true,
    pautanganLimit: 4000,
    avatarInitials: 'CM',
    totalSpent: 4820,
  },
  {
    id: 'u-marco',
    name: 'Marco Villanueva',
    email: 'marco.v@company.ph',
    department: 'Quality Engineering',
    role: UserRole.Member,
    debtBalance: 1240,
    pautanganEnabled: true,
    pautanganLimit: 5000,
    avatarInitials: 'MV',
    totalSpent: 6150,
  },
  {
    id: 'u-bea',
    name: 'Bea Santos',
    email: 'bea.s@company.ph',
    department: 'People Operations',
    role: UserRole.Member,
    debtBalance: 0,
    pautanganEnabled: true,
    pautanganLimit: 3500,
    avatarInitials: 'BS',
    totalSpent: 2940,
  },
  {
    id: 'u-jun',
    name: 'Kuya Jun Reyes',
    email: 'jun.reyes@company.ph',
    department: 'Pantry Delivery & Logistics',
    role: UserRole.DeliveryStaff,
    debtBalance: 0,
    pautanganEnabled: true,
    pautanganLimit: 3000,
    avatarInitials: 'JR',
    totalSpent: 1250,
  },
  {
    id: 'u-benedict',
    name: 'Benedict Lu',
    email: 'benedictlu23@gmail.com',
    department: 'Engineering Ops',
    role: UserRole.SuperAdmin,
    debtBalance: 420,
    pautanganEnabled: true,
    pautanganLimit: 6000,
    avatarInitials: 'BL',
    totalSpent: 3910,
  },
  {
    id: 'u-director',
    name: 'Direk Rafa Tolentino',
    email: 'rafa.tolentino@company.ph',
    department: 'Department Leadership',
    role: UserRole.SuperAdmin,
    debtBalance: 0,
    pautanganEnabled: true,
    pautanganLimit: 10000,
    avatarInitials: 'RT',
    totalSpent: 5400,
  },
];

export const INITIAL_STORE_ITEMS: StoreItem[] = [
  {
    id: 'item-1',
    name: 'Iced Spanish Latte (250ml)',
    category: 'Coffee & Drinks',
    description: 'Chilled espresso with condensed milk in a reusable glass bottle.',
    price: 95,
    costPrice: 58,
    costHistory: [
      {
        id: 'ch-1a',
        date: '2026-10-15',
        costPrice: 54,
        sellingPrice: 90,
        note: 'Initial pantry supplier batch',
        updatedBy: 'Benedict Lu',
      },
      {
        id: 'ch-1b',
        date: '2026-11-10',
        costPrice: 58,
        sellingPrice: 95,
        note: 'Adjusted for condensed milk & glass bottle cost',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 18,
    soldCount: 84,
    image: '/src/assets/images/item_iced_coffee_1795142299223.jpg',
  },
  {
    id: 'item-2',
    name: 'Cold Brew Hojicha Green Tea',
    category: 'Coffee & Drinks',
    description: 'Crisp roasted Japanese green tea brewed overnight, unsweetened.',
    price: 85,
    costPrice: 48,
    costHistory: [
      {
        id: 'ch-2a',
        date: '2026-11-01',
        costPrice: 48,
        sellingPrice: 85,
        note: 'Weekly tea leaf restock',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 14,
    soldCount: 52,
    image: '/src/assets/images/item_cup_meals_1795142298690.jpg',
  },
  {
    id: 'item-3',
    name: 'Sea Salt Dark Choco Cookies (3 pcs)',
    category: 'Snacks & Pastries',
    description: 'Soft-baked dark chocolate chunk cookies with flaky sea salt.',
    price: 75,
    costPrice: 45,
    costHistory: [
      {
        id: 'ch-3a',
        date: '2026-10-20',
        costPrice: 42,
        sellingPrice: 70,
        note: 'Initial bakery tray order',
        updatedBy: 'Benedict Lu',
      },
      {
        id: 'ch-3b',
        date: '2026-11-12',
        costPrice: 45,
        sellingPrice: 75,
        note: 'Dark couverture butter price update',
        updatedBy: 'Direk Rafa Tolentino',
      },
    ],
    stock: 22,
    soldCount: 96,
    image: '/src/assets/images/item_pantry_snacks_1795142298218.jpg',
  },
  {
    id: 'item-4',
    name: 'Savory Herb & Cheese Crackers',
    category: 'Snacks & Pastries',
    description: 'Oven-toasted rosemary flatbread crisps and cheddar crackers.',
    price: 60,
    costPrice: 36,
    costHistory: [
      {
        id: 'ch-4a',
        date: '2026-11-03',
        costPrice: 36,
        sellingPrice: 60,
        note: 'Registered wholesale box cost',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 26,
    soldCount: 68,
    image: '/src/assets/images/item_pantry_snacks_1795142298218.jpg',
  },
  {
    id: 'item-5',
    name: 'Teriyaki Chicken Bento Box',
    category: 'Meals & Pantry',
    description: 'Steamed rice, grilled chicken teriyaki, tamagoyaki, and greens.',
    price: 165,
    costPrice: 118,
    costHistory: [
      {
        id: 'ch-5a',
        date: '2026-11-05',
        costPrice: 112,
        sellingPrice: 160,
        note: 'Partner concessionaire batch',
        updatedBy: 'Benedict Lu',
      },
      {
        id: 'ch-5b',
        date: '2026-11-18',
        costPrice: 118,
        sellingPrice: 165,
        note: 'Updated bento container & rice cost',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 9,
    soldCount: 61,
    image: '/src/assets/images/item_cup_meals_1795142298690.jpg',
  },
  {
    id: 'item-6',
    name: 'Oat Milk Barista Tetra (1L)',
    category: 'Coffee & Drinks',
    description: 'Creamy pantry-staple oat milk for desk espresso and matcha.',
    price: 155,
    costPrice: 115,
    costHistory: [
      {
        id: 'ch-6a',
        date: '2026-11-08',
        costPrice: 115,
        sellingPrice: 155,
        note: 'Case of 12 restock',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 7,
    soldCount: 34,
    image: '/src/assets/images/hero_pantry_counter_1795142298843.jpg',
  },
  {
    id: 'item-7',
    name: 'Trail Mix Roasted Almonds & Cashews',
    category: 'Snacks & Pastries',
    description: 'Resealable 150g pantry jar of lightly salted nuts and cranberries.',
    price: 110,
    costPrice: 74,
    costHistory: [
      {
        id: 'ch-7a',
        date: '2026-11-04',
        costPrice: 74,
        sellingPrice: 110,
        note: 'Bulk jar pack cost',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 5,
    soldCount: 41,
    image: '/src/assets/images/hero_pantry_counter_1795142298843.jpg',
  },
  {
    id: 'item-8',
    name: 'USB-C Braided Desk Cable (1.5m)',
    category: 'Desk Essentials',
    description: 'Emergency fast-charging cable kept stocked in the pantry drawer.',
    price: 220,
    costPrice: 135,
    costHistory: [
      {
        id: 'ch-8a',
        date: '2026-10-28',
        costPrice: 135,
        sellingPrice: 220,
        note: 'IT pantry drawer supply',
        updatedBy: 'Benedict Lu',
      },
    ],
    stock: 6,
    soldCount: 19,
  },
];

export const INITIAL_ORDERS: StoreOrder[] = [
  {
    id: 'ORD-2401',
    userId: 'u-clarisse',
    userName: 'Clarisse Mendoza',
    items: [
      { itemId: 'item-1', name: 'Iced Spanish Latte (250ml)', quantity: 2, unitPrice: 95 },
      { itemId: 'item-3', name: 'Sea Salt Dark Choco Cookies (3 pcs)', quantity: 1, unitPrice: 75 },
    ],
    totalAmount: 280,
    deliveryFee: 15,
    deliveryCommission: 15,
    fulfillment: FulfillmentType.Delivery,
    deliveryNote: '4F Design Pod · Desk 12',
    paymentMethod: PaymentMethod.Debt,
    status: 'Confirmed',
    deliveryStatus: 'Pending Dispatch',
    assignedRunnerId: 'u-jun',
    assignedRunner: 'Kuya Jun Reyes',
    createdAt: '2026-11-19 02:15 PM',
    orderDateIso: '2026-11-19',
    dueDateLabel: 'Nov 30',
    source: 'store',
    logs: [
      { id: 'lg-1', timestamp: '2026-11-19 02:15 PM', event: 'Order placed via Store Credit (Debt)', actor: 'Clarisse Mendoza' },
      { id: 'lg-2', timestamp: '2026-11-19 02:16 PM', event: 'Assigned to runner Kuya Jun Reyes (₱15 delivery fee commission)', actor: 'System' },
    ],
  },
  {
    id: 'ORD-2404',
    userId: 'u-bea',
    userName: 'Bea Santos',
    items: [
      { itemId: 'item-5', name: 'Teriyaki Chicken Bento Box', quantity: 1, unitPrice: 165 },
      { itemId: 'item-2', name: 'Cold Brew Hojicha Green Tea', quantity: 1, unitPrice: 85 },
    ],
    totalAmount: 265,
    deliveryFee: 15,
    deliveryCommission: 15,
    fulfillment: FulfillmentType.Delivery,
    deliveryNote: '3F People Ops · Room B',
    paymentMethod: PaymentMethod.Cash,
    status: 'Confirmed',
    deliveryStatus: 'Out for Delivery',
    assignedRunnerId: 'u-jun',
    assignedRunner: 'Kuya Jun Reyes',
    cashCollected: false,
    createdAt: '2026-11-19 01:40 PM',
    orderDateIso: '2026-11-19',
    source: 'store',
    logs: [
      { id: 'lg-3', timestamp: '2026-11-19 01:40 PM', event: 'Order placed (Cash on Delivery)', actor: 'Bea Santos' },
      { id: 'lg-4', timestamp: '2026-11-19 01:44 PM', event: 'Marked Out for Delivery', actor: 'Kuya Jun Reyes' },
    ],
  },
  {
    id: 'ORD-2395',
    userId: 'u-clarisse',
    userName: 'Clarisse Mendoza',
    items: [
      { itemId: 'item-5', name: 'Teriyaki Chicken Bento Box', quantity: 1, unitPrice: 165 },
    ],
    totalAmount: 180,
    deliveryFee: 15,
    deliveryCommission: 15,
    fulfillment: FulfillmentType.Delivery,
    deliveryNote: '4F Design Pod · Desk 12',
    paymentMethod: PaymentMethod.Debt,
    status: 'Completed',
    deliveryStatus: 'Delivered',
    assignedRunnerId: 'u-jun',
    assignedRunner: 'Kuya Jun Reyes',
    createdAt: '2026-11-14 12:15 PM',
    orderDateIso: '2026-11-14',
    deliveredAt: '2026-11-14 12:28 PM',
    dueDateLabel: 'Nov 15',
    source: 'store',
    logs: [
      { id: 'lg-5', timestamp: '2026-11-14 12:15 PM', event: 'Order placed via Store Credit (Debt)', actor: 'Clarisse Mendoza' },
      { id: 'lg-6', timestamp: '2026-11-14 12:20 PM', event: 'Out for Delivery to 4F Design Pod', actor: 'Kuya Jun Reyes' },
      { id: 'lg-7', timestamp: '2026-11-14 12:28 PM', event: 'Delivered to coworker (₱15 commission recorded)', actor: 'Kuya Jun Reyes' },
    ],
  },
  {
    id: 'ORD-2388',
    userId: 'u-marco',
    userName: 'Marco Villanueva',
    items: [
      { itemId: 'item-1', name: 'Iced Spanish Latte (250ml)', quantity: 2, unitPrice: 95 },
    ],
    totalAmount: 205,
    deliveryFee: 15,
    deliveryCommission: 15,
    fulfillment: FulfillmentType.Delivery,
    deliveryNote: '5F QA Lab · Bench 3',
    paymentMethod: PaymentMethod.Cash,
    status: 'Completed',
    deliveryStatus: 'Delivered',
    assignedRunnerId: 'u-jun',
    assignedRunner: 'Kuya Jun Reyes',
    cashCollected: true,
    createdAt: '2026-11-12 03:10 PM',
    orderDateIso: '2026-11-12',
    deliveredAt: '2026-11-12 03:22 PM',
    source: 'store',
    logs: [
      { id: 'lg-8', timestamp: '2026-11-12 03:10 PM', event: 'Order placed (Cash on Delivery)', actor: 'Marco Villanueva' },
      { id: 'lg-9', timestamp: '2026-11-12 03:22 PM', event: 'Delivered & ₱205 Cash Collected (incl. ₱15 runner fee)', actor: 'Kuya Jun Reyes' },
    ],
  },
  {
    id: 'ORD-2402',
    userId: 'u-marco',
    userName: 'Marco Villanueva',
    items: [
      { itemId: 'item-5', name: 'Teriyaki Chicken Bento Box', quantity: 2, unitPrice: 165 },
    ],
    totalAmount: 330,
    deliveryFee: 0,
    deliveryCommission: 0,
    fulfillment: FulfillmentType.Pickup,
    paymentMethod: PaymentMethod.GCash,
    status: 'Pending Payment Proof',
    deliveryStatus: 'Pending Dispatch',
    createdAt: '2026-11-19 12:04 PM',
    orderDateIso: '2026-11-19',
    source: 'store',
    logs: [
      { id: 'lg-10', timestamp: '2026-11-19 12:04 PM', event: 'Pickup order placed with GCash proof submitted', actor: 'Marco Villanueva' },
    ],
  },
  {
    id: 'ORD-2403',
    userId: 'u-benedict',
    userName: 'Benedict Lu',
    items: [
      { itemId: 'item-1', name: 'Iced Spanish Latte (250ml)', quantity: 1, unitPrice: 95 },
      { itemId: 'item-4', name: 'Savory Herb & Cheese Crackers', quantity: 1, unitPrice: 60 },
    ],
    totalAmount: 155,
    deliveryFee: 0,
    deliveryCommission: 0,
    fulfillment: FulfillmentType.Pickup,
    paymentMethod: PaymentMethod.Cash,
    status: 'Completed',
    deliveryStatus: 'Delivered',
    assignedRunner: 'Counter B Pickup',
    cashCollected: true,
    createdAt: '2026-11-19 09:20 AM',
    orderDateIso: '2026-11-19',
    deliveredAt: '2026-11-19 09:25 AM',
    source: 'store',
    logs: [
      { id: 'lg-11', timestamp: '2026-11-19 09:20 AM', event: 'Counter pickup order placed (Cash)', actor: 'Benedict Lu' },
      { id: 'lg-12', timestamp: '2026-11-19 09:25 AM', event: 'Picked up & Cash collected at Counter B', actor: 'Benedict Lu' },
    ],
  },
];

export const INITIAL_PAYMENT_PROOFS: PaymentProof[] = [
  {
    id: 'PRF-881',
    userId: 'u-clarisse',
    userName: 'Clarisse Mendoza',
    amount: 450,
    channel: 'GCash',
    referenceNo: 'GC-904821735',
    purpose: 'Store Debt Settlement',
    imageDataUrl: SAMPLE_RECEIPT_DATA_URL,
    submittedAt: '2026-11-19 02:16 PM',
    status: 'pending',
  },
  {
    id: 'PRF-882',
    userId: 'u-marco',
    userName: 'Marco Villanueva',
    amount: 330,
    channel: 'Maya',
    referenceNo: 'MY-771204981',
    purpose: 'Order Payment',
    imageDataUrl: SAMPLE_RECEIPT_DATA_URL,
    submittedAt: '2026-11-19 12:08 PM',
    status: 'pending',
    orderId: 'ORD-2402',
  },
];

export const INITIAL_SUGGESTIONS: SuggestionItem[] = [
  {
    id: 'sug-1',
    title: 'Bottled Matcha Oat Latte (Zero Sugar)',
    category: 'Coffee & Drinks',
    reason: 'Great afternoon pick-me-up without the dairy crash.',
    requestedById: 'u-clarisse',
    requestedByName: 'Clarisse Mendoza',
    createdAt: 'Nov 16',
    voterIds: ['u-clarisse', 'u-marco', 'u-bea', 'u-benedict'],
    voterNames: ['Clarisse Mendoza', 'Marco Villanueva', 'Bea Santos', 'Benedict Lu'],
    status: 'Reviewing',
  },
  {
    id: 'sug-2',
    title: 'Spicy Tuna Sisig Microwaveable Bowl',
    category: 'Meals & Pantry',
    reason: 'Quick 3-minute ulam for late sprint evenings.',
    requestedById: 'u-marco',
    requestedByName: 'Marco Villanueva',
    createdAt: 'Nov 17',
    voterIds: ['u-marco', 'u-benedict', 'u-director'],
    voterNames: ['Marco Villanueva', 'Benedict Lu', 'Direk Rafa Tolentino'],
    status: 'Open for Votes',
  },
  {
    id: 'sug-3',
    title: 'Pocari Sweat Ion Supply (500ml)',
    category: 'Coffee & Drinks',
    reason: 'Helpful hydration after lunchtime jogs or rainy commutes.',
    requestedById: 'u-bea',
    requestedByName: 'Bea Santos',
    createdAt: 'Nov 18',
    voterIds: ['u-bea', 'u-clarisse'],
    voterNames: ['Bea Santos', 'Clarisse Mendoza'],
    status: 'Added to Pantry',
  },
];

export const INITIAL_MARKETPLACE_LISTINGS: MarketplaceListing[] = [
  {
    id: 'mkt-1',
    sellerId: 'u-marco',
    sellerName: 'Marco Villanueva',
    sellerDepartment: 'Quality Engineering',
    title: 'Homemade Roasted Manok (Whole)',
    description: 'Slow-roasted lemongrass & calamansi chicken, ready for 5 PM desk pickup.',
    price: 340,
    stock: 4,
    soldCount: 11,
    commissionType: CommissionType.Percentage,
    commissionValue: 10,
    approvalStatus: 'approved',
    createdAt: 'Today · 8:30 AM',
    image: '/src/assets/images/market_roasted_manok_1795142298869.jpg',
  },
  {
    id: 'mkt-2',
    sellerId: 'u-clarisse',
    sellerName: 'Clarisse Mendoza',
    sellerDepartment: 'Product Design',
    title: 'Suman sa Lihiya w/ Latik (Pack of 4)',
    description: 'Freshly steamed Batangas-style suman wrapped in banana leaves with toasted latik.',
    price: 120,
    stock: 7,
    soldCount: 19,
    commissionType: CommissionType.Fixed,
    commissionValue: 15,
    approvalStatus: 'approved',
    createdAt: 'Yesterday · 4:10 PM',
    image: '/src/assets/images/market_suman_kakanin_1795142298612.jpg',
  },
  {
    id: 'mkt-3',
    sellerId: 'u-bea',
    sellerName: 'Bea Santos',
    sellerDepartment: 'People Operations',
    title: 'Ube Cheese Pandesal (Box of 6)',
    description: 'Warm morning bake with creamy queso filling.',
    price: 160,
    stock: 5,
    soldCount: 8,
    commissionType: CommissionType.Percentage,
    commissionValue: 12,
    approvalStatus: 'approved',
    createdAt: 'Nov 17 · 7:45 AM',
    image: '/src/assets/images/item_pantry_snacks_1795142298218.jpg',
  },
  {
    id: 'mkt-4',
    sellerId: 'u-marco',
    sellerName: 'Marco Villanueva',
    sellerDepartment: 'Quality Engineering',
    title: 'Creamy Buko Pandan Salad (500ml Tub)',
    description: 'Chilled coconut pandan dessert tub for Friday merienda.',
    price: 185,
    stock: 6,
    soldCount: 0,
    commissionType: CommissionType.Fixed,
    commissionValue: 20,
    approvalStatus: 'pending',
    createdAt: 'Pending Review · 1:50 PM',
    image: '/src/assets/images/item_pantry_snacks_1795142298218.jpg',
  },
];

export const INITIAL_PAUTANGAN_SETTINGS: PautanganSettings = {
  globalEnabled: true,
  monthlyInterestRate: 3,
  dueDays: [15, 30],
  availableTerms: [1, 2, 3, 6],
};

export const INITIAL_LOANS: LoanRecord[] = [
  {
    id: 'LN-501',
    userId: 'u-clarisse',
    userName: 'Clarisse Mendoza',
    principal: 2000,
    interestRate: 3,
    months: 2,
    totalPayable: 2120,
    remainingBalance: 1060,
    status: 'Active',
    createdAt: '2026-10-30',
    nextDueDate: '2026-11-30',
    repayments: [
      {
        id: 'rep-1',
        date: '2026-11-15',
        amount: 1060,
        method: 'GCash',
        note: '1st installment (15th cutoff)',
      },
    ],
    installments: [
      {
        id: 'LN-501-inst-1',
        termNumber: 1,
        totalTerms: 2,
        dueDate: '2026-11-15',
        amount: 1060,
        status: 'Paid',
        paidAt: '2026-11-15',
        method: 'GCash',
      },
      {
        id: 'LN-501-inst-2',
        termNumber: 2,
        totalTerms: 2,
        dueDate: '2026-11-30',
        amount: 1060,
        status: 'Upcoming',
      },
    ],
  },
  {
    id: 'LN-502',
    userId: 'u-marco',
    userName: 'Marco Villanueva',
    principal: 3000,
    interestRate: 3,
    months: 1,
    totalPayable: 3090,
    remainingBalance: 3090,
    status: 'Active',
    createdAt: '2026-11-15',
    nextDueDate: '2026-11-30',
    repayments: [],
    installments: [
      {
        id: 'LN-502-inst-1',
        termNumber: 1,
        totalTerms: 1,
        dueDate: '2026-11-30',
        amount: 3090,
        status: 'Upcoming',
      },
    ],
  },
  {
    id: 'LN-489',
    userId: 'u-benedict',
    userName: 'Benedict Lu',
    principal: 1500,
    interestRate: 3,
    months: 1,
    totalPayable: 1545,
    remainingBalance: 0,
    status: 'Settled',
    createdAt: '2026-10-15',
    nextDueDate: '2026-10-30',
    repayments: [
      {
        id: 'rep-2',
        date: '2026-10-30',
        amount: 1545,
        method: 'MariBank',
        note: 'Full settlement on 30th',
      },
    ],
    installments: [
      {
        id: 'LN-489-inst-1',
        termNumber: 1,
        totalTerms: 1,
        dueDate: '2026-10-30',
        amount: 1545,
        status: 'Paid',
        paidAt: '2026-10-30',
        method: 'MariBank',
      },
    ],
  },
];

export const INITIAL_CHAT_THREADS: ChatThread[] = [
  {
    id: 'thread-pantry',
    title: '#department-pantry',
    subtitle: 'All Coworkers · Restock & Merienda Alerts',
    type: 'channel',
    participantIds: ['u-clarisse', 'u-marco', 'u-bea', 'u-jun', 'u-benedict'],
    unreadCount: 2,
    messages: [
      {
        id: 'm-ch-1',
        senderId: 'u-marco',
        senderName: 'Marco Villanueva',
        senderRole: UserRole.Member,
        text: 'Bringing 4 whole roasted manok by 4:45 PM! Already listed on the For-Sale feed.',
        timestamp: '11:20 AM',
      },
      {
        id: 'm-ch-2',
        senderId: 'u-clarisse',
        senderName: 'Clarisse Mendoza',
        senderRole: UserRole.Member,
        text: 'Fresh batch of Suman sa Lihiya is at Pantry Counter B too. Grab yours before 3 PM!',
        timestamp: '1:45 PM',
      },
    ],
  },
  {
    id: 'thread-dm-clarisse',
    title: 'Clarisse Mendoza',
    subtitle: 'Product Design · Direct Message',
    type: 'dm',
    participantIds: ['u-clarisse', 'u-benedict'],
    unreadCount: 1,
    messages: [
      {
        id: 'm-dm-1',
        senderId: 'u-clarisse',
        senderName: 'Clarisse Mendoza',
        senderRole: UserRole.Member,
        text: 'Hi Benedict! Uploaded my ₱450 GCash proof for the Nov 15 pantry balance. Let me know once confirmed.',
        timestamp: '2:17 PM',
      },
    ],
  },
  {
    id: 'thread-dm-marco-bea',
    title: 'Marco Villanueva & Bea Santos',
    subtitle: 'Coworker Direct Thread',
    type: 'dm',
    participantIds: ['u-marco', 'u-bea'],
    unreadCount: 0,
    messages: [
      {
        id: 'm-dm-2',
        senderId: 'u-bea',
        senderName: 'Bea Santos',
        senderRole: UserRole.Member,
        text: 'Marco, reserve one whole manok for People Ops team dinner later!',
        timestamp: '12:40 PM',
      },
      {
        id: 'm-dm-3',
        senderId: 'u-marco',
        senderName: 'Marco Villanueva',
        senderRole: UserRole.Member,
        text: 'Got it Bea! You can check out via Debt or Cash on the For-Sale tab.',
        timestamp: '12:43 PM',
      },
    ],
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Upcoming Cutoff Reminder · Nov 30',
    body: 'Settle store credit balances before the 30th cutoff via Cash or GCash/Maya/MariBank proof upload.',
    timestamp: '1h ago',
    type: 'reminder',
    read: false,
    targetUserId: 'all',
  },
  {
    id: 'notif-2',
    title: '2 Payment Proofs Awaiting Admin Review',
    body: 'Clarisse Mendoza (₱450 GCash) and Marco Villanueva (₱330 Maya) submitted receipts.',
    timestamp: '25m ago',
    type: 'payment',
    read: false,
    targetUserId: 'admins',
  },
  {
    id: 'notif-4',
    title: 'Delivery Queue: 2 Active Drops',
    body: 'ORD-2401 (4F Design Pod) pending dispatch and ORD-2404 (3F People Ops) out for delivery.',
    timestamp: '12m ago',
    type: 'delivery',
    read: false,
    targetUserId: 'delivery',
  },
  {
    id: 'notif-3',
    title: 'For-Sale Listing Pending Super Admin Approval',
    body: 'Marco Villanueva submitted "Creamy Buko Pandan Salad" for approval.',
    timestamp: '8m ago',
    type: 'marketplace',
    read: false,
    targetUserId: 'super_admin',
  },
];

export const INITIAL_OTHER_APPS: InternalApp[] = [
  {
    id: 'app-leavesync',
    name: 'LeaveSync PH',
    tagline: 'PTO, Sick Leave & Holiday Tracker',
    description:
      'File vacation credits, view team out-of-office calendars, and sync Philippine regular holidays automatically.',
    platform: 'Web & Android PWA',
    version: '1.4',
    actionType: 'open',
    installed: true,
    image: '/src/assets/images/app_internal_hub_1795142298442.jpg',
    url: '#leavesync-preview',
  },
  {
    id: 'app-shuttlepass',
    name: 'ShuttlePass BGC',
    tagline: 'Department Carpool & Shuttle Seat Booking',
    description:
      'Reserve morning and evening office shuttle seats across Quezon City, Makati, and BGC drop-off points.',
    platform: 'Android & iOS PWA',
    version: '2.1',
    actionType: 'install',
    installed: false,
    image: '/src/assets/images/app_internal_hub_1795142298442.jpg',
    url: '#shuttlepass-preview',
  },
  {
    id: 'app-roomdesk',
    name: 'RoomReserve Desk',
    tagline: 'Meeting Pods & Hot-Desk Check-In',
    description:
      'Book huddle rooms on 3F and 4F with instant QR door check-in and automatic 10-minute no-show release.',
    platform: 'Web App',
    version: '1.2',
    actionType: 'open',
    installed: false,
    image: '/src/assets/images/app_internal_hub_1795142298442.jpg',
    url: '#roomreserve-preview',
  },
];

export const OWNER_BASE_COMMISSION_EARNED = 582;

export const INITIAL_EWALLET_POSTS: EWalletPost[] = [
  {
    id: 'ew-101',
    type: 'sell',
    walletProvider: 'GCash',
    totalAmount: 5000,
    remainingAmount: 3500,
    accountNumber: '09134567890',
    accountName: 'Juan Dela Cruz',
    notes: 'Selling GCash balance for cash on hand. Partial amounts welcome (min ₱500). Desk 4F or Pantry Counter B.',
    authorId: 'u-marco',
    authorName: 'Juan Dela Cruz',
    authorDepartment: 'Quality Engineering',
    createdAt: 'Today · 10:15 AM',
    status: 'Partially Filled',
    fills: [
      {
        id: 'ewf-1',
        userId: 'u-clarisse',
        userName: 'Clarisse Mendoza',
        userDepartment: 'Product Design',
        amount: 1500,
        createdAt: 'Today · 10:42 AM',
        note: 'Paid ₱1,500 cash at 4F Design Pod',
      },
    ],
    comments: [
      {
        id: 'ewc-1',
        userId: 'u-clarisse',
        userName: 'Clarisse Mendoza',
        userDepartment: 'Product Design',
        text: 'Took ₱1,500 share! Handed cash at your desk, thanks Juan!',
        createdAt: 'Today · 10:43 AM',
      },
      {
        id: 'ewc-2',
        userId: 'u-bea',
        userName: 'Bea Santos',
        userDepartment: 'People Operations',
        text: 'Is ₱1,000 still available? I have exact ₱1,000 bill on 3F.',
        createdAt: 'Today · 11:05 AM',
      },
    ],
  },
  {
    id: 'ew-102',
    type: 'buy',
    walletProvider: 'Maya',
    totalAmount: 2000,
    remainingAmount: 2000,
    accountNumber: '0918-882-3310',
    accountName: 'Bea Santos',
    notes: 'Need ₱2,000 Maya balance for bills. Paying cash immediately at People Ops Room B or Pantry Counter.',
    authorId: 'u-bea',
    authorName: 'Bea Santos',
    authorDepartment: 'People Operations',
    createdAt: 'Today · 09:50 AM',
    status: 'Open',
    fills: [],
    comments: [
      {
        id: 'ewc-3',
        userId: 'u-benedict',
        userName: 'Benedict Lu',
        userDepartment: 'Engineering Ops',
        text: 'Can cover ₱1,000 Maya later after lunch if still open!',
        createdAt: 'Today · 10:12 AM',
      },
    ],
  },
  {
    id: 'ew-103',
    type: 'sell',
    walletProvider: 'MariBank',
    totalAmount: 1500,
    remainingAmount: 0,
    accountNumber: '1049-8821-7704',
    accountName: 'Clarisse Mendoza',
    notes: 'Swapping ₱1,500 MariBank to cash for shuttle & lunch week.',
    authorId: 'u-clarisse',
    authorName: 'Clarisse Mendoza',
    authorDepartment: 'Product Design',
    createdAt: 'Yesterday · 03:20 PM',
    status: 'Completed',
    fills: [
      {
        id: 'ewf-2',
        userId: 'u-benedict',
        userName: 'Benedict Lu',
        userDepartment: 'Engineering Ops',
        amount: 1000,
        createdAt: 'Yesterday · 03:45 PM',
      },
      {
        id: 'ewf-3',
        userId: 'u-jun',
        userName: 'Kuya Jun Reyes',
        userDepartment: 'Pantry Delivery & Logistics',
        amount: 500,
        createdAt: 'Yesterday · 04:10 PM',
      },
    ],
    comments: [
      {
        id: 'ewc-4',
        userId: 'u-jun',
        userName: 'Kuya Jun Reyes',
        userDepartment: 'Pantry Delivery & Logistics',
        text: 'Completed the last ₱500 share. Salamat po!',
        createdAt: 'Yesterday · 04:12 PM',
      },
    ],
  },
];

