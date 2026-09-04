export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  householdId: string | null;
  shareDetailsWithHousehold: boolean;
  createdAt: string;
}

export interface HouseholdMember {
  id: string;
  firstName: string;
  isYou: boolean;
  shareDetailsWithHousehold: boolean;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
}

export type BankAccountType = "COURANT" | "LIVRET" | "PRO" | "JOINT" | "AUTRE";

export interface BankAccount {
  id: string;
  name: string;
  type: BankAccountType;
  initialBalance: string;
  ownerId: string | null;
  createdAt: string;
}

export interface HouseholdMemberAccounts {
  userId: string;
  firstName: string;
  sharesDetails: boolean;
  accounts?: BankAccount[];
  accountCount?: number;
  total?: number;
}

export interface BankAccountsResponse {
  mine: BankAccount[];
  joint: BankAccount[];
  household: HouseholdMemberAccounts[];
}
