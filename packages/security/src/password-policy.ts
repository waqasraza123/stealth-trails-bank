export const CUSTOMER_PASSWORD_MIN_LENGTH = 15;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 128;
export const CUSTOMER_PASSWORD_POLICY_VERSION = 2;

const COMMON_PASSWORDS = new Set(
  [
    "correct horse battery staple",
    "correcthorsebatterystaple",
    "letmeinletmeinletmein",
    "passwordpassword",
    "password123456789",
    "qwertyuiopasdfgh",
    "welcome123456789",
    "iloveyouiloveyou",
    "stealthtrailsbank",
    "123456789012345",
    "1234567890123456",
    "111111111111111",
    "qwertyqwertyqwerty",
    "qwerty1234567890",
    "adminadminadmin",
    "administrator123",
    "changemechangeme",
    "welcomewelcome1",
    "footballfootball",
    "baseballbaseball",
    "dragon123456789",
    "monkey123456789",
    "sunshine12345678",
    "princess12345678",
    "trustnoone123456",
    "abc123abc123abc",
    "passw0rdpassw0rd",
    "password1password1",
    "loginloginlogin",
    "bankingbankingbanking",
    "ethereumethereum",
  ].map((value) => value.normalize("NFC").toLocaleLowerCase("en-US")),
);

export type CustomerPasswordContext = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type CustomerPasswordValidation = {
  valid: boolean;
  normalizedPassword: string;
  errors: Array<"too_short" | "too_long" | "common" | "personal_information">;
};

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function contextTerms(context: CustomerPasswordContext): string[] {
  const emailLocalPart = context.email?.split("@")[0] ?? "";

  return [emailLocalPart, context.firstName ?? "", context.lastName ?? ""]
    .map((value) => value.normalize("NFC").trim().toLocaleLowerCase("en-US"))
    .filter((value) => value.length >= 4);
}

export function validateCustomerPassword(
  password: string,
  context: CustomerPasswordContext = {},
): CustomerPasswordValidation {
  const normalizedPassword = password.normalize("NFC");
  const normalizedForComparison = normalizedPassword.toLocaleLowerCase("en-US");
  const length = codePointLength(normalizedPassword);
  const errors: CustomerPasswordValidation["errors"] = [];

  if (length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    errors.push("too_short");
  }

  if (length > CUSTOMER_PASSWORD_MAX_LENGTH) {
    errors.push("too_long");
  }

  if (COMMON_PASSWORDS.has(normalizedForComparison)) {
    errors.push("common");
  }

  if (
    contextTerms(context).some((term) => normalizedForComparison.includes(term))
  ) {
    errors.push("personal_information");
  }

  return {
    valid: errors.length === 0,
    normalizedPassword,
    errors,
  };
}

export function customerPasswordErrorMessage(
  validation: CustomerPasswordValidation,
): string {
  if (validation.errors.includes("too_short")) {
    return `Password must be at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters long.`;
  }

  if (validation.errors.includes("too_long")) {
    return `Password must be no more than ${CUSTOMER_PASSWORD_MAX_LENGTH} characters long.`;
  }

  if (validation.errors.includes("personal_information")) {
    return "Password must not contain your name or email address.";
  }

  return "Password is too common. Choose a unique passphrase.";
}
