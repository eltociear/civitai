import { createJob } from './job';
import { dbRead, dbWrite } from '~/server/db/client';
import dayjs from 'dayjs';
import { throwInsufficientFundsError } from '~/server/utils/errorHandling';
import { createBuzzTransaction, getUserBuzzAccount } from '~/server/services/buzz.service';
import { TransactionType } from '~/server/schema/buzz.schema';
import { logToAxiom } from '~/server/logging/client';
import { getServerStripe } from '~/server/utils/get-server-stripe';
import { isDev } from '~/env/other';

const logger = ({ type = 'error', data = {} }: { type?: string; data?: MixedObject }) => {
  logToAxiom(
    {
      name: 'process-club-membership-recurring-payments',
      type,
      ...data,
    },
    'webhooks'
  ).catch();
};
export const processClubMembershipRecurringPayments = createJob(
  'process-club-membership-recurring-payments',
  '0 * * * *',
  async () => {
    const now = dayjs();

    // Get all club memberships that are active and have a next billing date that is yesterday.
    const clubMemberships = await dbRead.clubMembership.findMany({
      where: {
        nextBillingAt: {
          lte: now.toDate(),
        },
        cancelledAt: null,
        expiresAt: null,
        billingPausedAt: null,
        unitAmount: {
          gt: 0,
        },
        club: {
          billing: true,
        },
      },
      include: {
        downgradeClubTier: true,
      },
    });

    const stripe = await getServerStripe();

    // For each membership, create a payment intent.
    await Promise.all(
      clubMemberships.map(async (clubMembership) => {
        const user = await dbRead.user.findUnique({
          where: { id: clubMembership.userId },
          select: {
            customerId: true,
            email: true,
          },
        });

        if (!user) {
          logger({
            data: {
              message: 'User not found',
              ...clubMembership,
            },
          });

          return;
        }

        // Check if the user has buzz and can pay with buzz.
        const account = await getUserBuzzAccount({ accountId: clubMembership.userId });

        if (!account) {
          // TODO: Send email to user that they need to add a payment method.
          logger({
            data: {
              message: "Unable to get user's buzz account",
              ...clubMembership,
            },
          });

          return;
        }

        const chargedAmount =
          clubMembership.downgradeClubTier?.unitAmount ?? clubMembership.unitAmount;
        const downgradeClubTierId = clubMembership.downgradeClubTier?.id ?? undefined;

        if (chargedAmount > 0) {
          if ((account?.balance ?? 0) >= chargedAmount) {
            // Pay with buzz.
            await dbWrite.$transaction(async (tx) => {
              try {
                await tx.clubMembership.update({
                  where: { id: clubMembership.id },
                  data: {
                    nextBillingAt: dayjs(clubMembership.nextBillingAt).add(1, 'month').toDate(),
                    clubTierId: downgradeClubTierId, // Won't do anything if the user doesn't have it.
                    downgradeClubTierId: null,
                  },
                });

                await createBuzzTransaction({
                  fromAccountId: clubMembership.userId,
                  toAccountId: clubMembership.clubId,
                  toAccountType: 'Club',
                  amount: chargedAmount,
                  type: TransactionType.ClubMembership,
                  details: {
                    clubMembershipId: clubMembership.id,
                  },
                });
              } catch (e) {
                logger({
                  data: {
                    message: 'Error paying with buzz',
                    ...clubMembership,
                  },
                });

                await tx.clubMembership.update({
                  where: { id: clubMembership.id },
                  data: {
                    // Expire that membership so the user loses access.
                    // Might need to also send an email.
                    expiresAt: now.toDate(),
                  },
                });
              }
            });

            return; // Nothing else to do. We paid with buzz.
          }

          if (!user?.customerId) {
            logger({
              data: {
                message: 'User is not a stripe customer',
                ...clubMembership,
              },
            });

            await dbWrite.$transaction(async (tx) => {
              await tx.clubMembership.update({
                where: { id: clubMembership.id },
                data: {
                  // Expire that membership so the user loses access.
                  // Might need to also send an email.
                  expiresAt: now.toDate(),
                },
              });
            });
          }

          await dbWrite.$transaction(async (tx) => {
            const paymentMethods = await stripe.paymentMethods.list({
              customer: user.customerId as string,
              // type: 'card',
            });

            const [defaultCard] = paymentMethods.data;

            if (!defaultCard || !defaultCard?.id) {
              logger({
                data: {
                  message: 'User does not have a default payment method',
                  ...clubMembership,
                },
              });
            }

            const purchasedUnitAmount = Math.max(chargedAmount - (account?.balance ?? 0), 5000);

            const paymentIntent = await stripe.paymentIntents.create({
              amount: purchasedUnitAmount / 10, // Buzz has a 1:10 cent ratio. Stripe charges in cents.
              currency: 'usd',
              automatic_payment_methods: { enabled: true },
              customer: user.customerId as string,
              payment_method: defaultCard.id,
              off_session: true,
              confirm: true,
              metadata: {
                type: 'clubMembershipPayment',
                unitAmount: purchasedUnitAmount / 10,
                buzzAmount: purchasedUnitAmount,
                userId: clubMembership.userId as number,
              },
            });

            await tx.clubMembershipCharge.create({
              data: {
                userId: clubMembership.userId,
                clubId: clubMembership.clubId,
                clubTierId: downgradeClubTierId ?? clubMembership.clubTierId,
                invoiceId: paymentIntent.id,
                unitAmount: chargedAmount,
                unitAmountPurchased: purchasedUnitAmount,
                chargedAt: dayjs().toDate(),
              },
            });
          });
        }
      })
    );
  }
);
