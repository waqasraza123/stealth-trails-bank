import { PrismaClient } from "@prisma/client";
import { encryptCustomerAuthSecret } from "../auth/customer-auth-crypto";

const prisma = new PrismaClient();

async function main() {
  let migrated = 0;
  let cursor: string | undefined;

  for (;;) {
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { mfaTotpSecret: { not: null }, mfaTotpSecretEncrypted: null },
          {
            mfaPendingTotpSecret: { not: null },
            mfaPendingTotpSecretEncrypted: null,
          },
        ],
      },
      select: {
        id: true,
        mfaTotpSecret: true,
        mfaTotpSecretEncrypted: true,
        mfaPendingTotpSecret: true,
        mfaPendingTotpSecretEncrypted: true,
      },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (customers.length === 0) break;

    for (const customer of customers) {
      const active =
        customer.mfaTotpSecret && !customer.mfaTotpSecretEncrypted
          ? encryptCustomerAuthSecret(customer.mfaTotpSecret)
          : null;
      const pending =
        customer.mfaPendingTotpSecret &&
        !customer.mfaPendingTotpSecretEncrypted
          ? encryptCustomerAuthSecret(customer.mfaPendingTotpSecret)
          : null;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          ...(active
            ? {
                mfaTotpSecret: null,
                mfaTotpSecretEncrypted: active.ciphertext,
                mfaTotpSecretKeyVersion: active.keyVersion,
              }
            : {}),
          ...(pending
            ? {
                mfaPendingTotpSecret: null,
                mfaPendingTotpSecretEncrypted: pending.ciphertext,
                mfaPendingTotpSecretKeyVersion: pending.keyVersion,
              }
            : {}),
        },
      });
      migrated += 1;
    }

    cursor = customers.at(-1)?.id;
  }

  console.info(JSON.stringify({ event: "customer_auth_secrets_backfilled", migrated }));
}

void main()
  .catch((error) => {
    console.error("customer_auth_secrets_backfill_failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
