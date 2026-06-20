const {
  ChannelStatus,
  MerchantStatus,
  PrismaClient,
} = require("@prisma/client");

const prisma = new PrismaClient();

const DEMO_MERCHANT_NAME = "Chatto Demo Store";
const DEMO_MERCHANT_SLUG = "chatto-demo-store";
const DEMO_PLATFORM_CODE = "line";
const DEMO_PLATFORM_NAME = "LINE";
const DEMO_CHANNEL_NAME = "Chatto Demo Store LINE OA";
const DEMO_CHANNEL_ID = "8f7be5bf-dc89-4c60-8540-a0903c1a4657";

async function main() {
  const externalChannelId = getRequiredEnv("LINE_CHANNEL_ID");

  const merchant = await prisma.merchant.upsert({
    where: {
      slug: DEMO_MERCHANT_SLUG,
    },
    update: {
      shopName: DEMO_MERCHANT_NAME,
      status: MerchantStatus.ACTIVE,
    },
    create: {
      shopName: DEMO_MERCHANT_NAME,
      slug: DEMO_MERCHANT_SLUG,
      status: MerchantStatus.ACTIVE,
    },
  });

  const platform = await prisma.platform.upsert({
    where: {
      code: DEMO_PLATFORM_CODE,
    },
    update: {
      name: DEMO_PLATFORM_NAME,
      status: "active",
    },
    create: {
      code: DEMO_PLATFORM_CODE,
      name: DEMO_PLATFORM_NAME,
      status: "active",
    },
  });

  const existingChannel = await prisma.channel.findFirst({
    where: {
      merchantId: merchant.id,
      platformId: platform.id,
      OR: [
        {
          externalChannelId,
        },
        {
          channelName: DEMO_CHANNEL_NAME,
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const channel = await prisma.channel.upsert({
    where: {
      id: existingChannel?.id ?? DEMO_CHANNEL_ID,
    },
    update: {
      merchantId: merchant.id,
      platformId: platform.id,
      channelName: DEMO_CHANNEL_NAME,
      externalChannelId,
      isConnected: true,
      status: ChannelStatus.CONNECTED,
    },
    create: {
      id: existingChannel?.id ?? DEMO_CHANNEL_ID,
      merchantId: merchant.id,
      platformId: platform.id,
      channelName: DEMO_CHANNEL_NAME,
      externalChannelId,
      isConnected: true,
      status: ChannelStatus.CONNECTED,
    },
  });

  console.log(
    JSON.stringify(
      {
        merchant: {
          id: merchant.id,
          shopName: merchant.shopName,
          slug: merchant.slug,
          status: merchant.status,
        },
        platform: {
          id: platform.id,
          code: platform.code,
          name: platform.name,
          status: platform.status,
        },
        channel: {
          id: channel.id,
          channelName: channel.channelName,
          externalChannelId: channel.externalChannelId,
          status: channel.status,
          isConnected: channel.isConnected,
        },
      },
      null,
      2,
    ),
  );
}

function getRequiredEnv(key) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(
      `${key} is required for seeding LINE demo data. Set it to the LINE Developers external channel ID before running the seed.`,
    );
  }

  return value;
}

void main()
  .catch((error) => {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Seed failed with an unknown error.");
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
