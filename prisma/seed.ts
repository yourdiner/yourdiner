import {
  PrismaClient,
  SubscriptionStatus,
  StaffRole,
  TableStatus,
  OrderStatus,
  ReservationStatus,
  DiningSessionStatus,
  OrderItemKitchenStatus,
  BillingCycle,
} from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { DEV_SEED_PASSWORD } from "../src/lib/dev-auth";
import { toTenantHostKey } from "../src/lib/tenancy-keys";
import { createPlanVersion } from "../src/modules/subscription-engine";

const prisma = new PrismaClient();

const FEATURES = [
  { code: "qr_menu", name: "QR Menu", category: "core", sortOrder: 1 },
  { code: "staff_accounts", name: "Staff Accounts", category: "operations", sortOrder: 2 },
  { code: "waiter_ordering", name: "Waiter Ordering", category: "operations", sortOrder: 3 },
  { code: "customer_qr_ordering", name: "Customer QR Ordering", category: "ordering", sortOrder: 4 },
  { code: "reservations", name: "Reservations", category: "operations", sortOrder: 5 },
  { code: "kitchen_dashboard", name: "Kitchen Dashboard", category: "operations", sortOrder: 6 },
  { code: "fulfillment_orders", name: "Takeaway & Delivery", category: "operations", sortOrder: 7 },
  { code: "customer_database", name: "Customer Database", category: "crm", sortOrder: 8 },
  { code: "membership", name: "Membership", category: "marketing", sortOrder: 9 },
  { code: "coupons", name: "Coupons", category: "marketing", sortOrder: 10 },
  { code: "analytics", name: "Analytics", category: "insights", sortOrder: 11 },
  { code: "feedback", name: "Feedback", category: "insights", sortOrder: 12 },
  { code: "multi_branch", name: "Multi Branch", category: "enterprise", sortOrder: 13 },
  { code: "api_access", name: "API Access", category: "enterprise", sortOrder: 14 },
];

const ADMIN_BASE_FEATURES = [
  "qr_menu",
  "reservations",
  "kitchen_dashboard",
  "staff_accounts",
  "customer_database",
  "membership",
  "coupons",
  "analytics",
];

const PLAN_DEFINITIONS = [
  {
    name: "Starter",
    slug: "starter",
    oldSlug: "qr_menu",
    description: "Full admin access; public menu browse only (no waiter or customer ordering)",
    displayOrder: 1,
    priceMonthly: 49900,
    priceYearly: 499000,
    features: [...ADMIN_BASE_FEATURES],
  },
  {
    name: "Professional",
    slug: "professional",
    oldSlug: "cafe_staff",
    description: "Full admin access plus waiter POS and customer table ordering",
    displayOrder: 2,
    priceMonthly: 149900,
    priceYearly: 1499000,
    features: [...ADMIN_BASE_FEATURES, "waiter_ordering", "customer_qr_ordering", "fulfillment_orders"],
  },
  {
    name: "Premium",
    slug: "premium",
    oldSlug: "customer_ordering",
    description: "Everything including customer QR self-ordering",
    displayOrder: 3,
    priceMonthly: 299900,
    priceYearly: 2999000,
    features: [...ADMIN_BASE_FEATURES, "waiter_ordering", "customer_qr_ordering", "fulfillment_orders"],
  },
];

async function upsertUserWithPassword(
  id: string,
  accountId: string,
  email: string,
  name: string,
  password: string,
  platformRole?: "SUPER_ADMIN"
) {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, ...(platformRole ? { platformRole } : {}) },
    create: {
      name,
      email,
      emailVerified: true,
      ...(platformRole ? { platformRole } : {}),
    },
  });

  await prisma.account.upsert({
    where: { id: accountId },
    update: { password: passwordHash, userId: user.id },
    create: {
      id: accountId,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    },
  });

  return user;
}

async function seedFeatures() {
  for (const feature of FEATURES) {
    await prisma.feature.upsert({
      where: { code: feature.code },
      update: { name: feature.name, category: feature.category, sortOrder: feature.sortOrder },
      create: feature,
    });
  }
}

