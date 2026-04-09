// JWT claim shapes — role is stored as a plain string in the token.
// Use StaffRequestUser / CustomerRequestUser (from common/interfaces) for typed access
// after the token has been validated by a Passport strategy.

export interface StaffJwtPayload {
  sub: string;           // userId
  organizationId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface CustomerJwtPayload {
  sub: string;           // customerId
  organizationId: string;
  role: 'customer';
  iat?: number;
  exp?: number;
}
