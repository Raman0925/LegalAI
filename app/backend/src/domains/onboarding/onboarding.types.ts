export interface Firm {
  id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  planName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FirmInvite {
  id: string;
  firmId: string;
  email: string;
  token: string;
  invitedBy: string;
  accepted: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface OnboardingResult {
  firm: Firm;
  profile: {
    id: string;
    firmId: string;
    role: 'owner';
  };
  subscription: {
    status: 'trial';
    trialEndsAt: Date;
  };
}

export interface InviteResult {
  invited: boolean;
  email: string;
  expiresAt: Date;
}

export interface JoinResult {
  joined: boolean;
  firmId: string;
  firmName: string;
}
