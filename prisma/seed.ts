import 'dotenv/config';
import {
  BusinessType,
  DiscountScope,
  DiscountType,
  PlanCode,
  PrismaClient,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEFAULT_WORKING_HOURS = {
  monday: [{ start: '09:00', end: '19:00' }],
  tuesday: [{ start: '09:00', end: '19:00' }],
  wednesday: [{ start: '09:00', end: '19:00' }],
  thursday: [{ start: '09:00', end: '19:00' }],
  friday: [{ start: '09:00', end: '19:00' }],
  saturday: [{ start: '10:00', end: '16:00' }],
  sunday: [],
};

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

async function seedPlans() {
  const plans = [
    {
      code: PlanCode.FREE,
      name: 'Gestion Manual (Gratis)',
      monthlyPriceMxn: '0.00',
      setupFeeMxn: '0.00',
      maxUsers: 1,
      maxResources: 2,
      maxAppointmentsMonth: 60,
      maxCustomers: 100,
      maxProducts: 30,
      maxAiRequestsMonth: 0,
      featuresJson: {
        whatsapp_automation: false,
        copilot_basic: false,
        copilot_full: false,
        payment_reminders: false,
        multi_user: false,
        promotions_campaign: false,
        google_calendar: false,
        google_calendar_multi: false,
        advanced_analytics: false,
      },
    },
    {
      code: PlanCode.BASIC,
      name: 'Suscripcion Basica',
      monthlyPriceMxn: '400.00',
      setupFeeMxn: '300.00',
      maxUsers: 1,
      maxResources: 3,
      maxAppointmentsMonth: 300,
      maxCustomers: 500,
      maxProducts: 150,
      maxAiRequestsMonth: 150,
      featuresJson: {
        whatsapp_automation: true,
        copilot_basic: true,
        copilot_full: false,
        payment_reminders: false,
        multi_user: false,
        promotions_campaign: false,
        google_calendar: true,
        google_calendar_multi: false,
        advanced_analytics: false,
      },
    },
    {
      code: PlanCode.PRO,
      name: 'Suscripcion Avanzada (Pro)',
      monthlyPriceMxn: '700.00',
      setupFeeMxn: '300.00',
      maxUsers: 10,
      maxResources: 10,
      maxAppointmentsMonth: null,
      maxCustomers: null,
      maxProducts: null,
      maxAiRequestsMonth: 600,
      featuresJson: {
        whatsapp_automation: true,
        copilot_basic: true,
        copilot_full: true,
        payment_reminders: true,
        multi_user: true,
        promotions_campaign: true,
        google_calendar: true,
        google_calendar_multi: true,
        advanced_analytics: true,
      },
    },
  ];

  const planByCode = new Map<PlanCode, string>();
  for (const plan of plans) {
    const record = await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        monthlyPriceMxn: plan.monthlyPriceMxn,
        setupFeeMxn: plan.setupFeeMxn,
        maxUsers: plan.maxUsers,
        maxResources: plan.maxResources,
        maxAppointmentsMonth: plan.maxAppointmentsMonth,
        maxCustomers: plan.maxCustomers,
        maxProducts: plan.maxProducts,
        maxAiRequestsMonth: plan.maxAiRequestsMonth,
        featuresJson: plan.featuresJson,
      },
      create: plan,
    });
    planByCode.set(record.code, record.id);
  }
  return planByCode;
}

async function seedSuperAdmin() {
  const passwordHash = await hashPassword('Admin123456!');
  await prisma.user.upsert({
    where: { email: 'admin@empleadodigital.local' },
    update: {
      fullName: 'Superadministrador SaaS',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      tenantId: null,
      email: 'admin@empleadodigital.local',
      passwordHash,
      fullName: 'Superadministrador SaaS',
      phone: '+525500000001',
      role: UserRole.SUPER_ADMIN,
      twoFactorEnabled: false,
      isActive: true,
    },
  });
}