async function seedPlans() {
  for (const def of PLAN_DEFINITIONS) {
    const existingOld = await prisma.plan.findUnique({ where: { slug: def.oldSlug } });
    const existingNew = await prisma.plan.findUnique({ where: { slug: def.slug } });

    let planId: string;

    if (existingNew) {
      planId = existingNew.id;
      await prisma.plan.update({
        where: { id: planId },
        data: {
          name: def.name,
          description: def.description,
          displayOrder: def.displayOrder,
          sortOrder: def.displayOrder,
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          features: def.features,
          isActive: true,
          status: "ACTIVE",
          isVisible: true,
        },
      });
    } else if (existingOld) {
      planId = existingOld.id;
      await prisma.plan.update({
        where: { id: planId },
        data: {
          name: def.name,
          slug: def.slug,
          description: def.description,
          displayOrder: def.displayOrder,
          sortOrder: def.displayOrder,
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          features: def.features,
          isActive: true,
          status: "ACTIVE",
          isVisible: true,
        },
      });
    } else {
      const plan = await prisma.plan.create({
        data: {
          name: def.name,
          slug: def.slug,
          description: def.description,
          displayOrder: def.displayOrder,
          sortOrder: def.displayOrder,
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          features: def.features,
          isActive: true,
          status: "ACTIVE",
          isVisible: true,
        },
      });
      planId = plan.id;
    }

    const versionCount = await prisma.planVersion.count({ where: { planId } });
    if (versionCount === 0) {
      await createPlanVersion({
        planId,
        featureCodes: def.features,
        trialDays: 14,
        graceDays: 7,
        billingPeriodDefault: BillingCycle.MONTHLY,
        notes: "Initial version",
        pricing: {
          currency: "INR",
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
        },
      });
    } else {
      await syncLatestPlanFeatures(planId, def.features);
    }
  }
}

async function syncLatestPlanFeatures(planId: string, featureCodes: string[]) {
  const latest = await prisma.planVersion.findFirst({
    where: { planId, isLatest: true },
  });
  if (!latest) return;

  const allFeatures = await prisma.feature.findMany({ where: { isActive: true } });
  const enabledIds = new Set(
    allFeatures.filter((f) => featureCodes.includes(f.code)).map((f) => f.id)
  );

  for (const feature of allFeatures) {
    await prisma.planFeature.upsert({
      where: {
        planVersionId_featureId: {
          planVersionId: latest.id,
          featureId: feature.id,
        },
      },
      update: { enabled: enabledIds.has(feature.id) },
      create: {
        planVersionId: latest.id,
        featureId: feature.id,
        enabled: enabledIds.has(feature.id),
      },
    });
  }
}

async function backfillSubscriptionVersions() {
  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true },
  });

  for (const sub of subscriptions) {
    const latestVersion = await prisma.planVersion.findFirst({
      where: { planId: sub.planId, isLatest: true },
      include: { pricing: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
    });

    if (!latestVersion) continue;

    const pricing = latestVersion.pricing[0];
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planVersionId: sub.planVersionId ?? latestVersion.id,
        pricePaid: sub.pricePaid || pricing?.priceMonthly || 0,
        billingCycle: sub.billingCycle ?? BillingCycle.MONTHLY,
        renewalDate: sub.renewalDate ?? sub.currentPeriodEnd,
      },
    });
  }
}

