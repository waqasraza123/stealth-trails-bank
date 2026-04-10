export const webMessages = {
  app: {
    loadingTitle: "Loading workspace",
    loadingDescription: "Preparing the next view."
  },
  locale: {
    switcherLabel: "Language",
    switchToEnglish: "English",
    switchToArabic: "العربية"
  },
  brand: {
    name: "Stealth Trails",
    bankName: "Stealth Trails Bank"
  },
  navigation: {
    dashboard: "Dashboard",
    wallet: "Deposit / Withdraw",
    staking: "Staking",
    loans: "Loans",
    transactions: "Transactions",
    profile: "Profile"
  },
  layout: {
    workspaceLabel: "Customer workspace",
    walletSummaryTitle: "Managed Wallet",
    noWallet: "No managed wallet assigned yet.",
    walletSummaryDescription:
      "Your customer profile is linked to the managed product-chain address below."
  },
  auth: {
    managedRails: "Managed Ethereum rails",
    signIn: {
      formEyebrow: "Secure access",
      formTitle: "Sign in to managed digital banking",
      formDescription:
        "Access your account, review transaction activity, and operate across monitored Ethereum rails.",
      brandEyebrow: "Institutional digital banking",
      brandTitle:
        "Built for customers who want Ethereum access with controlled operational rails.",
      brandDescription:
        "Stealth Trails combines modern wallet infrastructure with bank-like review, custody, and transaction controls.",
      footerPrefix: "Don't have an account?",
      footerLink: "Create one now",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordHint: "Password manager friendly",
      passwordPlaceholder: "Enter your password",
      submit: "Sign in securely",
      successTitle: "Login successful",
      successDescription: "Welcome back to your account.",
      errorTitle: "Login failed",
      errorDescription: "An error occurred during login. Please try again.",
      demoTitle: "Use shared demo access",
      demoDescription:
        "Reveal a local demonstration account without crowding the primary login flow.",
      demoPanelTitle: "Shared system access",
      demoButton: "Fill demo credentials"
    },
    signUp: {
      formEyebrow: "Open an account",
      formTitle: "Create your secure banking profile",
      formDescription:
        "Set up your account to receive a managed wallet, transaction history, and access to monitored settlement flows.",
      brandEyebrow: "Custody-aware onboarding",
      brandTitle: "A bank-first onboarding flow for Ethereum-native finance.",
      brandDescription:
        "Customer identity, controlled wallet operations, and operator review are designed into the account lifecycle from the first login.",
      footerPrefix: "Already have an account?",
      footerLink: "Sign in",
      firstNameLabel: "First name",
      firstNamePlaceholder: "Amina",
      lastNameLabel: "Last name",
      lastNamePlaceholder: "Rahman",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordHint: "Store it in a password manager",
      passwordPlaceholder: "Create a strong password",
      passwordHelp:
        "Use a strong, unique password for your banking profile. Managed wallet access is attached after account creation.",
      submit: "Create secure account",
      successTitle: "Account created",
      successDescription: "Sign in to continue.",
      errorTitle: "Sign-up failed",
      errorDescription: "An error occurred during sign-up. Please try again."
    },
    credibilityChips: {
      settlement: "Ethereum settlement",
      controls: "Bank-grade controls",
      oversight: "Operator oversight"
    }
  },
  dashboard: {
    title: "Dashboard",
    description: "Managed account overview.",
    descriptionWithName: "Managed account overview for {name}.",
    viewHistory: "View history",
    managedWallet: "Managed Wallet",
    walletDescription:
      "This address is the current managed product-chain wallet linked to your customer profile.",
    assetsTracked: "Assets tracked",
    pendingAssets: "Pending assets",
    openWalletActions: "Open wallet actions",
    loadBalancesError: "Failed to load customer balances.",
    noBalancesTitle: "No balances yet",
    noBalancesDescription:
      "Once deposit and settlement activity starts, tracked asset balances will appear here.",
    noPendingBalance: "No pending balance",
    pendingSuffix: "pending",
    updatedPrefix: "Updated {date}",
    historyError: "Failed to load transaction history.",
    emptyHistory: "No transaction history has been recorded for this account yet.",
    recentTransactions: "Recent transactions",
    viewAll: "View all"
  },
  wallet: {
    title: "Managed Wallet Operations",
    description:
      "Create truthful deposit and withdrawal requests against the live managed wallet and supported asset registry. Every request lands in the customer transaction workflow and appears in transaction history.",
    historyLink: "transaction history",
    supportedAssetsError: "Failed to load supported assets.",
    balancesError: "Failed to load customer balances.",
    notesTitle: "Operational notes",
    noteOne:
      "Deposit requests record an expected inbound transfer and bind it to your managed wallet address. They do not broadcast a chain transaction from this browser.",
    noteTwo:
      "Withdrawal requests reserve balance immediately by moving the requested amount from available into pending while review and custody execution proceed.",
    noteThree:
      "Use the transaction history page to confirm each request entered the workflow and to track later approval, queueing, broadcast, confirmation, and settlement states."
  },
  transactions: {
    title: "Transactions",
    table: {
      type: "Type",
      amount: "Amount",
      date: "Date",
      address: "Address",
      status: "Status"
    },
    loading: "Loading transaction history...",
    loadError: "Failed to load transaction history.",
    empty: "No transactions found matching your filters.",
    showingCount: "Showing {shown} of {total} transactions"
  },
  transactionFilter: {
    searchPlaceholder: "Search transactions...",
    type: "Type",
    status: "Status",
    dateRange: "Date range",
    transactionType: "Transaction type",
    transactionStatus: "Transaction status",
    clearAll: "Clear all",
    filterType: "Type",
    filterStatus: "Status",
    filterDate: "Date"
  },
  staking: {
    title: "Ethereum Staking",
    governance: "Pool governance",
    executionEnabled: "Customer staking execution is enabled",
    executionPolicyGated: "Customer staking execution remains policy-gated",
    executionLoading: "Customer staking execution availability is loading.",
    snapshotError: "Failed to load staking snapshot.",
    readModelLimitedTitle: "Live position reads are limited",
    availablePools: "Available validator pools",
    noPools: "No staking pools are currently listed for customer review.",
    selectedPoolTitle: "Pool #{id} overview",
    selectedPoolDescription:
      "Live product registry detail for the selected pool.",
    rewardRate: "Reward rate",
    totalStaked: "Total staked",
    rewardsPaid: "Rewards paid",
    yourStake: "Your stake",
    pendingRewards: "Pending rewards",
    lastUpdated: "Last updated",
    payoutWallet: "Payout wallet",
    depositTitle: "Stake more ETH",
    depositDescription:
      "Add more ETH to the selected validator pool through the managed execution path.",
    withdrawTitle: "Request stake withdrawal",
    withdrawDescription:
      "Reduce the selected position through the managed staking execution flow.",
    claimRewards: "Claim rewards",
    emergencyWithdraw: "Emergency withdrawal",
    amountLabel: "Amount",
    depositPlaceholder: "0.50",
    withdrawPlaceholder: "0.25",
    submitDeposit: "Submit stake deposit",
    submitWithdraw: "Submit stake withdrawal",
    invalidDepositTitle: "Invalid stake amount",
    invalidDepositDescription: "Enter a positive ETH amount to stake.",
    invalidWithdrawTitle: "Invalid withdrawal amount",
    invalidWithdrawDescription: "Enter a positive ETH amount to withdraw.",
    depositSuccessTitle: "Stake deposit submitted",
    withdrawSuccessTitle: "Stake withdrawal submitted",
    claimSuccessTitle: "Reward claim submitted",
    emergencySuccessTitle: "Emergency withdrawal submitted",
    depositErrorTitle: "Stake deposit failed",
    withdrawErrorTitle: "Stake withdrawal failed",
    claimErrorTitle: "Reward claim failed",
    emergencyErrorTitle: "Emergency withdrawal failed",
    requestFailed: "Request failed.",
    txHashPrefix: "Transaction hash: {hash}",
    stats: {
      totalStaked: "Total ETH staked",
      totalStakedDetail: "Across the live pool registry",
      averageApr: "Average pool APR",
      activePools: "{count} active pool",
      activePoolsPlural: "{count} active pools",
      rewardsPaid: "Rewards paid",
      rewardsPaidDetail: "Recorded against listed pools"
    },
    poolCard: {
      title: "Ethereum Pool #{id}",
      rewardRate: "Validator reward rate: {value}% APR",
      totalStaked: "Total ETH staked: {value} ETH",
      rewardsPaid: "Total rewards paid: {value} ETH",
      yourStake: "Your stake: {value} ETH",
      pendingRewards: "Pending rewards: {value} ETH",
      viewPool: "View pool"
    }
  },
  loans: {
    title: "Managed lending",
    description:
      "Production lending for real customers, with governed origination, collateralized funding, and explicit servicing states.",
    alertTitle: "Managed lending is not available yet",
    alertDescription:
      "Eligibility depends on account state, managed wallet custody, and supported collateral balances."
  },
  profile: {
    title: "Customer Profile",
    signOut: "Sign out",
    loadErrorTitle: "Failed to load customer profile",
    loadErrorDescription:
      "The customer profile projection could not be loaded.",
    securityTitle: "Truthful managed-account security surface",
    securityDescription:
      "This page shows real account identity, lifecycle status, wallet linkage, password rotation, and customer email preferences where the managed customer projection supports them.",
    accountIdentity: "Account identity",
    customerId: "Customer ID",
    supabaseUserId: "Supabase User ID",
    email: "Email",
    managedWallet: "Managed wallet",
    productChainAddress: "Product-chain address",
    platformManagedCustody: "Platform-managed custody",
    platformManagedCustodyDescription:
      "Customer wallet access is managed by the product platform. Browser wallet linking is intentionally not exposed here.",
    noDisconnectAction: "No direct disconnect action",
    noDisconnectActionDescription:
      "The old MetaMask connect and disconnect controls were removed because this portal does not use user-signed browser wallet custody.",
    notLoadedEmail: "No profile email loaded.",
    customerFallback: "Customer",
    notProvisioned: "Not provisioned",
    notRecorded: "Not recorded"
  },
  createPool: {
    title: "Pool governance",
    backToStaking: "Back to staking",
    alertTitle: "Internal-only workflow",
    alertDescription:
      "Staking pool creation is not available from the customer portal. This route is preserved only to prevent the old mocked flow from pretending that customers can create validator pools directly.",
    unavailableTitle: "Why this action is unavailable",
    unavailableDescription:
      "Pool creation currently depends on backend-controlled contract writes and governance assumptions that are not appropriate for a customer-facing interface. Keeping a fake creation form here would misrepresent the actual operating model.",
    governanceBoundary: "Governance boundary",
    governanceBoundaryDescription:
      "Pool creation should move through an internal operator and governance path, not a browser-only customer flow.",
    contractExecution: "Contract execution",
    contractExecutionDescription:
      "The current contract write path is server-side and not yet a production-safe customer execution model.",
    operationalSafety: "Operational safety",
    operationalSafetyDescription:
      "Product launch posture requires policy, audit, and treasury controls before pool creation can be exposed directly.",
    footnote:
      "The customer staking page shows the live pool registry and current product availability. Pool creation should reappear here only after the internal governance and release boundary exists."
  },
  shared: {
    notAvailable: "Not available",
    none: "N/A",
    unnamed: "Unnamed",
    notProvided: "Not provided",
    unknown: "Unknown"
  }
} as const;

export type WebMessages = typeof webMessages;
