import type { User } from "@prisma/client";

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    householdId: user.householdId,
    shareDetailsWithHousehold: user.shareDetailsWithHousehold,
    createdAt: user.createdAt,
  };
}
