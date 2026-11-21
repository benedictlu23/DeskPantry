export enum UserRole {
  Guest = 'guest',
  Member = 'member',
  DeliveryStaff = 'delivery_staff',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

export enum PaymentMethod {
  Cash = 'Cash',
  Debt = 'Store Credit (Debt)',
  GCash = 'GCash',
  Maya = 'Maya',
  MariBank = 'MariBank',
}

export enum FulfillmentType {
  Pickup = 'Pickup',
  Delivery = 'Delivery',
}

export enum CommissionType {
  Percentage = 'percentage',
  Fixed = 'fixed',
}

export type ActiveSection =
  | 'store'
  | 'ewallet'
  | 'community'
  | 'pautangan'
  | 'ledger'
  | 'delivery'
  | 'chat'
  | 'admin'
  | 'apps';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  debtBalance: number;
  pautanganEnabled: boolean;
  pautanganLimit: number;
  avatarInitials: string;
  avatarUrl?: string;
  totalSpent: number;
}

export interface ItemCostEntry {
  id: string;
  date: string;
  costPrice: number;
  sellingPrice: number;
  note: string;
  updatedBy: string;
}

export interface StoreItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  costPrice: number;
  costHistory: ItemCostEntry[];
  stock: number;
  soldCount: number;
  image?: string;
  barcode?: string;
}

export type StockAdjustmentType = 'add' | 'deduct' | 'recount' | 'restock';

export interface StockAdjustmentLog {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  barcode?: string;
  adjustmentType: StockAdjustmentType;
  reason: string;
  note?: string;
  previousStock: number;
  delta: number;
  newStock: number;
  unitCostAtTime: number;
  adjustedById: string;
  adjustedByName: string;
  createdAt: string;
  createdAtMs: number;
}

export interface CartItem {
  itemId: string;
  quantity: number;
}

export interface OrderLogEntry {
  id: string;
  timestamp: string;
  event: string;
  actor: string;
}

export interface StoreOrder {
  id: string;
  userId: string;
  userName: string;
  items: { itemId: string; name: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  deliveryFee?: number;
  deliveryCommission?: number;
  fulfillment: FulfillmentType;
  deliveryNote?: string;
  paymentMethod: string;
  status: 'Confirmed' | 'Pending Payment Proof' | 'Completed';
  deliveryStatus?: 'Pending Dispatch' | 'Out for Delivery' | 'Delivered';
  assignedRunnerId?: string;
  assignedRunner?: string;
  cashCollected?: boolean;
  createdAt: string;
  orderDateIso: string;
  deliveredAt?: string;
  dueDateLabel?: string;
  source: 'store' | 'marketplace';
  commissionEarned?: number;
  logs: OrderLogEntry[];
}

export interface PaymentMethodConfig {
  id: string;
  title: string;
  type: 'cash' | 'debt' | 'digital';
  enabled: boolean;
  iconImage?: string;
  accountNumber?: string;
  accountName?: string;
  qrCodeImage?: string;
  instructions?: string;
}

export interface StoreConfig {
  storeAnnouncement: string;
  deliveryEnabled: boolean;
  deliveryFee: number;
  walletAccountName: string;
  walletAccountNumber: string;
  categories: string[];
  paymentMethods: PaymentMethodConfig[];
}

export interface PaymentProof {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  channel: string;
  referenceNo: string;
  purpose: 'Store Debt Settlement' | 'Order Payment' | 'Pautangan Repayment';
  imageDataUrl: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  orderId?: string;
  loanId?: string;
}

export interface SuggestionItem {
  id: string;
  title: string;
  category: string;
  reason: string;
  requestedById: string;
  requestedByName: string;
  createdAt: string;
  voterIds: string[];
  voterNames: string[];
  status: 'Open for Votes' | 'Reviewing' | 'Added to Pantry';
}

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerDepartment: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  soldCount: number;
  commissionType: CommissionType;
  commissionValue: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  image?: string;
}

export interface PautanganSettings {
  globalEnabled: boolean;
  monthlyInterestRate: number;
  dueDays: [number, number];
  availableTerms: number[];
}

export interface LoanRepayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
}

export interface LoanInstallment {
  id: string;
  termNumber: number;
  totalTerms: number;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Pending Verification' | 'Upcoming';
  paidAt?: string;
  method?: string;
}

export interface LoanRecord {
  id: string;
  userId: string;
  userName: string;
  principal: number;
  interestRate: number;
  months: number;
  totalPayable: number;
  remainingBalance: number;
  status: 'Active' | 'Settled' | 'Pending Approval';
  createdAt: string;
  nextDueDate: string;
  repayments: LoanRepayment[];
  installments: LoanInstallment[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole | 'ai';
  text: string;
  timestamp: string;
}

export interface ChatThread {
  id: string;
  title: string;
  subtitle: string;
  type: 'ai' | 'channel' | 'dm';
  participantIds: string[];
  unreadCount: number;
  messages: ChatMessage[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'reminder' | 'payment' | 'marketplace' | 'chat' | 'delivery' | 'community' | 'ewallet';
  read: boolean;
  targetUserId?: string;
}

export interface InternalApp {
  id: string;
  name: string;
  tagline: string;
  description: string;
  platform: string;
  version: string;
  actionType: 'open' | 'install';
  installed: boolean;
  image: string;
  url: string;
}

export interface EWalletComment {
  id: string;
  userId: string;
  userName: string;
  userDepartment: string;
  text: string;
  createdAt: string;
}

export interface EWalletFill {
  id: string;
  userId: string;
  userName: string;
  userDepartment: string;
  amount: number;
  createdAt: string;
  note?: string;
}

export interface EWalletPost {
  id: string;
  type: 'sell' | 'buy';
  walletProvider: string;
  totalAmount: number;
  remainingAmount: number;
  accountNumber: string;
  accountName: string;
  notes?: string;
  authorId: string;
  authorName: string;
  authorDepartment: string;
  createdAt: string;
  status: 'Open' | 'Partially Filled' | 'Completed';
  fills: EWalletFill[];
  comments: EWalletComment[];
}

