import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const primary = await prisma.restaurantBranding.updateMany({
    where: { primaryColor: { equals: "#1a1a2e", mode: "insensitive" } },
    data: { primaryColor: "#425646" },
  });
  const secondary = await prisma.restaurantBranding.updateMany({
    where: { secondaryColor: { equals: "#16213e", mode: "insensitive" } },
    data: { secondaryColor: "#8d4c40" },
  });
  const accent = await prisma.restaurantBranding.updateMany({
    where: { accentColor: { equals: "#e94560", mode: "insensitive" } },
    data: { accentColor: "#d2e8d3" },
  });
  console.log({ primary: primary.count, secondary: secondary.count, accent: accent.count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