async function main() {
  console.log("Seeding database...");

  await seedFeatures();
  await seedPlans();
  await backfillSubscriptionVersions();

  const premiumPlan = await prisma.plan.findUnique({ where: { slug: "premium" } });
  if (!premiumPlan) throw new Error("Premium plan not found");

  const existingSettings = await prisma.platformSettings.findFirst();
  if (!existingSettings) {
    await prisma.platformSettings.create({
      data: {
        brandName: "Restaurant OS",
        globalTaxRate: 5,
        defaultTrialDays: 7,
        globalGracePeriodDays: 7,
      },
    });
  }

  // ─── Super Admin ─────────────────────────────────────────────────────────
  await upsertUserWithPassword(
    "super-admin",
    "admin-account",
    "admin@restaurant-os.com",
    "Super Admin",
    DEV_SEED_PASSWORD,
    "SUPER_ADMIN"
  );

  // ─── Demo Restaurant ─────────────────────────────────────────────────────
  let demoRestaurant = await prisma.restaurant.findFirst({
    where: { slug: "demo-cafe" },
  });

  if (!demoRestaurant) {
    demoRestaurant = await prisma.restaurant.create({
      data: {
        name: "Demo Cafe",
        slug: "demo-cafe",
        subdomain: "pending-demo",
        status: "ACTIVE",
      },
    });
  }

  const tenantKey = toTenantHostKey(demoRestaurant.uuid);
  demoRestaurant = await prisma.restaurant.update({
    where: { id: demoRestaurant.id },
    data: { subdomain: tenantKey },
  });

  const premiumVersion = await prisma.planVersion.findFirst({
    where: { planId: premiumPlan.id, isLatest: true },
    include: { pricing: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
  });

  await prisma.subscription.upsert({
    where: { restaurantId: demoRestaurant.id },
    update: {
      planId: premiumPlan.id,
      planVersionId: premiumVersion?.id,
      status: SubscriptionStatus.ACTIVE,
      pricePaid: premiumVersion?.pricing[0]?.priceMonthly ?? 299900,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      restaurantId: demoRestaurant.id,
      planId: premiumPlan.id,
      planVersionId: premiumVersion?.id,
      status: SubscriptionStatus.ACTIVE,
      pricePaid: premiumVersion?.pricing[0]?.priceMonthly ?? 299900,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: demoRestaurant.id },
    update: {
      averageDiningMinutes: 90,
      reservationSettings: {
        enabled: true,
        averageDiningMinutes: 90,
        holdTimeMinutes: 30,
        cleaningBufferMinutes: 0,
        autoMarkNoShow: true,
        autoReleaseOnNoShow: true,
        allowWalkInOverride: true,
        reservationIntervalMinutes: 30,
      },
    },
    create: {
      restaurantId: demoRestaurant.id,
      averageDiningMinutes: 90,
      reservationSettings: {
        enabled: true,
        averageDiningMinutes: 90,
        holdTimeMinutes: 30,
        cleaningBufferMinutes: 0,
        autoMarkNoShow: true,
        autoReleaseOnNoShow: true,
        allowWalkInOverride: true,
        reservationIntervalMinutes: 30,
      },
    },
  });

  await prisma.restaurantBranding.upsert({
    where: { restaurantId: demoRestaurant.id },
    update: {},
    create: {
      restaurantId: demoRestaurant.id,
      about: "Welcome to Demo Cafe — a fully seeded restaurant for development.",
      address: "123 Main Street, Bandra",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400050",
      phone: "+91 9876543210",
      email: "hello@democafe.com",
      primaryColor: "#425646",
      secondaryColor: "#8d4c40",
      accentColor: "#d2e8d3",
      openingHours: [
        { day: "monday", open: "08:00", close: "22:00", closed: false },
        { day: "tuesday", open: "08:00", close: "22:00", closed: false },
        { day: "wednesday", open: "08:00", close: "22:00", closed: false },
        { day: "thursday", open: "08:00", close: "22:00", closed: false },
        { day: "friday", open: "08:00", close: "23:00", closed: false },
        { day: "saturday", open: "09:00", close: "23:00", closed: false },
        { day: "sunday", open: "09:00", close: "21:00", closed: false },
      ],
    },
  });

  // ─── Staff users ─────────────────────────────────────────────────────────
  const staffDefs: Array<{
    accountId: string;
    email: string;
    name: string;
    role: StaffRole;
    mobile?: string;
    password?: string;
    mustChangePassword?: boolean;
  }> = [
    { accountId: "owner-account", email: "owner@democafe.com", name: "Demo Owner", role: "OWNER" },
    { accountId: "manager-account", email: "manager@democafe.com", name: "Alex Manager", role: "MANAGER" },
    {
      accountId: "waiter1-account",
      email: "waiter1@democafe.com",
      name: "Ravi Kumar",
      role: "STAFF",
      mobile: "9876543210",
      password: "Staff@1234",
      mustChangePassword: true,
    },
    {
      accountId: "waiter2-account",
      email: "waiter2@democafe.com",
      name: "Priya Sharma",
      role: "STAFF",
      mobile: "9876543211",
      password: "Staff@1234",
      mustChangePassword: true,
    },
    {
      accountId: "kitchen-account",
      email: "kitchen@democafe.com",
      name: "Chef Marco",
      role: "KITCHEN",
      mobile: "9876543212",
      password: "Staff@1234",
      mustChangePassword: true,
    },
    {
      accountId: "cashier-account",
      email: "cashier@democafe.com",
      name: "Sneha Patel",
      role: "CASHIER",
      mobile: "9876543213",
      password: "Staff@1234",
      mustChangePassword: true,
    },
  ];

  for (const def of staffDefs) {
    const user = await upsertUserWithPassword(
      def.accountId,
      def.accountId,
      def.email,
      def.name,
      DEV_SEED_PASSWORD
    );

    const passwordHash = def.password ? await hashPassword(def.password) : null;

    await prisma.staff.upsert({
      where: {
        userId_restaurantId: { userId: user.id, restaurantId: demoRestaurant.id },
      },
      update: {
        role: def.role,
        displayName: def.name,
        mobile: def.mobile ?? null,
        ...(passwordHash
          ? { pinHash: passwordHash, mustChangePassword: def.mustChangePassword ?? false }
          : {}),
      },
      create: {
        userId: user.id,
        restaurantId: demoRestaurant.id,
        role: def.role,
        displayName: def.name,
        mobile: def.mobile ?? null,
        pinHash: passwordHash,
        mustChangePassword: def.mustChangePassword ?? false,
      },
    });
  }

  // ─── Tax ─────────────────────────────────────────────────────────────────
  const tax = await prisma.tax.upsert({
    where: { id: "demo-tax-gst" },
    update: {},
    create: {
      id: "demo-tax-gst",
      restaurantId: demoRestaurant.id,
      name: "GST 5%",
      rate: 5,
      isDefault: true,
    },
  });

  // ─── Categories & Products ─────────────────────────────────────────────────
  const beverages = await prisma.category.upsert({
    where: { id: "demo-cat-beverages" },
    update: {},
    create: {
      id: "demo-cat-beverages",
      restaurantId: demoRestaurant.id,
      name: "Beverages",
      description: "Hot and cold drinks",
      sortOrder: 1,
    },
  });

  const food = await prisma.category.upsert({
    where: { id: "demo-cat-food" },
    update: {},
    create: {
      id: "demo-cat-food",
      restaurantId: demoRestaurant.id,
      name: "Food",
      description: "Main courses and snacks",
      sortOrder: 2,
    },
  });

  const desserts = await prisma.category.upsert({
    where: { id: "demo-cat-desserts" },
    update: {},
    create: {
      id: "demo-cat-desserts",
      restaurantId: demoRestaurant.id,
      name: "Desserts",
      sortOrder: 3,
    },
  });

  const demoProducts = [
    { id: "demo-prod-cappuccino", categoryId: beverages.id, name: "Cappuccino", price: 18000, dietaryType: "VEG" as const, isFeatured: true, isBestSeller: true, sortOrder: 1 },
    { id: "demo-prod-latte", categoryId: beverages.id, name: "Latte", price: 20000, dietaryType: "VEG" as const, sortOrder: 2 },
    { id: "demo-prod-cold-brew", categoryId: beverages.id, name: "Cold Brew", price: 22000, dietaryType: "VEG" as const, sortOrder: 3 },
    { id: "demo-prod-sandwich", categoryId: food.id, name: "Grilled Sandwich", price: 25000, dietaryType: "VEG" as const, isChefSpecial: true, sortOrder: 1 },
    { id: "demo-prod-burger", categoryId: food.id, name: "Classic Burger", price: 35000, dietaryType: "NON_VEG" as const, spicyLevel: 1, sortOrder: 2 },
    { id: "demo-prod-pasta", categoryId: food.id, name: "Aglio Olio Pasta", price: 32000, dietaryType: "VEG" as const, sortOrder: 3 },
    { id: "demo-prod-brownie", categoryId: desserts.id, name: "Chocolate Brownie", price: 15000, dietaryType: "VEG" as const, sortOrder: 1 },
  ];

  for (const p of demoProducts) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { ...p, taxId: tax.id },
      create: { ...p, restaurantId: demoRestaurant.id, taxId: tax.id },
    });
  }

  // ─── Membership ────────────────────────────────────────────────────────────
  const membership = await prisma.membership.upsert({
    where: { id: "demo-membership-gold" },
    update: {},
    create: {
      id: "demo-membership-gold",
      restaurantId: demoRestaurant.id,
      name: "Gold Member",
      description: "10% off all orders",
      discountPercent: 10,
      pointsMultiplier: 1.5,
    },
  });

  // ─── Customers ───────────────────────────────────────────────────────────
  const customer1 = await prisma.customer.upsert({
    where: {
      restaurantId_phone: { restaurantId: demoRestaurant.id, phone: "+919876543210" },
    },
    update: {},
    create: {
      restaurantId: demoRestaurant.id,
      name: "Rahul Mehta",
      phone: "+919876543210",
      email: "rahul@example.com",
      totalSpend: 125000,
      visitCount: 12,
      isVip: true,
      membershipId: membership.id,
      loyaltyPoints: 450,
      tags: ["regular", "coffee-lover"],
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: {
      restaurantId_phone: { restaurantId: demoRestaurant.id, phone: "+919876543211" },
    },
    update: {},
    create: {
      restaurantId: demoRestaurant.id,
      name: "Anita Desai",
      phone: "+919876543211",
      email: "anita@example.com",
      totalSpend: 45000,
      visitCount: 5,
      loyaltyPoints: 120,
    },
  });

  // ─── Tables ────────────────────────────────────────────────────────────────
  const tableData = [
    { id: "demo-table-1", number: 1, name: "Table 1", capacity: 2, status: TableStatus.AVAILABLE },
    { id: "demo-table-2", number: 2, name: "Table 2", capacity: 4, status: TableStatus.OCCUPIED },
    { id: "demo-table-3", number: 3, name: "Table 3", capacity: 4, status: TableStatus.AVAILABLE },
    { id: "demo-table-4", number: 4, name: "Table 4", capacity: 6, status: TableStatus.RESERVED },
    { id: "demo-table-5", number: 5, name: "Table 5", capacity: 2, status: TableStatus.AVAILABLE },
  ];

  for (const t of tableData) {
    await prisma.table.upsert({
      where: { id: t.id },
      update: { status: t.status, qrSlug: `T${t.number}` },
      create: { ...t, qrSlug: `T${t.number}`, restaurantId: demoRestaurant.id },
    });
  }

  // ─── Reservations ──────────────────────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const holdExpiresAt = new Date(tomorrow.getTime() + 30 * 60 * 1000);
  const expectedEndAt = new Date(tomorrow.getTime() + 90 * 60 * 1000);

  await prisma.reservation.upsert({
    where: { id: "demo-reservation-1" },
    update: {
      holdExpiresAt,
      expectedEndAt,
      source: "ADMIN",
    },
    create: {
      id: "demo-reservation-1",
      restaurantId: demoRestaurant.id,
      tableId: "demo-table-4",
      customerId: customer1.id,
      guestName: "Rahul Mehta",
      guestPhone: "+919876543210",
      guestCount: 4,
      reservedAt: tomorrow,
      expectedEndAt,
      holdExpiresAt,
      status: ReservationStatus.CONFIRMED,
      source: "ADMIN",
      specialRequest: "Window seat preferred",
    },
  });

  // ─── Orders ────────────────────────────────────────────────────────────────
  const ownerStaff = await prisma.staff.findFirst({
    where: { restaurantId: demoRestaurant.id, role: "OWNER" },
  });

  await prisma.tableSession.upsert({
    where: { id: "demo-table-session-1" },
    update: {},
    create: {
      id: "demo-table-session-1",
      restaurantId: demoRestaurant.id,
      tableId: "demo-table-2",
      customerId: customer1.id,
      sessionToken: "demo-table-session-token-1",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  const order1 = await prisma.order.upsert({
    where: { id: "demo-order-1" },
    update: {},
    create: {
      id: "demo-order-1",
      restaurantId: demoRestaurant.id,
      orderNumber: 1001,
      tableId: "demo-table-2",
      customerId: customer1.id,
      staffId: ownerStaff?.id,
      tableSessionId: "demo-table-session-1",
      status: OrderStatus.PREPARING,
      customerName: "Rahul Mehta",
      subtotal: 53000,
      taxAmount: 2650,
      total: 55650,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "demo-order-item-1" },
    update: {},
    create: {
      id: "demo-order-item-1",
      orderId: order1.id,
      productId: "demo-prod-cappuccino",
      name: "Cappuccino",
      quantity: 2,
      unitPrice: 18000,
      totalPrice: 36000,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "demo-order-item-2" },
    update: {},
    create: {
      id: "demo-order-item-2",
      orderId: order1.id,
      productId: "demo-prod-sandwich",
      name: "Grilled Sandwich",
      quantity: 1,
      unitPrice: 25000,
      totalPrice: 25000,
    },
  });

  await prisma.kitchenOrder.upsert({
    where: { id: "demo-kitchen-1" },
    update: {},
    create: {
      id: "demo-kitchen-1",
      orderId: order1.id,
      status: "COOKING",
      priority: 1,
      startedAt: new Date(),
    },
  });

  // ─── Waiter POS: dining session on Table 3 ───────────────────────────────
  const waiterStaff = await prisma.staff.findFirst({
    where: { restaurantId: demoRestaurant.id, role: "STAFF" },
  });

  if (waiterStaff) {
    const diningSession = await prisma.diningSession.upsert({
      where: { id: "demo-dining-session-1" },
      update: {},
      create: {
        id: "demo-dining-session-1",
        restaurantId: demoRestaurant.id,
        tableId: "demo-table-3",
        staffId: waiterStaff.id,
        guestPhone: "+919876543211",
        customerId: customer2.id,
        guestCount: 2,
        status: DiningSessionStatus.ACTIVE,
      },
    });

    await prisma.table.update({
      where: { id: "demo-table-3" },
      data: { status: TableStatus.OCCUPIED },
    });

    const waiterOrder = await prisma.order.upsert({
      where: { id: "demo-waiter-order-1" },
      update: {},
      create: {
        id: "demo-waiter-order-1",
        restaurantId: demoRestaurant.id,
        orderNumber: 1002,
        tableId: "demo-table-3",
        customerId: customer2.id,
        staffId: waiterStaff.id,
        diningSessionId: diningSession.id,
        status: OrderStatus.PREPARING,
        customerName: "Anita Desai",
        subtotal: 40000,
        taxAmount: 2000,
        total: 42000,
      },
    });

    await prisma.orderItem.upsert({
      where: { id: "demo-waiter-item-1" },
      update: {},
      create: {
        id: "demo-waiter-item-1",
        orderId: waiterOrder.id,
        productId: "demo-prod-latte",
        name: "Latte",
        quantity: 2,
        unitPrice: 20000,
        totalPrice: 40000,
        kitchenStatus: OrderItemKitchenStatus.SENT,
        revisionNumber: 1,
      },
    });

    await prisma.orderRevision.upsert({
      where: { id: "demo-order-revision-1" },
      update: {},
      create: {
        id: "demo-order-revision-1",
        orderId: waiterOrder.id,
        revisionNumber: 1,
        submittedByStaffId: waiterStaff.id,
        notes: JSON.stringify({ items: [{ name: "Latte", quantity: 2 }] }),
      },
    });
  }

  // ─── Permissions ───────────────────────────────────────────────────────────
  const permissionModules = [
    { name: "menu.read", module: "menu", description: "View menu" },
    { name: "menu.write", module: "menu", description: "Edit menu" },
    { name: "orders.read", module: "orders", description: "View orders" },
    { name: "orders.write", module: "orders", description: "Manage orders" },
  ];

  for (const perm of permissionModules) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }

  console.log("\n✅ Seed completed!\n");
  console.log("── Dev Tools (floating wrench button) ──");
  console.log(`All staff passwords: ${DEV_SEED_PASSWORD}`);
  console.log(`Super Admin: admin@restaurant-os.com`);
  console.log(`\n── Tenant URLs (add to hosts file) ──`);
  console.log(`Restaurant host key: ${tenantKey}`);
  console.log(`Admin:    http://${tenantKey}.localhost:3000/admin`);
  console.log(`Staff:    http://${tenantKey}.localhost:3000/staff/login`);
  console.log(`Staff password: Staff@1234 (mobile 9876543210 / 9876543211) — change on first login`);
  console.log(`Menu:     http://${tenantKey}.localhost:3000/menu`);
  console.log(`Customer: http://${tenantKey}.localhost:3000/customer/table/T1`);
  console.log(`Platform: http://admin.localhost:3000`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
