export const mobileMessages = {
  common: {
    loading: "Loading workspace",
    retry: "Retry",
    save: "Save",
    cancel: "Cancel",
    notAvailable: "Not available",
    close: "Close",
    signOut: "Sign out",
    open: "Open",
    noData: "No data available yet."
  },
  locale: {
    label: "Language",
    english: "English",
    arabic: "العربية"
  },
  navigation: {
    dashboard: "Dashboard",
    wallet: "Wallet",
    yield: "Yield",
    transactions: "Transactions",
    profile: "Profile",
    loans: "Managed loans"
  },
  auth: {
    signInTitle: "Sign in to your managed account",
    signInDescription:
      "Review balances, track money movement, and act through governed Ethereum rails.",
    signUpTitle: "Create a secure managed account",
    signUpDescription:
      "Set up your customer profile for managed wallet, product access, and governed transaction flows.",
    email: "Email",
    password: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    firstName: "First name",
    lastName: "Last name",
    signIn: "Sign in",
    signUp: "Create account",
    switchToSignUp: "Create an account",
    switchToSignIn: "Already have an account?",
    demoFill: "Use shared demo credentials",
    sessionExpired: "Your session expired. Please sign in again."
  },
  dashboard: {
    title: "Managed money overview",
    description:
      "A clear view of balances, pending movement, and the next action that matters.",
    availableAssets: "Tracked assets",
    pendingAssets: "Pending assets",
    moneyMovement: "Money movement",
    recentActivity: "Recent activity",
    viewHistory: "View history",
    latestSnapshotStale:
      "The latest operational snapshot is older than expected. Review pending money movement or refresh if the delay continues.",
    latestSnapshotFresh:
      "Balances and transaction state are current within the expected operating window.",
    noRecentActivity: "No transaction history has been recorded for this account yet.",
    managedWallet: "Managed wallet"
  },
  wallet: {
    title: "Deposit and withdraw",
    description:
      "Use the managed wallet rails to record deposits, reserve withdrawals, and follow every request through a clear status trail.",
    balances: "Balances",
    supportedAssets: "Supported assets",
    fundedAssets: "Funded assets",
    walletReference: "Wallet reference",
    deposit: "Deposit",
    withdraw: "Withdraw",
    asset: "Asset",
    amount: "Amount",
    destinationAddress: "Destination address",
    copy: "Copy",
    showQr: "Show QR",
    hideQr: "Hide QR",
    createDepositRequest: "Create deposit request",
    createWithdrawalRequest: "Create withdrawal request",
    latestDepositRequest: "Latest deposit request",
    latestWithdrawalRequest: "Latest withdrawal request",
    createdAt: "Created",
    reference: "Reference",
    noWallet: "No managed wallet assigned yet.",
    depositAddressCopied: "Deposit address copied.",
    selectAsset: "Select an asset before continuing.",
    amountInvalid: "Enter a valid positive decimal amount.",
    destinationInvalid: "Destination address must be a valid EVM address.",
    selfAddressInvalid:
      "Destination address must be different from your managed wallet address.",
    insufficientBalance: "Requested amount exceeds the available balance.",
    depositRecorded: "Deposit request recorded.",
    withdrawalRecorded: "Withdrawal request recorded.",
    reservationNote:
      "Withdrawal requests immediately move the requested amount from available to pending while review continues."
  },
  transactions: {
    title: "Transaction history",
    description:
      "Review request state, references, and chain execution detail when it is available.",
    searchPlaceholder: "Search by reference, amount, asset, or address",
    allTypes: "All types",
    allStatuses: "All statuses",
    details: "Details",
    internalReference: "Internal reference",
    address: "Address",
    chainHash: "Chain hash",
    empty: "No transactions match the current filters."
  },
  profile: {
    title: "Account and security",
    status: "Lifecycle status",
    managedWallet: "Managed wallet",
    productChainAddress: "Product-chain address",
    passwordManagement: "Password management",
    notifications: "Email notification preferences",
    accountIdentity: "Account identity",
    customerId: "Customer ID",
    supabaseUserId: "Supabase user ID",
    updatePassword: "Update password",
    passwordUpdated: "Password updated successfully.",
    passwordsMustMatch: "Passwords must match.",
    savePreferences: "Save preferences",
    preferencesSaved: "Notification preferences saved.",
    activatedAt: "Activated",
    restrictedAt: "Restricted",
    deposits: "Deposit emails",
    withdrawals: "Withdrawal emails",
    loans: "Loan emails",
    productUpdates: "Product updates",
    preferencesUnavailable:
      "Notification preferences are not available for this profile yet."
  },
  yield: {
    title: "Yield and staking posture",
    description:
      "Execution remains governed. Review eligibility, read-model posture, and pool state before any action.",
    pools: "Pools",
    payoutWallet: "Payout wallet",
    execution: "Execution",
    deposit: "Stake deposit",
    withdraw: "Stake withdraw",
    claimReward: "Claim reward",
    emergencyWithdraw: "Emergency withdraw",
    pendingReward: "Pending reward",
    totalStaked: "Total staked",
    rewardsPaid: "Rewards paid",
    readModelLimited: "Live position reads are limited right now.",
    noPools: "No staking pools are currently available."
  },
  loans: {
    title: "Managed lending",
    description:
      "Review eligibility, preview quotes, submit governed applications, and monitor active agreements.",
    borrowingCapacity: "Borrowing capacity",
    policyPacks: "Policy packs",
    quotePreview: "Quote preview",
    submitApplication: "Submit application",
    autopay: "Autopay",
    supportNote: "Support note",
    acknowledgement:
      "I acknowledge that the disclosed service fee is fixed and non-interest bearing.",
    noEligibility: "Lending is not available for this account yet."
  },
  status: {
    requested: "Requested",
    reviewRequired: "Review required",
    approved: "Approved",
    queued: "Queued",
    broadcast: "Broadcast",
    confirmed: "Confirmed",
    settled: "Settled",
    failed: "Failed",
    cancelled: "Cancelled",
    manuallyResolved: "Manually resolved"
  }
};

export type MobileMessages = typeof mobileMessages;
