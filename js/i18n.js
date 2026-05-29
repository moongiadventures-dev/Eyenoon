/**
 * Eye:Noon — English (default) / Korean UI strings.
 * Preference: localStorage key eyenoon_lang ("en" | "ko")
 */
(function () {
  var STORAGE_KEY = "eyenoon_lang";
  var STRINGS = {
    en: {
      lang: { en: "EN", ko: "KO", toggleAria: "Language" },
      nav: {
        home: "Home",
        about: "About Us",
        optical: "Optical",
        sunglasses: "Sunglasses",
        contactLenses: "Contact Lenses",
        contact: "Contact Us",
        shopAria: "Shop",
        shop: "Shop",
        cartAria: "Shopping cart",
      },
      footer: {
        line: 'Eye:Noon Optical <span class="text-[#E0115F] px-2">/</span> TEL. 213. 388. 1447 <span class="text-[#E0115F] px-2">/</span> <a href="mailto:eyenoonoptical@gmail.com" class="text-inherit no-underline">eyenoonoptical@gmail.com</a>',
        emailLine:
          'Eye:Noon Optical <span style="color:#E0115F;padding:0 10px;">/</span> TEL. 213. 388. 1447 <span style="color:#E0115F;padding:0 10px;">/</span> E-MAIL. <a href="mailto:eyenoonoptical@gmail.com" style="color:rgba(0,0,0,0.6);text-decoration:none;">eyenoonoptical@gmail.com</a>',
        address: "301 S Western Ave. #103, Los Angeles, CA 90020",
        copyright: "Copyright ©2020 Eye:Noon Optical. All Rights Reserved.",
      },
      meta: {
        home: "EYE:NOON | THE OPTICAL EDITORIAL",
        about: "About Us | EYE:NOON OPTICAL",
        contact: "Contact Us | EYE:NOON OPTICAL",
        optical: "Optical | EYE:NOON OPTICAL",
        sunglasses: "Sunglasses | EYE:NOON OPTICAL",
        contactLenses: "Contact Lenses | EYE:NOON OPTICAL",
        lensProduct: "Contact lens product | EYE:NOON OPTICAL",
        cart: "Cart | EYE:NOON OPTICAL",
        checkout: "Checkout · Contact lenses | EYE:NOON OPTICAL",
        checkoutCancel: "Checkout canceled | EYE:NOON OPTICAL",
        checkoutSuccess: "Thank you | EYE:NOON OPTICAL",
      },
      home: {
        heroLabel: "Inaugural Exhibition",
        heroSubtitle: "The Visionary Curator",
        verticalDescent: "Vertical Descent",
        nowShowing: "Now Showing",
        stackLine1: "WHAT YOU",
        stackLine2: "CAN FIND",
      },
      about: {
        eyebrow: "About",
        h1: 'The optical<br/><span class="text-[#E0115F]">editorial</span>',
        p1: "Eye:Noon Optical is a trendsetting optical boutique offering a refined eyewear experience both online and at our Los Angeles storefront.",
        p2: "Built by innovators and forward-thinkers, our mission is to continuously elevate the eyewear shopping experience through quality, craftsmanship, and exceptional, personalized service.",
        brandsH: "Our brands",
        brandsP:
          "We pride ourselves on offering a carefully curated selection of high-end designer eyewear and luxury sunglasses, featuring exclusive imports from brands like CUTLER AND GROSS, LINDA FARROW, L.G.R, RETROSUPERFUTURE, YUICHI TOYAMA., and AKILA. To guarantee optimal vision and comfort, our premium frames are expertly fitted and paired with ZEISS precision lenses.",
        findOnline: "Find us online",
        maps: "Google Maps",
      },
      contact: {
        eyebrow: "Contact",
        h1: 'Contact<br/><span class="text-[#E0115F]">Us</span>',
        lead:
          "Reach Eye:Noon Optical by phone or email. Visit us in Los Angeles — we sell online and in store, so please get in touch before you order if you have questions about availability.",
        rxTitle: "Contact lens prescriptions",
        rxBody:
          "If you are ordering contact lenses for the first time, you are required to send us your prescription by email. Without your prescription, your order will be cancelled automatically.",
        rxLink: "Email your prescription",
        stockNote:
          "Eye:Noon Optical sells through online and offline channels, so stock changes often. Please contact us before placing your order if you need to confirm availability.",
        card1h: "Contact us",
        card2h: "Visit us",
        tel: "Tel",
        email: "Email",
        hours: "Hours",
        hoursVal: "Monday – Saturday: 10:00 – 18:00",
        sunClosed: "Sunday: Closed",
        exams: "Eye exams",
        examsVal: "Monday, Wednesday, Friday & Saturday — by appointment only",
        addr: "Address",
        findOnline: "Find us online",
      },
      optical: {
        eyebrow: "Optical",
        h1: 'Optical<br/><span class="text-[#E0115F]">Frames</span>',
        lead:
          'Discover our handpicked collection of optical frames from designers like Cutler and Gross, Linda Farrow, L.G.R, Retrosuperfuture, YUICHI TOYAMA., and AKILA. Each frame is selected for its exceptional craftsmanship and distinctive character — because your eyewear should be as unique as you are. Frames are available to try on in store only; visit us or call <a href="tel:+12133881447" class="text-[#E0115F] underline-offset-4">213.388.1447</a> to find your perfect pair.',
        brand: "Brand",
        catalogErr: "Could not load frame catalog.",
        modalNotOnline: "Not available for purchase on this website.",
        modalViewBrand: "View on brand website",
        close: "Close",
      },
      sunglasses: {
        eyebrow: "Sunglasses",
        h1: 'Sun<br/><span class="text-[#E0115F]">Glasses</span>',
        lead:
          'Discover our handpicked designer sunglasses from Cutler and Gross, Linda Farrow, L.G.R, Retrosuperfuture, YUICHI TOYAMA., and AKILA — up to twenty models per brand, with imagery and names from each brand’s site where available. Sunglasses are available to try on in store only; visit us or call <a href="tel:+12133881447" class="text-[#E0115F] underline-offset-4">213.388.1447</a> to find your pair. UV protection and lens options in store.',
        brand: "Brand",
        catalogErr: "Could not load sunglasses catalog.",
        modalNotOnline: "Not available for purchase on this website.",
        modalViewBrand: "View on brand website",
        close: "Close",
      },
      lenses: {
        eyebrow: "Lenses",
        h1: 'Contact<br/><span class="text-primary">Lenses</span>',
        rxNote: "* A prescription is needed to process your order.",
        lead:
          'We carry a full range of prescription contact lenses in store. The prices listed reflect standard supply pricing — call us at <a href="tel:+12133881447" class="text-primary underline underline-offset-4 hover:opacity-80">213.388.1447</a> or stop by for a prescription check and to place your order.',
        filterAria: "Filter by wear schedule",
        filterAll: "All",
        filterDaily: "Daily · 3 mo supply",
        filterPlanned: "Planned replacement · 6 mo",
        filterColor: "Color",
        empty: "No products in this filter.",
        catalogErr: "Could not load catalog.",
        cardMeta: "Tap for details & add to cart",
      },
      cart: {
        title: "Cart",
        lead:
          "Review items. On checkout, upload your prescription and pay with PayPal or credit / debit card (phone or in store)—or call us to place your order.",
        empty: 'Your cart is empty. <a href="contact-lenses.html" class="text-[#E0115F]">Browse contact lenses</a>',
        subtotal: "Subtotal:",
        rxCancel: "* If the prescription is invalid, we will cancel the order.",
        taxShip: "Taxes/shipping may be adjusted when we confirm your order.",
        checkoutBtn: "Checkout with Rx & payment",
        callBtn: "Call to order",
        remove: "Remove",
        footer: "Eye:Noon Optical · Los Angeles",
      },
      checkout: {
        backCart: "← Back to cart",
        title: "Checkout",
        intro:
          'Upload your prescription and your contact details. After you submit, pay with <strong class="text-white/90 font-semibold">PayPal</strong> or <strong class="text-white/90 font-semibold">credit / debit card</strong> (phone or in store) using the amount shown—PayPal applies your order # automatically.',
        empty: 'Your cart is empty. <a href="contact-lenses.html" class="text-[#E0115F] font-medium hover:underline">Browse contact lenses</a>',
        yourCart: "Your cart",
        yourDetails: "Your details",
        fullName: "Full name",
        dob: "Date of birth",
        email: "Email",
        phone: "Phone",
        shipBlock: "Shipping address",
        shipHelp: "We use your ZIP to estimate sales tax and shipping. Final amounts may be adjusted when we confirm your order.",
        street: "Street address",
        apt: "Apt, suite, unit",
        optional: "(optional)",
        city: "City",
        state: "State",
        zip: "ZIP code",
        selectState: "Select state",
        rxTitle: "Prescription",
        rxHelp: "Upload a clear photo or scan of your contact lens prescription (PDF, JPG, or PNG, max 12 MB).",
        rxFromCart: "Prescription file from your cart step will be included with this order.",
        existingRxTitle: "Prescription on file",
        existingRxBody:
          "We have your prescription on record from a prior visit. Enter your details below and complete payment—no upload needed.",
        orderSummary: "Order summary",
        subtotal: "Subtotal",
        estTax: "Est. sales tax",
        delivery: "Delivery / shipping",
        shipHint: "Enter state and ZIP to estimate shipping.",
        total: "Total",
        submit: "Submit order",
        submitting: "Saving…",
        introExisting:
          "Enter your contact details below. Your prescription is already on file with us from a prior visit. Then pay with PayPal or card using the exact total shown.",
        introCartRx:
          "Confirm your contact details. Your prescription from the cart step will be submitted with this order. Then pay with PayPal or card using the exact total shown.",
        introRestore:
          "Your order is on file. Pay below with PayPal or card—the amount and order # match what you submitted.",
        leadDone:
          "Complete payment for the <strong class=\"text-white\">amount due</strong> below. Your <strong class=\"text-white\">order #</strong> is sent automatically with PayPal when you continue.",
        leadRefresh:
          "You refreshed the page — your cart was already cleared after the order was saved. Payment links below still match this order.",
        leadPostExisting:
          "We will use your prescription on file from your prior visit. Pay with PayPal below when configured, or use credit / debit card (phone or in store).",
        leadPostNew:
          "Your prescription file is saved with this order. Pay with PayPal below when configured, or use credit / debit card (phone or in store).",
        orderReceived: "Order received",
        orderNum: "Order #",
        amountDue: "Amount due",
        payTitle: "Payment",
        paySecure:
          'Pay the <strong class="text-white font-semibold">exact amount due</strong> above. PayPal opens with your <strong class="text-white font-semibold">order # and amount</strong> already filled in—no need to copy or paste.',
        methodPaypal: "PayPal",
        methodCard: "Credit / debit card",
        panelPaypal:
          'Continue opens PayPal with your <strong class="text-white">order total</strong>. Your payment note is saved to the clipboard automatically when you tap (in case PayPal asks for a note).',
        panelCard:
          "Call us or pay in store with card. Use the same amount and order # shown above.",
        continuePaypal: "Continue to PayPal",
        cardInstructions: "Phone or in store — same total & order #",
        nextHint: "Next: choose PayPal or card — your order # is applied automatically",
        questions: 'Questions? <a href="tel:+12133881447" class="text-[#E0115F] hover:underline">213.388.1447</a> · <a href="contact.html" class="text-[#E0115F] hover:underline">Contact</a>',
        backHome: "Back to home",
        errZip: "Please enter a valid ZIP code (5 digits, optional +4).",
        errRx: "Please upload your prescription.",
        errOrder: "Could not save order.",
        errNet: "Cannot reach the order server.",
        errTop: "Order server is not reachable",
        errPing:
          "Order server is not reachable at {url}. Open a terminal, run: cd server → npm start — keep it open, then refresh this page.",
        errFetch:
          "Cannot reach the order server at {url}. In a terminal run: cd server → npm start. Keep that window open while you use the site (including Live Server).",
        errParse: "The order server returned an invalid response (not JSON). Is it running?",
        onlyLenses: "This checkout is only for contact lenses. Remove other items or call the store.",
        rxInstructionsCart:
          "You already uploaded a prescription when you added lenses to your cart. It will be attached to this order.",
        rxSidebarOnFile: "Prescription: on file with Eye:Noon",
        rxSidebarCart: "Prescription: attached from cart",
        rxSidebarUpload: "Prescription: upload below before submitting",
        rxSidebarAttachedName: "Prescription: attached ({name})",
        donePricingTpl: "Subtotal {sub} · Tax {tax} · {delLabel} {del} · Total {tot}",
        paymentLinkErr: "Add a PayPal.me username in js/payment-config.js for one-tap payment links.",
        taxEstNote: "Tax and shipping are estimates. We may adjust when we confirm your order.",
        secureCheckout: "Secure checkout",
        orderReceivedBadge: "Order received",
        thProduct: "Product",
        thQty: "Qty",
        thPrice: "Price each",
        thLine: "Line total",
        linesUnavailable:
          "Line details are not available for this session. Your order # and amount due above are still valid.",
        cardPanelBody:
          'Pay by card over the phone or in store. Have your <strong class="text-white">order #</strong> and <strong class="text-white">amount due</strong> ready—we charge the exact total shown above.',
        callPayCard: "Call to pay by card",
        cardPanelAddr: "301 S Western Ave #103, Los Angeles, CA 90020",
        paypalBtn: "Continue with PayPal.me",
        doneRxPrefix: "Prescription · ",
        paySecureHosted:
          'Pay the <strong class="text-white font-semibold">exact amount due</strong> above. Card and PayPal use secure checkout on our server. PayPal.me uses your order # in the note when configured.',
        panelCardStripe:
          "Pay online with card (Visa, Mastercard, Amex, and more). You will be redirected to Stripe’s secure checkout.",
        payCardStripe: "Pay with card",
        orPhoneCard: "Or pay by phone or in store",
        panelPaypalHosted:
          "Sign in to PayPal and approve payment for the exact total. Funds are captured when you finish on PayPal.",
        payPaypalHosted: "Pay with PayPal",
        orPaypalMe: "Or use PayPal.me",
        panelPaypalMeNote:
          'Opens PayPal.me with your <strong class="text-white">order total</strong>. Your payment note is copied when you tap.',
        paidBannerStripe: "Card payment received — thank you.",
        paidBannerPaypal: "PayPal payment received — thank you.",
        stripeCanceled: "Card checkout was canceled. No charge was made.",
        paypalCanceled: "PayPal checkout was canceled. No charge was made.",
      },
      product: {
        notFound: "Product not found.",
        back: "← All contact lenses",
        blurb:
          "Sold as a prescription supply pack. We will ask whether you are already a patient with us on file. New patients can upload a prescription and their details here; they will carry through to checkout. Existing patients go straight to the cart, then complete payment at checkout.",
        qty: "Quantity",
        addToCart: "Add to cart",
        lensQTitle: "Before we add this to your cart",
        lensQBody: "Are you an existing customer of Eye:Noon Optical? If yes, have you previously received an eye prescription from us?",
        yes: "Yes",
        no: "No",
        cancel: "Cancel",
      },
      cancel: {
        title: "Payment canceled",
        body: "No charge was made. Your cart is unchanged.",
        tryAgain: "Try checkout again",
        viewCart: "View cart",
      },
      success: {
        kicker: "Thank you",
        title: "We appreciate your business",
        body:
          'We have your prescription on file and will confirm your order by email or phone if anything is unclear. Questions? Call <a href="tel:+12133881447" class="text-[#E0115F] font-medium no-underline">213.388.1447</a>.',
        back: "Back to home",
      },
    },
    ko: {
      lang: { en: "EN", ko: "한국어", toggleAria: "언어" },
      nav: {
        home: "홈",
        about: "매장 소개",
        optical: "안경테",
        sunglasses: "선글라스",
        contactLenses: "콘택트렌즈",
        contact: "문의",
        shopAria: "쇼핑",
        shop: "쇼핑",
        cartAria: "장바구니",
      },
      footer: {
        line: '아이눈 안경원 <span class="text-[#E0115F] px-2">/</span> 전화 213. 388. 1447 <span class="text-[#E0115F] px-2">/</span> <a href="mailto:eyenoonoptical@gmail.com" class="text-inherit no-underline">eyenoonoptical@gmail.com</a>',
        emailLine:
          '아이눈 안경원 <span style="color:#E0115F;padding:0 10px;">/</span> 전화 213. 388. 1447 <span style="color:#E0115F;padding:0 10px;">/</span> 이메일 <a href="mailto:eyenoonoptical@gmail.com" style="color:rgba(0,0,0,0.6);text-decoration:none;">eyenoonoptical@gmail.com</a>',
        address: "301 S Western Ave. #103, Los Angeles, CA 90020",
        copyright: "Copyright ©2020 Eye:Noon Optical. All Rights Reserved.",
      },
      meta: {
        home: "아이눈 안경원 | THE OPTICAL EDITORIAL",
        about: "매장 소개 | 아이눈 안경원",
        contact: "문의 | 아이눈 안경원",
        optical: "안경테 | 아이눈 안경원",
        sunglasses: "선글라스 | 아이눈 안경원",
        contactLenses: "콘택트렌즈 | 아이눈 안경원",
        lensProduct: "콘택트렌즈 상품 | 아이눈 안경원",
        cart: "장바구니 | 아이눈 안경원",
        checkout: "결제 · 콘택트렌즈 | 아이눈 안경원",
        checkoutCancel: "결제 취소 | 아이눈 안경원",
        checkoutSuccess: "감사합니다 | 아이눈 안경원",
      },
      home: {
        heroLabel: "첫 전시",
        heroSubtitle: "비전을 큐레이션하는 이",
        verticalDescent: "아래로 스크롤",
        nowShowing: "지금 상영",
        stackLine1: "여기서",
        stackLine2: "만나요",
      },
      about: {
        eyebrow: "소개",
        h1: '안경을 담는<br/><span class="text-[#E0115F]">에디토리얼</span>',
        p1: "아이눈 안경원(Eye:Noon Optical)은 로스앤젤레스 매장과 온라인에서 세련된 안경 쇼핑 경험을 제공하는 트렌드 안경 부티크입니다.",
        p2: "혁신과 장인 정신을 바탕으로 품질과 맞춤 서비스로 안경 쇼핑 경험을 끊임없이 높이는 것이 우리의 목표입니다.",
        brandsH: "브랜드",
        brandsP:
          "CUTLER AND GROSS, LINDA FARROW, L.G.R, RETROSUPERFUTURE, YUICHI TOYAMA., AKILA 등 하이엔드 디자이너 안경·럭셔리 선글라스를 엄선해 소개합니다. 최적의 시야와 편안함을 위해 ZEISS 정밀 렌즈와 함께 전문 피팅을 제공합니다.",
        findOnline: "온라인에서 찾기",
        maps: "Google 지도",
      },
      contact: {
        eyebrow: "문의",
        h1: '<span class="text-[#E0115F]">문의하기</span>',
        lead:
          "전화, 이메일로 아이눈 안경원에 연락해 주세요. LA 매장을 방문하실 수 있습니다. 온라인·매장 모두 판매하므로 재고 문의는 주문 전에 미리 연락 주세요.",
        rxTitle: "콘택트렌즈 처방전",
        rxBody:
          "콘택트렌즈를 처음 주문하시는 경우 이메일로 처방전을 보내 주셔야 합니다. 처방전이 없으면 주문이 자동으로 취소됩니다.",
        rxLink: "처방전 이메일 보내기",
        stockNote:
          "온라인과 오프라인에서 함께 판매하므로 재고는 자주 변합니다. 재고 확인이 필요하면 주문 전에 연락해 주세요.",
        card1h: "연락처",
        card2h: "오시는 길",
        tel: "전화",
        email: "이메일",
        hours: "영업시간",
        hoursVal: "월–토: 10:00 – 18:00",
        sunClosed: "일요일: 휴무",
        exams: "안과 검진",
        examsVal: "월·수·금·토 — 예약 필수",
        addr: "주소",
        findOnline: "온라인에서 찾기",
      },
      optical: {
        eyebrow: "안경",
        h1: '안경<br/><span class="text-[#E0115F]">테</span>',
        lead:
          'Cutler and Gross, Linda Farrow, L.G.R, Retrosuperfuture, YUICHI TOYAMA., AKILA 등 엄선한 안경테를 만나 보세요. 매장에서만 착용 체험이 가능합니다. 방문하시거나 <a href="tel:+12133881447" class="text-[#E0115F] underline-offset-4">213.388.1447</a>로 문의해 주세요.',
        brand: "브랜드",
        catalogErr: "카탈로그를 불러오지 못했습니다.",
        modalNotOnline: "이 웹사이트에서는 온라인 구매가 불가합니다.",
        modalViewBrand: "브랜드 공식 사이트에서 보기",
        close: "닫기",
      },
      sunglasses: {
        eyebrow: "선글라스",
        h1: '선<br/><span class="text-[#E0115F]">글라스</span>',
        lead:
          'Cutler and Gross, Linda Farrow, L.G.R, Retrosuperfuture, YUICHI TOYAMA., AKILA 등 디자이너 선글라스를 소개합니다. 매장에서만 착용 체험이 가능합니다. 방문하시거나 <a href="tel:+12133881447" class="text-[#E0115F] underline-offset-4">213.388.1447</a>로 문의해 주세요. 자외선 차단·렌즈 옵션은 매장에서 안내합니다.',
        brand: "브랜드",
        catalogErr: "선글라스 카탈로그를 불러오지 못했습니다.",
        modalNotOnline: "이 웹사이트에서는 온라인 구매가 불가합니다.",
        modalViewBrand: "브랜드 공식 사이트에서 보기",
        close: "닫기",
      },
      lenses: {
        eyebrow: "렌즈",
        h1: '콘택트<br/><span class="text-primary">렌즈</span>',
        rxNote: "* 주문 처리를 위해 처방전이 필요합니다.",
        lead:
          '처방 콘택트렌즈를 다양하게 구비하고 있습니다. 표시된 가격은 일반적인 공급 기준입니다. <a href="tel:+12133881447" class="text-primary underline underline-offset-4 hover:opacity-80">213.388.1447</a>로 전화하시거나 매장에 방문해 처방 확인 및 주문해 주세요.',
        filterAria: "착용 주기별 필터",
        filterAll: "전체",
        filterDaily: "데일리 · 3개월분",
        filterPlanned: "교체형 · 6개월",
        filterColor: "컬러",
        empty: "이 필터에 해당하는 상품이 없습니다.",
        catalogErr: "카탈로그를 불러오지 못했습니다.",
        cardMeta: "탭하여 상세 보기 및 장바구니",
      },
      cart: {
        title: "장바구니",
        lead:
          "상품을 확인하세요. 결제 시 처방전을 업로드하고 PayPal, 카드(전화·매장)로 결제하시거나 전화 주문도 가능합니다.",
        empty: '장바구니가 비어 있습니다. <a href="contact-lenses.html" class="text-[#E0115F]">콘택트렌즈 둘러보기</a>',
        subtotal: "소계:",
        rxCancel: "* 처방전이 유효하지 않으면 주문이 취소될 수 있습니다.",
        taxShip: "주문 확인 시 세금·배송비가 조정될 수 있습니다.",
        checkoutBtn: "처방전·결제 진행",
        callBtn: "전화 주문",
        remove: "삭제",
        footer: "아이눈 안경원 · 로스앤젤레스",
      },
      checkout: {
        backCart: "← 장바구니로",
        title: "결제",
        intro:
          '처방전과 연락처를 입력해 주세요. 제출 후 <strong class="text-white/90 font-semibold">PayPal</strong> 또는 <strong class="text-white/90 font-semibold">신용·체크 카드</strong>(전화 또는 매장)로 안내된 금액을 결제해 주세요. PayPal은 주문 번호가 자동으로 적용됩니다.',
        empty: '장바구니가 비어 있습니다. <a href="contact-lenses.html" class="text-[#E0115F] font-medium hover:underline">콘택트렌즈 둘러보기</a>',
        yourCart: "장바구니",
        yourDetails: "배송 정보",
        fullName: "이름",
        dob: "생년월일",
        email: "이메일",
        phone: "전화번호",
        shipBlock: "배송 주소",
        shipHelp: "우편번호로 세금·배송비를 추정합니다. 최종 금액은 주문 확인 시 조정될 수 있습니다.",
        street: "도로명 주소",
        apt: "동·호수",
        optional: "(선택)",
        city: "시",
        state: "주",
        zip: "우편번호",
        selectState: "주 선택",
        rxTitle: "처방전",
        rxHelp: "콘택트렌즈 처방전 사진 또는 스캔(PDF, JPG, PNG, 최대 12MB)을 업로드해 주세요.",
        rxFromCart: "장바구니 단계에서 올린 처방전이 이 주문에 포함됩니다.",
        existingRxTitle: "처방전 보관 중",
        existingRxBody: "이전 방문 시 처방전이 있습니다. 아래 정보를 입력하고 결제를 완료해 주세요. 업로드는 필요 없습니다.",
        orderSummary: "주문 요약",
        subtotal: "소계",
        estTax: "예상 세금",
        delivery: "배송비",
        shipHint: "주와 우편번호를 입력하면 배송비를 추정합니다.",
        total: "합계",
        submit: "주문 제출",
        submitting: "저장 중…",
        introExisting:
          "아래에 연락처를 입력해 주세요. 처방전은 매장에 보관되어 있습니다. 안내된 총액으로 PayPal 또는 카드로 결제해 주세요.",
        introCartRx:
          "연락처를 확인해 주세요. 장바구니에서 올린 처방전이 주문에 포함됩니다. 안내된 총액으로 결제해 주세요.",
        introRestore:
          "주문이 저장되어 있습니다. 아래에서 PayPal 또는 카드로 결제해 주세요. 금액과 주문 번호는 제출하신 내용과 일치합니다.",
        leadDone:
          '아래 <strong class="text-white">결제 금액</strong>을 확인해 주세요. <strong class="text-white">주문 번호</strong>는 PayPal 진행 시 자동으로 전달됩니다.',
        leadRefresh:
          "페이지를 새로 고쳤습니다. 주문 저장 후 장바구니는 비워졌습니다. 아래 결제 링크는 동일한 주문에 해당합니다.",
        leadPostExisting:
          "보관 중인 처방전을 사용합니다. PayPal로 결제하거나 전화·매장에서 카드로 결제할 수 있습니다.",
        leadPostNew:
          "처방전 파일이 이 주문에 저장되었습니다. PayPal로 결제하거나 전화·매장에서 카드로 결제할 수 있습니다.",
        orderReceived: "주문 접수",
        orderNum: "주문 번호",
        amountDue: "결제 금액",
        payTitle: "결제",
        paySecure:
          '위에 표시된 <strong class="text-white font-semibold">정확한 금액</strong>을 결제해 주세요. PayPal은 <strong class="text-white font-semibold">주문 번호와 금액</strong>이 미리 채워집니다. 복사·붙여넣기는 필요 없습니다.',
        methodPaypal: "PayPal",
        methodCard: "신용·체크 카드",
        panelPaypal:
          '계속을 누르면 PayPal이 <strong class="text-white">주문 총액</strong>과 함께 열립니다. 결제 메모는 탭 시 클립보드에 자동 저장됩니다(PayPal이 메모를 요청할 경우).',
        panelCard: "전화 또는 매장 방문 시 카드로 결제해 주세요. 위와 동일한 금액과 주문 번호를 사용해 주세요.",
        continuePaypal: "PayPal로 계속",
        cardInstructions: "전화 또는 매장 — 동일한 금액·주문 번호",
        nextHint: "다음: PayPal 또는 카드 — 주문 번호가 자동 적용됩니다",
        questions:
          '문의? <a href="tel:+12133881447" class="text-[#E0115F] hover:underline">213.388.1447</a> · <a href="contact.html" class="text-[#E0115F] hover:underline">연락</a>',
        backHome: "홈으로",
        errZip: "올바른 우편번호(5자리, 선택적으로 +4)를 입력해 주세요.",
        errRx: "처방전을 업로드해 주세요.",
        errOrder: "주문을 저장하지 못했습니다.",
        errNet: "주문 서버에 연결할 수 없습니다.",
        errTop: "주문 서버에 연결할 수 없습니다",
        errPing:
          "주문 서버({url})에 연결할 수 없습니다. 터미널에서 server 폴더로 이동한 뒤 npm start를 실행하고, 이 페이지를 새로 고침하세요.",
        errFetch:
          "주문 서버({url})에 연결할 수 없습니다. 터미널에서 npm start를 실행한 채로 두세요(Live Server 사용 시에도 동일).",
        errParse: "서버 응답이 올바르지 않습니다(JSON이 아님). 서버가 실행 중인지 확인하세요.",
        onlyLenses: "이 결제는 콘택트렌즈만 가능합니다. 다른 상품을 제거하거나 매장에 문의해 주세요.",
        rxInstructionsCart:
          "장바구니에 렌즈를 담을 때 이미 처방전을 올리셨습니다. 이 주문에 함께 첨부됩니다.",
        rxSidebarOnFile: "처방전: 매장에 보관됨",
        rxSidebarCart: "처방전: 장바구니에서 첨부됨",
        rxSidebarUpload: "처방전: 제출 전 아래에서 업로드",
        rxSidebarAttachedName: "처방전: 첨부됨 ({name})",
        donePricingTpl: "소계 {sub} · 세금 {tax} · {delLabel} {del} · 합계 {tot}",
        paymentLinkErr: "원탭 결제 링크를 위해 js/payment-config.js에 PayPal.me 사용자 이름을 추가하세요.",
        taxEstNote: "세금·배송비는 추정치이며 주문 확인 시 조정될 수 있습니다.",
        secureCheckout: "안전한 결제",
        orderReceivedBadge: "주문 접수됨",
        thProduct: "상품",
        thQty: "수량",
        thPrice: "개당 가격",
        thLine: "소계",
        linesUnavailable: "이 세션에서는 상세 정보를 불러올 수 없습니다. 위의 주문 번호와 금액은 유효합니다.",
        cardPanelBody:
          '전화 또는 매장에서 카드로 결제. <strong class="text-white">주문 번호</strong>와 <strong class="text-white">결제 금액</strong>을 준비해 주세요. 위에 표시된 금액과 동일하게 청구합니다.',
        callPayCard: "전화로 카드 결제",
        cardPanelAddr: "301 S Western Ave #103, Los Angeles, CA 90020",
        paypalBtn: "PayPal.me로 계속",
        doneRxPrefix: "처방전 · ",
        paySecureHosted:
          '위에 표시된 <strong class="text-white font-semibold">정확한 금액</strong>을 결제해 주세요. 카드와 PayPal은 서버 연동 보안 결제를 사용합니다. PayPal.me는 설정 시 주문 번호가 메모에 포함됩니다.',
        panelCardStripe:
          "온라인으로 카드 결제(Visa, Mastercard, Amex 등). Stripe 보안 결제 페이지로 이동합니다.",
        payCardStripe: "카드로 결제",
        orPhoneCard: "또는 전화·매장에서 결제",
        panelPaypalHosted:
          "PayPal에 로그인해 표시된 총액을 승인하면 결제가 완료됩니다.",
        payPaypalHosted: "PayPal로 결제",
        orPaypalMe: "또는 PayPal.me 사용",
        panelPaypalMeNote:
          'PayPal.me가 <strong class="text-white">주문 총액</strong>으로 열립니다. 탭 시 결제 메모가 복사됩니다.',
        paidBannerStripe: "카드 결제가 완료되었습니다. 감사합니다.",
        paidBannerPaypal: "PayPal 결제가 완료되었습니다. 감사합니다.",
        stripeCanceled: "카드 결제가 취소되었습니다. 청구되지 않았습니다.",
        paypalCanceled: "PayPal 결제가 취소되었습니다. 청구되지 않았습니다.",
      },
      product: {
        notFound: "상품을 찾을 수 없습니다.",
        back: "← 콘택트렌즈 전체",
        blurb:
          "처방 공급 단위로 판매됩니다. 기존 고객 여부와 처방 유무를 확인합니다. 신규 고객은 여기서 처방전과 정보를 올리면 결제까지 이어집니다. 기존 고객은 장바구니로 이동한 뒤 결제를 완료합니다.",
        qty: "수량",
        addToCart: "장바구니에 담기",
        lensQTitle: "장바구니에 담기 전에",
        lensQBody: "아이눈 안경원 기존 고객이신가요? 예라면 이전에 저희에게서 시력 처방을 받으신 적이 있나요?",
        yes: "예",
        no: "아니오",
        cancel: "취소",
      },
      cancel: {
        title: "결제 취소",
        body: "결제되지 않았습니다. 장바구니는 그대로입니다.",
        tryAgain: "다시 결제하기",
        viewCart: "장바구니 보기",
      },
      success: {
        kicker: "감사합니다",
        title: "이용해 주셔서 감사합니다",
        body:
          '처방전은 보관되어 있으며, 필요 시 이메일이나 전화로 확인 드립니다. 문의: <a href="tel:+12133881447" class="text-[#E0115F] font-medium no-underline">213.388.1447</a>',
        back: "홈으로",
      },
    },
  };

  function walk(obj, parts) {
    var v = obj;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return null;
      v = v[parts[i]];
    }
    return typeof v === "string" ? v : null;
  }

  function getLang() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s === "ko" || s === "en") return s;
    } catch (e) {}
    return "en";
  }

  function setLang(lang) {
    if (lang !== "en" && lang !== "ko") lang = "en";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    document.documentElement.lang = lang === "ko" ? "ko" : "en";
    document.body.classList.toggle("lang-ko", lang === "ko");
    document.body.classList.toggle("lang-en", lang !== "ko");
    updateLangButtons();
    applyAll();
    try {
      window.dispatchEvent(new CustomEvent("eyenoon-lang-change", { detail: { lang: lang } }));
    } catch (e) {}
  }

  function t(key) {
    var parts = key.split(".");
    var v = walk(STRINGS[getLang()], parts);
    if (v != null) return v;
    v = walk(STRINGS.en, parts);
    return v != null ? v : key;
  }

  function applyEl(el) {
    var hk = el.getAttribute("data-i18n-html");
    if (hk) {
      el.innerHTML = t(hk);
    } else {
      var k = el.getAttribute("data-i18n");
      if (k) el.textContent = t(k);
    }
    var k = el.getAttribute("data-i18n-placeholder");
    if (k) el.setAttribute("placeholder", t(k));
    k = el.getAttribute("data-i18n-aria");
    if (k) el.setAttribute("aria-label", t(k));
    k = el.getAttribute("data-i18n-title");
    if (k) el.setAttribute("title", t(k));
  }

  function applyAll() {
    document.querySelectorAll("[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-aria], [data-i18n-title]").forEach(applyEl);
    var mtk = document.body.getAttribute("data-i18n-title-doc");
    if (mtk) document.title = t(mtk);
  }

  function updateLangButtons() {
    var lang = getLang();
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      var is = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("opacity-100", is);
      btn.classList.toggle("text-[#E0115F]", is);
      btn.classList.toggle("font-bold", is);
      btn.classList.toggle("opacity-55", !is);
      btn.setAttribute("aria-pressed", is ? "true" : "false");
    });
  }

  function injectFont() {
    if (document.getElementById("eyenoon-noto-kr")) return;
    var link = document.createElement("link");
    link.id = "eyenoon-noto-kr";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    var st = document.createElement("style");
    st.id = "eyenoon-lang-style";
    st.textContent =
      "body.lang-ko, body.lang-ko .nav-link, body.lang-ko button, body.lang-ko input, body.lang-ko select { font-family: 'Noto Sans KR', Manrope, sans-serif !important; } " +
      "body.lang-ko .font-display { font-family: 'Noto Sans KR', 'Barlow Condensed', sans-serif !important; letter-spacing: 0.02em; }";
    document.head.appendChild(st);
  }

  function init() {
    injectFont();
    var lang = getLang();
    document.documentElement.lang = lang === "ko" ? "ko" : "en";
    document.body.classList.toggle("lang-ko", lang === "ko");
    document.body.classList.toggle("lang-en", lang !== "ko");

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var l = btn.getAttribute("data-lang");
        if (l) setLang(l);
      });
    });

    applyAll();
    updateLangButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.EyeNoonI18n = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    apply: applyAll,
    STRINGS: STRINGS,
  };
})();
