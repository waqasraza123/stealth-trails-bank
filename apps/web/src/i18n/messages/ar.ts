import type { WebMessages } from "./en";

export const webMessagesAr: WebMessages = {
  app: {
    loadingTitle: "جاري تحميل مساحة العمل",
    loadingDescription: "يتم تجهيز العرض التالي."
  },
  locale: {
    switcherLabel: "اللغة",
    switchToEnglish: "English",
    switchToArabic: "العربية"
  },
  brand: {
    name: "ستيلث تريلز",
    bankName: "بنك ستيلث تريلز"
  },
  navigation: {
    dashboard: "لوحة التحكم",
    wallet: "الإيداع / السحب",
    staking: "الاستيكينغ",
    loans: "القروض",
    transactions: "المعاملات",
    profile: "الملف الشخصي"
  },
  layout: {
    workspaceLabel: "مساحة العميل",
    walletSummaryTitle: "المحفظة المُدارة",
    noWallet: "لم يتم تعيين محفظة مُدارة بعد.",
    walletSummaryDescription:
      "ملفك الشخصي مرتبط بعنوان المنتج المُدار على السلسلة أدناه."
  },
  auth: {
    managedRails: "مسارات إيثيريوم مُدارة",
    signIn: {
      formEyebrow: "دخول آمن",
      formTitle: "سجّل الدخول إلى الخدمات المصرفية الرقمية المُدارة",
      formDescription:
        "ادخل إلى حسابك، وراجع نشاط المعاملات، وتعامل عبر مسارات إيثيريوم الخاضعة للمراقبة.",
      brandEyebrow: "خدمات مصرفية رقمية مؤسسية",
      brandTitle:
        "مصمم للعملاء الذين يريدون الوصول إلى إيثيريوم ضمن مسارات تشغيلية محكومة.",
      brandDescription:
        "تجمع ستيلث تريلز بين بنية المحافظ الحديثة وضوابط المراجعة والحفظ والمعاملات بأسلوب مصرفي.",
      footerPrefix: "ليس لديك حساب؟",
      footerLink: "أنشئ حساباً الآن",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "you@example.com",
      passwordLabel: "كلمة المرور",
      passwordHint: "متوافق مع مدير كلمات المرور",
      passwordPlaceholder: "أدخل كلمة المرور",
      submit: "تسجيل دخول آمن",
      successTitle: "تم تسجيل الدخول بنجاح",
      successDescription: "مرحباً بعودتك إلى حسابك.",
      errorTitle: "فشل تسجيل الدخول",
      errorDescription: "حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.",
      demoTitle: "استخدام دخول العرض المشترك",
      demoDescription:
        "اكشف حساب عرض محلي من دون إرباك مسار تسجيل الدخول الرئيسي.",
      demoPanelTitle: "وصول النظام المشترك",
      demoButton: "تعبئة بيانات العرض"
    },
    signUp: {
      formEyebrow: "فتح حساب",
      formTitle: "أنشئ ملفك المصرفي الآمن",
      formDescription:
        "أنشئ حسابك للحصول على محفظة مُدارة وسجل معاملات والوصول إلى مسارات تسوية خاضعة للمراقبة.",
      brandEyebrow: "تهيئة تراعي الحفظ",
      brandTitle: "مسار تهيئة مصرفي أولاً للتمويل الأصلي على إيثيريوم.",
      brandDescription:
        "تم تصميم هوية العميل وعمليات المحفظة المحكومة ومراجعة المشغل ضمن دورة حياة الحساب من أول تسجيل دخول.",
      footerPrefix: "لديك حساب بالفعل؟",
      footerLink: "تسجيل الدخول",
      firstNameLabel: "الاسم الأول",
      firstNamePlaceholder: "أمينة",
      lastNameLabel: "اسم العائلة",
      lastNamePlaceholder: "رحمن",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "you@example.com",
      passwordLabel: "كلمة المرور",
      passwordHint: "احفظها في مدير كلمات مرور",
      passwordPlaceholder: "أنشئ كلمة مرور قوية",
      passwordHelp:
        "استخدم كلمة مرور قوية وفريدة لملفك المصرفي. يتم ربط الوصول إلى المحفظة المُدارة بعد إنشاء الحساب.",
      submit: "إنشاء حساب آمن",
      successTitle: "تم إنشاء الحساب",
      successDescription: "سجّل الدخول للمتابعة.",
      errorTitle: "فشل إنشاء الحساب",
      errorDescription: "حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى."
    },
    credibilityChips: {
      settlement: "تسوية إيثيريوم",
      controls: "ضوابط بمستوى مصرفي",
      oversight: "إشراف تشغيلي"
    }
  },
  dashboard: {
    title: "لوحة التحكم",
    description: "نظرة عامة على الحساب المُدار.",
    descriptionWithName: "نظرة عامة على الحساب المُدار لـ {name}.",
    viewHistory: "عرض السجل",
    managedWallet: "المحفظة المُدارة",
    walletDescription:
      "هذا العنوان هو محفظة المنتج المُدارة الحالية على السلسلة والمرتبطة بملفك الشخصي.",
    assetsTracked: "الأصول المتتبعة",
    pendingAssets: "الأصول المعلّقة",
    openWalletActions: "فتح إجراءات المحفظة",
    loadBalancesError: "تعذر تحميل أرصدة العميل.",
    noBalancesTitle: "لا توجد أرصدة بعد",
    noBalancesDescription:
      "عند بدء نشاط الإيداع والتسوية ستظهر الأرصدة المتتبعة هنا.",
    noPendingBalance: "لا يوجد رصيد معلّق",
    pendingSuffix: "معلّق",
    updatedPrefix: "آخر تحديث {date}",
    historyError: "تعذر تحميل سجل المعاملات.",
    emptyHistory: "لم يتم تسجيل أي سجل معاملات لهذا الحساب حتى الآن.",
    recentTransactions: "أحدث المعاملات",
    viewAll: "عرض الكل"
  },
  wallet: {
    title: "عمليات المحفظة المُدارة",
    description:
      "أنشئ طلبات إيداع وسحب حقيقية على المحفظة المُدارة الحية وسجل الأصول المدعومة. كل طلب يدخل في مسار معاملات العميل ويظهر في سجل المعاملات.",
    historyLink: "سجل المعاملات",
    supportedAssetsError: "تعذر تحميل الأصول المدعومة.",
    balancesError: "تعذر تحميل أرصدة العميل.",
    notesTitle: "ملاحظات تشغيلية",
    noteOne:
      "طلبات الإيداع تسجل تحويلاً وارداً متوقعاً وتربطه بعنوان محفظتك المُدارة. لا يتم بث معاملة على السلسلة من هذا المتصفح.",
    noteTwo:
      "طلبات السحب تحجز الرصيد فوراً بنقل المبلغ المطلوب من المتاح إلى المعلّق أثناء المراجعة والتنفيذ الحِفظي.",
    noteThree:
      "استخدم صفحة سجل المعاملات للتأكد من دخول كل طلب إلى المسار ولمتابعة حالات الاعتماد والاصطفاف والبث والتأكيد والتسوية لاحقاً."
  },
  transactions: {
    title: "المعاملات",
    table: {
      type: "النوع",
      amount: "المبلغ",
      date: "التاريخ",
      address: "العنوان",
      status: "الحالة"
    },
    loading: "جاري تحميل سجل المعاملات...",
    loadError: "تعذر تحميل سجل المعاملات.",
    empty: "لم يتم العثور على معاملات تطابق عوامل التصفية.",
    showingCount: "عرض {shown} من أصل {total} معاملة"
  },
  transactionFilter: {
    searchPlaceholder: "ابحث في المعاملات...",
    type: "النوع",
    status: "الحالة",
    dateRange: "النطاق الزمني",
    transactionType: "نوع المعاملة",
    transactionStatus: "حالة المعاملة",
    clearAll: "مسح الكل",
    filterType: "النوع",
    filterStatus: "الحالة",
    filterDate: "التاريخ"
  },
  staking: {
    title: "استيكينغ إيثيريوم",
    governance: "حوكمة المجمع",
    executionEnabled: "تنفيذ استيكينغ العميل مفعّل",
    executionPolicyGated: "تنفيذ استيكينغ العميل ما زال خاضعاً للسياسة",
    executionLoading: "يجري تحميل حالة توفر تنفيذ استيكينغ العميل.",
    snapshotError: "تعذر تحميل لقطة الاستيكينغ.",
    readModelLimitedTitle: "قراءات المراكز الحية محدودة",
    availablePools: "مجمعات المدققين المتاحة",
    noPools: "لا توجد مجمعات استيكينغ مدرجة حالياً لمراجعة العميل.",
    selectedPoolTitle: "نظرة عامة على المجمع رقم {id}",
    selectedPoolDescription:
      "تفاصيل سجل المنتج الحي للمجمع المحدد.",
    rewardRate: "معدل المكافأة",
    totalStaked: "إجمالي المُستثمَر",
    rewardsPaid: "المكافآت المدفوعة",
    yourStake: "حصتك",
    pendingRewards: "المكافآت المعلّقة",
    lastUpdated: "آخر تحديث",
    payoutWallet: "محفظة الدفع",
    depositTitle: "إضافة ETH إلى الحصة",
    depositDescription:
      "أضف المزيد من ETH إلى مجمع المدقق المحدد عبر مسار التنفيذ المُدار.",
    withdrawTitle: "طلب سحب من الحصة",
    withdrawDescription:
      "خفّض المركز المحدد عبر مسار تنفيذ الاستيكينغ المُدار.",
    claimRewards: "تحصيل المكافآت",
    emergencyWithdraw: "سحب طارئ",
    amountLabel: "المبلغ",
    depositPlaceholder: "0.50",
    withdrawPlaceholder: "0.25",
    submitDeposit: "إرسال إيداع الحصة",
    submitWithdraw: "إرسال سحب الحصة",
    invalidDepositTitle: "مبلغ الحصة غير صالح",
    invalidDepositDescription: "أدخل مبلغ ETH موجباً للاستيكينغ.",
    invalidWithdrawTitle: "مبلغ السحب غير صالح",
    invalidWithdrawDescription: "أدخل مبلغ ETH موجباً للسحب.",
    depositSuccessTitle: "تم إرسال إيداع الحصة",
    withdrawSuccessTitle: "تم إرسال سحب الحصة",
    claimSuccessTitle: "تم إرسال طلب تحصيل المكافأة",
    emergencySuccessTitle: "تم إرسال السحب الطارئ",
    depositErrorTitle: "فشل إيداع الحصة",
    withdrawErrorTitle: "فشل سحب الحصة",
    claimErrorTitle: "فشل تحصيل المكافأة",
    emergencyErrorTitle: "فشل السحب الطارئ",
    requestFailed: "فشل الطلب.",
    txHashPrefix: "هاش المعاملة: {hash}",
    stats: {
      totalStaked: "إجمالي ETH المُستثمَر",
      totalStakedDetail: "عبر سجل المجمعات الحي",
      averageApr: "متوسط العائد السنوي للمجمع",
      activePools: "{count} مجمع نشط",
      activePoolsPlural: "{count} مجمعات نشطة",
      rewardsPaid: "المكافآت المدفوعة",
      rewardsPaidDetail: "مسجلة على المجمعات المدرجة"
    },
    poolCard: {
      title: "مجمع إيثيريوم رقم {id}",
      rewardRate: "معدل مكافأة المدقق: {value}% سنوياً",
      totalStaked: "إجمالي ETH المُستثمَر: {value} ETH",
      rewardsPaid: "إجمالي المكافآت المدفوعة: {value} ETH",
      yourStake: "حصتك: {value} ETH",
      pendingRewards: "المكافآت المعلّقة: {value} ETH",
      viewPool: "عرض المجمع"
    }
  },
  loans: {
    title: "قروض مُدارة",
    description:
      "إقراض إنتاجي لعملاء حقيقيين مع إنشاء خاضع للحوكمة، وتمويل مضمون، وحالات خدمة واضحة.",
    alertTitle: "الإقراض المُدار غير متاح بعد",
    alertDescription:
      "تعتمد الأهلية على حالة الحساب والحفظ عبر المحفظة المُدارة وتوفر أرصدة الضمان المدعومة."
  },
  profile: {
    title: "الملف الشخصي للعميل",
    signOut: "تسجيل الخروج",
    loadErrorTitle: "تعذر تحميل ملف العميل",
    loadErrorDescription:
      "تعذر تحميل عرض ملف العميل.",
    securityTitle: "واجهة أمان صادقة للحساب المُدار",
    securityDescription:
      "تعرض هذه الصفحة هوية الحساب الفعلية وحالة دورة الحياة وربط المحفظة. تمت إزالة ربط محافظ المتصفح الوهمي ورفع صور الملف الشخصي ومفاتيح الإشعارات ونماذج كلمات المرور إلى أن تتوفر واجهات آمنة للعميل.",
    accountIdentity: "هوية الحساب",
    customerId: "معرّف العميل",
    supabaseUserId: "معرّف مستخدم Supabase",
    email: "البريد الإلكتروني",
    managedWallet: "المحفظة المُدارة",
    productChainAddress: "عنوان المنتج على السلسلة",
    platformManagedCustody: "حفظ تديره المنصة",
    platformManagedCustodyDescription:
      "يتم التحكم في وصول العميل إلى المحفظة من خلال منصة المنتج. ربط محافظ المتصفح غير متاح هنا عمداً.",
    noDisconnectAction: "لا يوجد إجراء فصل مباشر",
    noDisconnectActionDescription:
      "تمت إزالة عناصر التحكم القديمة للاتصال وفصل MetaMask لأن هذه البوابة لا تستخدم حفظاً يعتمد على توقيع العميل من المتصفح.",
    notLoadedEmail: "لم يتم تحميل بريد الملف الشخصي.",
    customerFallback: "عميل",
    notProvisioned: "غير مهيأ",
    notRecorded: "غير مسجل"
  },
  createPool: {
    title: "حوكمة المجمع",
    backToStaking: "العودة إلى الاستيكينغ",
    alertTitle: "مسار داخلي فقط",
    alertDescription:
      "إنشاء مجمعات الاستيكينغ غير متاح من بوابة العميل. تم الإبقاء على هذا المسار فقط لمنع التدفق الوهمي القديم من الإيحاء بأن العملاء يمكنهم إنشاء مجمعات مدققين مباشرة.",
    unavailableTitle: "لماذا هذا الإجراء غير متاح",
    unavailableDescription:
      "يعتمد إنشاء المجمع حالياً على كتابات عقود يتحكم بها الخلفية وافتراضات حوكمة غير مناسبة لواجهة موجهة للعميل. الإبقاء على نموذج إنشاء وهمي هنا سيشوّه نموذج التشغيل الفعلي.",
    governanceBoundary: "حدود الحوكمة",
    governanceBoundaryDescription:
      "يجب أن يمر إنشاء المجمع عبر مسار داخلي للمشغل والحوكمة، وليس عبر تدفق عميل داخل المتصفح فقط.",
    contractExecution: "تنفيذ العقد",
    contractExecutionDescription:
      "مسار كتابة العقد الحالي يعمل من جهة الخادم وليس نموذج تنفيذ آمن للعميل في بيئة إنتاجية بعد.",
    operationalSafety: "السلامة التشغيلية",
    operationalSafetyDescription:
      "يتطلب وضع الإطلاق ضوابط سياسة وتدقيق وخزينة قبل إتاحة إنشاء المجمع مباشرة.",
    footnote:
      "تعرض صفحة استيكينغ العميل سجل المجمعات الحي وتوفر المنتج الحالي. يجب أن يعود إنشاء المجمع هنا فقط بعد وجود حدود الحوكمة والإطلاق الداخلية."
  },
  shared: {
    notAvailable: "غير متاح",
    none: "لا يوجد",
    unnamed: "غير مسمى",
    notProvided: "غير متوفر",
    unknown: "غير معروف"
  }
};