async function seedDemoTenants(planByCode: Map<PlanCode, string>) {
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const ownerPasswordHash = await hashPassword('Demo123456!');

  const demos = [
    {
      slug: 'barberia-demo',
      name: 'Barberia Central Demo',
      businessType: BusinessType.BARBERSHOP,
      customerLabel: 'Cliente',
      resourceLabel: 'Barbero',
      planCode: PlanCode.PRO,
      ownerEmail: 'barberia@empleadodigital.local',
      ownerName: 'Carlos Mendoza',
      ownerPhone: '+525511110001',
      resources: [
        { id: 'seed-res-barber-1', name: 'Mateo Barbero', typeLabel: 'Barbero', color: '#FFC93C' },
        { id: 'seed-res-barber-2', name: 'Luis Estilista', typeLabel: 'Barbero', color: '#2B2D31' },
      ],
      services: [
        { id: 'seed-srv-barber-1', name: 'Corte de cabello', durationMin: 30, price: '220.00', depositAmount: '50.00', color: '#2B2D31' },
        { id: 'seed-srv-barber-2', name: 'Barba y ritual', durationMin: 25, price: '180.00', depositAmount: null, color: '#FFC93C' },
      ],
      products: [
        { sku: 'BAR-POM-01', name: 'Pomada Mate 100g', category: 'Estilizado', salePrice: '280.00', costPrice: '135.00', stock: 18, minStock: 5 },
        { sku: 'BAR-ACE-02', name: 'Aceite para Barba 30ml', category: 'Cuidado', salePrice: '240.00', costPrice: '110.00', stock: 10, minStock: 3 },
      ],
      discountCode: 'HUECO15',
    },
    {
      slug: 'consultorio-demo',
      name: 'Consultorio Dental Sonrisa',
      businessType: BusinessType.CLINIC,
      customerLabel: 'Paciente',
      resourceLabel: 'Doctor',
      planCode: PlanCode.BASIC,
      ownerEmail: 'consultorio@empleadodigital.local',
      ownerName: 'Dra. Sofia Ramirez',
      ownerPhone: '+525511110002',
      resources: [
        { id: 'seed-res-clinic-1', name: 'Dra. Sofia Ramirez', typeLabel: 'Doctor', color: '#FFC93C' },
      ],
      services: [
        { id: 'seed-srv-clinic-1', name: 'Consulta general', durationMin: 30, price: '500.00', depositAmount: '150.00', color: '#2B2D31' },
        { id: 'seed-srv-clinic-2', name: 'Limpieza dental', durationMin: 45, price: '750.00', depositAmount: '200.00', color: '#FFC93C' },
      ],
      products: [
        { sku: 'CLI-KIT-01', name: 'Kit Higiene Dental', category: 'Preventivo', salePrice: '190.00', costPrice: '85.00', stock: 25, minStock: 6 },
      ],
      discountCode: null,
    },
    {
      slug: 'restaurante-demo',
      name: 'Bistro La Esquina',
      businessType: BusinessType.RESTAURANT,
      customerLabel: 'Comensal',
      resourceLabel: 'Mesa',
      planCode: PlanCode.FREE,
      ownerEmail: 'restaurante@empleadodigital.local',
      ownerName: 'Ana Torres',
      ownerPhone: '+525511110003',
      resources: [
        { id: 'seed-res-rest-1', name: 'Mesa Terraza 1', typeLabel: 'Mesa', color: '#2B2D31' },
        { id: 'seed-res-rest-2', name: 'Mesa Salon Principal', typeLabel: 'Mesa', color: '#FFC93C' },
      ],
      services: [
        { id: 'seed-srv-rest-1', name: 'Mesa para 2 personas', durationMin: 90, price: '0.00', depositAmount: null, color: '#2B2D31' },
        { id: 'seed-srv-rest-2', name: 'Mesa familiar (6 personas)', durationMin: 120, price: '0.00', depositAmount: '300.00', color: '#FFC93C' },
      ],
      products: [
        { sku: 'RES-CAF-01', name: 'Cafe de Especialidad 500g', category: 'Barra', salePrice: '320.00', costPrice: '160.00', stock: 12, minStock: 4 },
      ],
      discountCode: null,
    },
  ];

  for (const demo of demos) {
    const planId = planByCode.get(demo.planCode);
    if (!planId) {
      throw new Error(`Plan not found for code ${demo.planCode}`);
    }

    const tenant = await prisma.tenant.upsert({
      where: { slug: demo.slug },
      update: {
        name: demo.name,
        businessType: demo.businessType,
        customerLabel: demo.customerLabel,
        resourceLabel: demo.resourceLabel,
        onboardingCompleted: true,
        isActive: true,
      },
      create: {
        name: demo.name,
        slug: demo.slug,
        businessType: demo.businessType,
        customerLabel: demo.customerLabel,
        resourceLabel: demo.resourceLabel,
        onboardingCompleted: true,
        isActive: true,
      },
    });

    await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
      create: {
        tenantId: tenant.id,
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
      },
    });

    await prisma.user.upsert({
      where: { email: demo.ownerEmail },
      update: {
        tenantId: tenant.id,
        fullName: demo.ownerName,
        role: UserRole.OWNER,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        email: demo.ownerEmail,
        passwordHash: ownerPasswordHash,
        fullName: demo.ownerName,
        phone: demo.ownerPhone,
        role: UserRole.OWNER,
        twoFactorEnabled: false,
        isActive: true,
      },
    });

    for (const res of demo.resources) {
      await prisma.resource.upsert({
        where: { id: res.id },
        update: {
          tenantId: tenant.id,
          name: res.name,
          typeLabel: res.typeLabel,
          color: res.color,
          workingHoursJson: DEFAULT_WORKING_HOURS,
          isActive: true,
        },
        create: {
          id: res.id,
          tenantId: tenant.id,
          name: res.name,
          typeLabel: res.typeLabel,
          color: res.color,
          workingHoursJson: DEFAULT_WORKING_HOURS,
          isActive: true,
        },
      });
    }

    for (const srv of demo.services) {
      await prisma.service.upsert({
        where: { id: srv.id },
        update: {
          tenantId: tenant.id,
          name: srv.name,
          durationMin: srv.durationMin,
          price: srv.price,
          depositAmount: srv.depositAmount,
          color: srv.color,
          isActive: true,
        },
        create: {
          id: srv.id,
          tenantId: tenant.id,
          name: srv.name,
          durationMin: srv.durationMin,
          price: srv.price,
          depositAmount: srv.depositAmount,
          color: srv.color,
          isActive: true,
        },
      });
    }

    for (const prod of demo.products) {
      await prisma.product.upsert({
        where: {
          tenantId_sku: {
            tenantId: tenant.id,
            sku: prod.sku,
          },
        },
        update: {
          name: prod.name,
          category: prod.category,
          salePrice: prod.salePrice,
          costPrice: prod.costPrice,
          minStock: prod.minStock,
          isActive: true,
        },
        create: {
          tenantId: tenant.id,
          sku: prod.sku,
          name: prod.name,
          category: prod.category,
          salePrice: prod.salePrice,
          costPrice: prod.costPrice,
          stock: prod.stock,
          minStock: prod.minStock,
          isActive: true,
        },
      });
    }

    if (demo.discountCode) {
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await prisma.discountRule.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: demo.discountCode,
          },
        },
        update: {
          name: 'Promocion Espacios Libres 15%',
          type: DiscountType.PERCENTAGE,
          value: '15.00',
          startsAt,
          endsAt,
          isActive: true,
          applicableScope: DiscountScope.SERVICES,
        },
        create: {
          tenantId: tenant.id,
          name: 'Promocion Espacios Libres 15%',
          code: demo.discountCode,
          type: DiscountType.PERCENTAGE,
          value: '15.00',
          startsAt,
          endsAt,
          isActive: true,
          applicableScope: DiscountScope.SERVICES,
        },
      });
    }
  }
}

async function main() {
  const planByCode = await seedPlans();
  await seedSuperAdmin();
  await seedDemoTenants(planByCode);
  console.log('Seed completed successfully (3 plans, 1 superadmin, 3 multi-giro tenants).');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
