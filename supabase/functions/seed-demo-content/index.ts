import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Create demo organization ──
    // Check for existing demo org
    let orgId: string;
    const { data: existingOrg } = await admin
      .from("organizations")
      .select("id")
      .eq("name", "სადემონსტრაციო ბანკი")
      .maybeSingle();

    if (existingOrg) {
      orgId = existingOrg.id;
      // Clean up existing data
      await admin.from("certificates").delete().eq("organization_id", orgId);
      await admin.from("quiz_attempts").delete().in("employee_id",
        (await admin.from("employees").select("id").eq("organization_id", orgId)).data?.map((e: any) => e.id) || []
      );
      await admin.from("course_progress").delete().in("employee_id",
        (await admin.from("employees").select("id").eq("organization_id", orgId)).data?.map((e: any) => e.id) || []
      );
      await admin.from("course_assignments").delete().eq("organization_id", orgId);
      await admin.from("quiz_questions").delete().in("course_id",
        (await admin.from("courses").select("id").eq("organization_id", orgId)).data?.map((c: any) => c.id) || []
      );
      await admin.from("course_modules").delete().in("course_id",
        (await admin.from("courses").select("id").eq("organization_id", orgId)).data?.map((c: any) => c.id) || []
      );
      await admin.from("courses").delete().eq("organization_id", orgId);
      console.log("Cleaned existing demo org:", orgId);
    } else {
      const { data: org, error: orgErr } = await admin
        .from("organizations")
        .insert({
          name: "სადემონსტრაციო ბანკი",
          plan: "pilot",
          plan_status: "active",
          industry: "Banking",
          default_language: "ka",
          max_employees: 50,
          plan_started_at: new Date().toISOString(),
          plan_ends_at: new Date(Date.now() + 90 * 86400000).toISOString(),
        })
        .select()
        .single();
      if (orgErr) throw new Error(`Org creation failed: ${orgErr.message}`);
      orgId = org.id;
    }
    console.log("Using org:", orgId);

    // ── 2. Create demo HR admin user ──
    // Get or create HR admin user
    let hrUserId: string;
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingHr = existingUsers?.users?.find((u: any) => u.email === "demo@quali.ge");
    
    if (existingHr) {
      hrUserId = existingHr.id;
    } else {
      const { data: hrUser, error: hrErr } = await admin.auth.admin.createUser({
        email: "demo@quali.ge",
        password: "QualiDemo2024!",
        email_confirm: true,
        user_metadata: {
          full_name: "ნინო კაპანაძე",
          company_name: "სადემონსტრაციო ბანკი",
        },
      });
      if (hrErr) throw new Error(`HR user creation failed: ${hrErr.message}`);
      hrUserId = hrUser.user.id;
    }

    // Update profile with org
    await admin
      .from("profiles")
      .update({ organization_id: orgId })
      .eq("user_id", hrUserId);

    console.log("Created HR admin:", hrUserId);

    // ── 3. Create 3 demo employees ──
    const empData = [
      { email: "employee1@quali.ge", name: "გიორგი მელაძე" },
      { email: "employee2@quali.ge", name: "მარიამ ჯავახიშვილი" },
      { email: "employee3@quali.ge", name: "ლევან ბერიძე" },
    ];

    const employeeIds: string[] = [];
    const userIds: string[] = [];

    for (const emp of empData) {
      // Check if user already exists
      const existingEmpUser = existingUsers?.users?.find((u: any) => u.email === emp.email);
      let empUserId: string;
      
      if (existingEmpUser) {
        empUserId = existingEmpUser.id;
      } else {
        const { data: u, error: uErr } = await admin.auth.admin.createUser({
          email: emp.email,
          password: "QualiDemo2024!",
          email_confirm: true,
          user_metadata: {
            full_name: emp.name,
            role: "employee",
            organization_id: orgId,
          },
        });
        if (uErr) throw new Error(`Employee user creation failed: ${uErr.message}`);
        empUserId = u.user.id;
      }
      userIds.push(empUserId);

      // The handle_new_user trigger should have created employee record
      // But let's ensure it by fetching
      const { data: empRec } = await admin
        .from("employees")
        .select("id")
        .eq("email", emp.email)
        .eq("organization_id", orgId)
        .single();

      if (empRec) {
        employeeIds.push(empRec.id);
      } else {
        // Insert manually if trigger didn't fire (employee wasn't pre-invited)
        const { data: newEmp } = await admin
          .from("employees")
          .insert({
            email: emp.email,
            full_name: emp.name,
            organization_id: orgId,
            user_id: empUserId,
            status: "active",
            department: "საბანკო ოპერაციები",
            joined_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (newEmp) employeeIds.push(newEmp.id);
        
        // Ensure profile + role
        await admin.from("profiles").upsert({
          user_id: empUserId,
          full_name: emp.name,
          organization_id: orgId,
        }, { onConflict: "user_id" });
        
        await admin.from("user_roles").upsert({
          user_id: empUserId,
          role: "employee",
        }, { onConflict: "user_id,role" });
      }
    }

    console.log("Created employees:", employeeIds);

    // ── 4. COURSE 1 — AML ──
    const { data: course1 } = await admin
      .from("courses")
      .insert({
        title: "ფულის გათეთრების წინააღმდეგ ბრძოლა",
        description: "ეს კურსი მოიცავს ფულის გათეთრების პრევენციის ძირითად პრინციპებს საქართველოს საბანკო სექტორში. სტუდენტები შეისწავლიან საეჭვო ტრანზაქციების იდენტიფიცირებას, სავალდებულო ანგარიშგებას და საქართველოს ეროვნული ბანკის მოთხოვნებს.",
        category: "Compliance",
        language: "ka",
        duration_minutes: 45,
        generation_method: "ai_prompt",
        organization_id: orgId,
        created_by: hrUserId,
        status: "published",
        learning_objectives: [
          "ფულის გათეთრების სამი ძირითადი ეტაპის განმარტება",
          "საეჭვო ტრანზაქციების ამოცნობა და შეტყობინება",
          "საქართველოს კანონმდებლობის მოთხოვნების გაგება",
          "სავალდებულო KYC პროცედურების განხორციელება",
          "შიდა კონტროლის მექანიზმების გამოყენება",
        ],
      })
      .select()
      .single();

    const c1Id = course1!.id;

    // Course 1 Modules
    const c1Modules = [
      {
        course_id: c1Id,
        module_number: 1,
        title: "ფულის გათეთრება — ზოგადი მიმოხილვა",
        content: "ფულის გათეთრება არის პროცესი, რომლის დროსაც დანაშაულებრივი გზით მიღებული თანხები კანონიერ შემოსავლად გამოიყურება. საქართველოს კანონმდებლობის თანახმად, ფულის გათეთრება სერიოზული სისხლის სამართლის დანაშაულია, რომელიც ისჯება თავისუფლების აღკვეთით 7-დან 15 წლამდე ვადით. ბანკები, როგორც ფინანსური სისტემის მთავარი მონაწილეები, განსაკუთრებულ პასუხისმგებლობას ატარებენ ამ დანაშაულის პრევენციაში. საქართველოს ეროვნული ბანკის 2023 წლის რეგულაციების თანახმად, ყველა კომერციული ბანკი ვალდებულია დანერგოს ეფექტური AML სისტემა. ფულის გათეთრება ხდება სამი ძირითადი ეტაპით: განთავსება (placement) — უკანონო თანხის ფინანსურ სისტემაში შეყვანა; შენიღბვა (layering) — თანხის წარმოშობის კვალის წაშლა მრავალჯერადი ტრანზაქციებით; ინტეგრაცია (integration) — გათეთრებული თანხის კანონიერ ეკონომიკაში დაბრუნება. თითოეული ბანკის თანამშრომელი, განურჩევლად პოზიციისა, ვალდებულია იცოდეს ამ ეტაპების მახასიათებლები და შეძლოს საეჭვო ქცევის ამოცნობა ყოველდღიურ სამუშაოში.",
        key_points: [
          "ფულის გათეთრება სამ ეტაპად მიმდინარეობს: განთავსება, შენიღბვა, ინტეგრაცია",
          "საქართველოს ეროვნული ბანკი ავალდებულებს ყველა ბანკს AML სისტემის დანერგვას",
          "სასჯელი: 7-დან 15 წლამდე თავისუფლების აღკვეთა",
          "ყველა თანამშრომელი პასუხისმგებელია საეჭვო ქცევის იდენტიფიცირებაზე",
        ],
      },
      {
        course_id: c1Id,
        module_number: 2,
        title: "საეჭვო ტრანზაქციების იდენტიფიცირება",
        content: "საეჭვო ტრანზაქციის ამოცნობა ბანკის თანამშრომლის ყველაზე მნიშვნელოვანი AML უნარია. საეჭვო ტრანზაქცია არ ნიშნავს აუცილებლად უკანონო ტრანზაქციას — ეს ნიშნავს ტრანზაქციას, რომელიც არ შეესაბამება კლიენტის ჩვეულებრივ ქცევას ან საქმიანობას. ძირითადი გამაფრთხილებელი ნიშნები მოიცავს: არაჩვეულებრივად დიდი ნაღდი ფულის ოპერაციები — განსაკუთრებით 10,000 ლარზე მეტი ოდენობით; ხშირი, მცირე ოდენობის ტრანზაქციები, რომლებიც ერთად 10,000 ლარს აღწევს (სტრუქტურირება); კლიენტი იჩენს ინტერესს AML პროცედურების გვერდის ავლისადმი; ტრანზაქციის მიზანი ან ბენეფიციარი გაურკვეველია; კლიენტი ცდილობს იდენტიფიკაციის გარეშე ოპერაციის ჩატარებას. საქართველოში სავალდებულოა ყველა ნაღდი ოპერაციის შეტყობინება, რომელიც 30,000 ლარს აღემატება. ეს შეტყობინება წარედგინება საქართველოს ფინანსური მონიტორინგის სამსახურს (FMSG) ოპერაციის ჩატარებიდან 3 სამუშაო დღის განმავლობაში.",
        key_points: [
          "30,000 ლარზე მეტი ნაღდი ოპერაცია სავალდებულო შეტყობინებას ექვემდებარება",
          "შეტყობინება წარდგენილ უნდა იქნეს FMSG-ში 3 დღის განმავლობაში",
          "სტრუქტურირება — განზრახ გაყოფა ლიმიტის გვერდის ავლისთვის — დანაშაულია",
          "საეჭვო ქცევა არ ნიშნავს აუცილებლად დანაშაულს — მოითხოვს გადამოწმებას",
        ],
      },
      {
        course_id: c1Id,
        module_number: 3,
        title: "KYC — კლიენტის იდენტიფიცირება და გადამოწმება",
        content: "KYC (Know Your Customer — იცოდე შენი კლიენტი) არის AML სისტემის საფუძველი. საქართველოს კანონმდებლობა ავალდებულებს ბანკებს კლიენტის სრულ იდენტიფიკაციას ანგარიშის გახსნამდე და ურთიერთობის განმავლობაში. სტანდარტული KYC პროცედურა მოიცავს: პირადობის დამადასტურებელი დოკუმენტის გადამოწმება (პასპორტი ან პირადობის მოწმობა); საცხოვრებელი მისამართის დადასტურება; შემოსავლის წყაროს დადასტურება — 50,000 ლარზე მეტი ოპერაციებისთვის; PEP (პოლიტიკურად მოწყვლადი პირი) სტატუსის შემოწმება; სანქციების სიაში გადამოწმება. გაძლიერებული გულმოდგინება (Enhanced Due Diligence) სავალდებულოა მაღალი რისკის კლიენტებისთვის, მათ შორის: PEP პირები და მათი ოჯახის წევრები; მაღალი რისკის ქვეყნებიდან კლიენტები; კომპლექსური საკუთრებით კომპანიები; კლიენტები, რომლებმაც ადრე გამოიწვიეს საეჭვო შეტყობინებები. KYC ინფორმაცია უნდა განახლდეს რეგულარულად — ფიზიკური პირებისთვის ყოველ 2 წელიწადში, იურიდიული პირებისთვის ყოველ წელიწადში.",
        key_points: [
          "KYC სავალდებულოა ყველა ახალი კლიენტისთვის ანგარიშის გახსნამდე",
          "PEP პირები მოითხოვს გაძლიერებულ გადამოწმებას",
          "KYC ინფორმაციის განახლება ხდება ყოველ 1-2 წელიწადში",
          "სანქციების სიაში შემოწმება სავალდებულოა",
        ],
      },
      {
        course_id: c1Id,
        module_number: 4,
        title: "შიდა შეტყობინება და ანგარიშგება",
        content: "როდესაც ბანკის თანამშრომელი აიდენტიფიცირებს საეჭვო ტრანზაქციას, მან დაუყოვნებლივ უნდა მიმართოს ბანკის შიდა AML ოფიცერს. შიდა შეტყობინება არ ნიშნავს კლიენტისთვის ოპერაციის შეჩერებას — ეს ნიშნავს ინფორმაციის გადაცემას კომპეტენტური პირისთვის გადაწყვეტილების მისაღებად. შიდა შეტყობინების პროცედურა: 1. შეავსეთ შიდა SAR (Suspicious Activity Report) ფორმა — ხელმისაწვდომია ბანკის ინტრანეტზე; 2. მიუთითეთ კონკრეტული ფაქტები — ეჭვის საფუძველი, ტრანზაქციის დეტალები, კლიენტის ქცევა; 3. გადაეცით AML ოფიცერს 24 საათის განმავლობაში; 4. შეინახეთ კონფიდენციალობა — არ აცნობოთ კლიენტს. კრიტიკულად მნიშვნელოვანია: არასდროს გააფრთხილოთ კლიენტი, რომ ის შეტყობინებაშია (Tipping Off). ეს სისხლის სამართლის დანაშაულია საქართველოს კანონმდებლობით. AML ოფიცერი გადაწყვეტს, გადაეგზავნოს თუ არა შეტყობინება FMSG-ს. ბანკის თანამშრომელს იმუნიტეტი აქვს პასუხისმგებლობისგან, თუ კეთილსინდისიერად მოახდინა შეტყობინება, თუნდაც ეჭვი გაუმართლებელი აღმოჩნდეს.",
        key_points: [
          "შიდა SAR ფორმა შევსებული უნდა იქნეს 24 საათის განმავლობაში",
          "კლიენტის გაფრთხილება (Tipping Off) სისხლის სამართლის დანაშაულია",
          "კეთილსინდისიერი შეტყობინება იძლევა სამართლებრივ იმუნიტეტს",
          "AML ოფიცერი იღებს საბოლოო გადაწყვეტილებას FMSG შეტყობინებაზე",
        ],
      },
      {
        course_id: c1Id,
        module_number: 5,
        title: "პრაქტიკული სცენარები და შემთხვევების ანალიზი",
        content: "ამ მოდულში განვიხილავთ რეალურ სცენარებს, რომლებსაც ბანკის თანამშრომლები ყოველდღიურ სამუშაოში ხვდებიან. სცენარი 1: კლიენტი სალაროში. ახალი კლიენტი სალაროში გამოცხადდა 25,000 ლარის ნაღდი ანაბრით. კითხვაზე, საიდან არის ეს თანხა, კლიენტი ამბობს, რომ მიიღო სახლის გაყიდვიდან, თუმცა ვერ წარადგენს დოკუმენტს. სწორი მოქმედება: მიიღეთ ანაბარი (25,000 ლარი 30,000-ის ლიმიტს ქვემოთ), მაგრამ შეავსეთ შიდა SAR ფორმა და გადეცით AML ოფიცერს. სცენარი 2: ინტერნეტ-ბანკინგი. VIP კლიენტი ჩვეულებრივ თვეში 5,000-10,000 ლარს ატარებს. ამ თვეში მან 15 ტრანზაქცია განახორციელა — თითოეული 9,500 ლარი — სხვადასხვა ანგარიშებზე. ეს კლასიკური სტრუქტურირებაა. სწორი მოქმედება: დაუყოვნებლივ შეატყობინეთ AML ოფიცერს. სცენარი 3: კორპორატიული კლიენტი. ახლად დარეგისტრირებული კომპანია ითხოვს ანგარიშის გახსნას და პირველ დღეს 500,000 ლარის ტრანზაქციის ჩატარებას. სწორი მოქმედება: სავალდებულოა გაძლიერებული KYC — კომპანიის მფლობელობის სრული გამჭვირვალობა, ბიზნეს საქმიანობის დოკუმენტაცია, თანხის წყაროს დადასტურება.",
        key_points: [
          "ლიმიტის ქვემოთ ტრანზაქციებიც შეიძლება საეჭვო იყოს სტრუქტურირების ნიშნების გამო",
          "VIP კლიენტებიც ექვემდებარებიან AML მოთხოვნებს",
          "ახალი კომპანიები მსხვილი ტრანზაქციებით მოითხოვს გაძლიერებულ KYC-ს",
          "ყოველ საეჭვო შემთხვევაში მიმართეთ AML ოფიცერს — არ გადაწყვიტოთ მარტო",
        ],
      },
    ];

    await admin.from("course_modules").insert(c1Modules);

    // Course 1 Quiz
    const c1Quiz = [
      { course_id: c1Id, question_number: 1, question: "რა არის ფულის გათეთრების პირველი ეტაპი?", options: ["A. განთავსება (Placement)", "B. შენიღბვა (Layering)", "C. ინტეგრაცია (Integration)", "D. სეგრეგაცია (Segregation)"], correct_answer: "A", explanation: "განთავსება არის პირველი ეტაპი, სადაც უკანონო თანხა პირველად შედის ფინანსურ სისტემაში.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 2, question: "რა ოდენობის ნაღდი ოპერაცია ექვემდებარება სავალდებულო შეტყობინებას საქართველოში?", options: ["A. 10,000 ლარი", "B. 20,000 ლარი", "C. 30,000 ლარი", "D. 50,000 ლარი"], correct_answer: "C", explanation: "საქართველოს კანონმდებლობის მიხედვით, 30,000 ლარზე მეტი ნაღდი ოპერაცია სავალდებულო შეტყობინებას ექვემდებარება FMSG-ში.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 3, question: "რამდენ დღეში უნდა წარედგინოს შეტყობინება FMSG-ს?", options: ["A. 1 სამუშაო დღე", "B. 3 სამუშაო დღე", "C. 5 სამუშაო დღე", "D. 7 სამუშაო დღე"], correct_answer: "B", explanation: "საქართველოს კანონი ავალდებულებს FMSG-ში შეტყობინების წარდგენას ოპერაციიდან 3 სამუშაო დღის განმავლობაში.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 4, question: "რას ნიშნავს Tipping Off?", options: ["A. ახალი კლიენტის შეტყობინება", "B. კლიენტის გაფრთხილება SAR შეტყობინების შესახებ", "C. AML ოფიცრის ინფორმირება", "D. FMSG-ს შეტყობინება"], correct_answer: "B", explanation: "Tipping Off ნიშნავს კლიენტის გაფრთხილებას, რომ ის SAR შეტყობინებაში მოხვდა. ეს სისხლის სამართლის დანაშაულია.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 5, question: "რა არის KYC?", options: ["A. ბანკის შიდა ინსტრუქცია", "B. კლიენტის იდენტიფიკაციისა და გადამოწმების პროცედურა", "C. ტრანზაქციის მონიტორინგის სისტემა", "D. საბანკო ლიცენზიის სახეობა"], correct_answer: "B", explanation: "KYC (Know Your Customer) არის კლიენტის იდენტიფიკაციისა და გადამოწმების სავალდებულო პროცედურა.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 6, question: "რომელ კლიენტს სჭირდება გაძლიერებული გულმოდგინება (EDD)?", options: ["A. ყველა კლიენტს", "B. მხოლოდ იურიდიულ პირებს", "C. PEP პირებს და მაღალი რისკის კლიენტებს", "D. მხოლოდ 50,000 ლარზე მეტი ოპერაციის შემთხვევაში"], correct_answer: "C", explanation: "გაძლიერებული გულმოდგინება სავალდებულოა PEP პირებისთვის, მაღალი რისკის ქვეყნების კლიენტებისთვის და სხვა მაღალი რისკის კატეგორიებისთვის.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 7, question: "კლიენტი ახდენს 10 ტრანზაქციას — თითოეული 9,500 ლარი — ერთ დღეში. ეს არის:", options: ["A. ჩვეულებრივი ბანკინგი", "B. სტრუქტურირება", "C. ლეგიტიმური ბიზნეს საქმიანობა", "D. VIP მომსახურება"], correct_answer: "B", explanation: "სტრუქტურირება ნიშნავს განზრახ გაყოფას მცირე ტრანზაქციებად ლიმიტის გვერდის ავლის მიზნით.", question_type: "scenario", scenario: "კლიენტი ახდენს 10 ტრანზაქციას — თითოეული 9,500 ლარი — ერთ დღეში სხვადასხვა ანგარიშებზე." },
      { course_id: c1Id, question_number: 8, question: "რამდენ ხანში უნდა განახლდეს ფიზიკური პირის KYC ინფორმაცია?", options: ["A. ყოველ 6 თვეში", "B. ყოველ წელიწადში", "C. ყოველ 2 წელიწადში", "D. ყოველ 5 წელიწადში"], correct_answer: "C", explanation: "ფიზიკური პირების KYC ინფორმაცია განახლდება ყოველ 2 წელიწადში, იურიდიული პირებისა კი ყოველ წელიწადში.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 9, question: "ბანკის თანამშრომელმა კეთილსინდისიერად შეატყობინა საეჭვო ოპერაცია, მაგრამ ეჭვი გაუმართლებელი აღმოჩნდა. რა ემუქრება თანამშრომელს?", options: ["A. გათავისუფლება", "B. ჯარიმა", "C. სისხლის სამართლებრივი პასუხისმგებლობა", "D. არაფერი — მას აქვს სამართლებრივი იმუნიტეტი"], correct_answer: "D", explanation: "კეთილსინდისიერი შეტყობინება იძლევა სრულ სამართლებრივ იმუნიტეტს.", question_type: "multiple_choice" },
      { course_id: c1Id, question_number: 10, question: "ახალი კლიენტი 25,000 ლარის ნაღდ ანაბარს ახდენს და ვერ ადასტურებს წყაროს. თქვენი სწორი მოქმედება:", options: ["A. უარი ეთქვით ოპერაციაზე", "B. მიიღეთ ანაბარი და შეავსეთ შიდა SAR ფორმა", "C. დაუყოვნებლივ დაურეკეთ პოლიციას", "D. კლიენტს სთხოვეთ მოგვიანებით მოსვლა"], correct_answer: "B", explanation: "25,000 ლარი 30,000-ის სავალდებულო ლიმიტს ქვემოთია, ამიტომ ოპერაციის შეჩერება გაუმართლებელია. სწორია ოპერაციის მიღება და შიდა SAR ფორმის შევსება.", question_type: "scenario", scenario: "ახალი კლიენტი სალაროში გამოცხადდა 25,000 ლარის ნაღდი ანაბრით და ვერ ადასტურებს თანხის წყაროს." },
    ];

    await admin.from("quiz_questions").insert(c1Quiz);

    // ── 5. COURSE 2 — Cybersecurity ──
    const { data: course2 } = await admin
      .from("courses")
      .insert({
        title: "კიბერუსაფრთხოება საბანკო სექტორში",
        description: "კურსი მოიცავს კიბერუსაფრთხოების ძირითად საფრთხეებს საბანკო სექტორში, ფიშინგის ამოცნობას, პაროლების სწორ მართვას და მონაცემების დაცვის პრაქტიკულ მეთოდებს.",
        category: "IT Security",
        language: "ka",
        duration_minutes: 35,
        generation_method: "ai_prompt",
        organization_id: orgId,
        created_by: hrUserId,
        status: "published",
        learning_objectives: [
          "ფიშინგის და სოციალური ინჟინერიის შეტევების ამოცნობა",
          "პაროლების სწორი შექმნა და მართვა",
          "მონაცემების კლასიფიკაცია და დაცვა",
          "კიბერინციდენტის შეტყობინების პროცედურები",
          "უსაფრთხო სამუშაო ჩვევების ჩამოყალიბება",
        ],
      })
      .select()
      .single();

    const c2Id = course2!.id;

    const c2Modules = [
      {
        course_id: c2Id,
        module_number: 1,
        title: "კიბერსაფრთხეები საბანკო სექტორში",
        content: "საბანკო სექტორი კიბერდამნაშავეების მთავარი სამიზნეა, რადგანაც ბანკები ინახავენ ფინანსურ მონაცემებს და ახორციელებენ მსხვილ ფულად ტრანზაქციებს. 2023 წელს მსოფლიო ბანკების 70%-ზე მეტი კიბერშეტევის მსხვერპლი გახდა. ძირითადი კიბერსაფრთხეები საბანკო სექტორში: ფიშინგი — ყალბი ელ-ფოსტა და ვებსაიტები, რომლებიც ბანკის სახელით ითხოვენ პაროლებს; რანსომვეარი — მავნე პროგრამა, რომელიც შიფრავს ბანკის მონაცემებს და ითხოვს გამოსყიდვას; სოციალური ინჟინერია — ფსიქოლოგიური მანიპულაცია თანამშრომლების მოსატყუებლად; ინსაიდერული საფრთხე — თანამშრომლების მიერ განზრახ ან უნებლიე მონაცემების გაჟონვა; Man-in-the-Middle შეტევები — ტრანზაქციების ჩარევა და მანიპულაცია. საქართველოს ეროვნული ბანკის 2022 წლის კიბერუსაფრთხოების სტანდარტების მიხედვით, ყველა კომერციული ბანკი ვალდებულია კვარტალური კიბერ-სწავლება ჩაუტაროს თანამშრომლებს.",
        key_points: [
          "საბანკო სექტორი კიბერდამნაშავეების მთავარი სამიზნეა",
          "ფიშინგი ყველაზე გავრცელებული შეტევის მეთოდია",
          "ეროვნული ბანკი ავალდებულებს კვარტალურ კიბერ-სწავლებებს",
          "ინსაიდერული საფრთხე ხშირად არაგანზრახია",
        ],
      },
      {
        course_id: c2Id,
        module_number: 2,
        title: "ფიშინგის ამოცნობა და პრევენცია",
        content: "ფიშინგი არის კიბერშეტევის ყველაზე გავრცელებული ფორმა. თავდამსხმელები გზავნიან ყალბ ელ-ფოსტებს, რომლებიც გარეგნულად ლეგიტიმური ბანკის ან ორგანიზაციის შეტყობინებებს ჰგავს. ფიშინგის ძირითადი ნიშნები: გამგზავნის მისამართი ოდნავ განსხვავდება ოფიციალური მისამართისგან (მაგ. support@bog-georgia.com ნაცვლად support@bog.ge); ელ-ფოსტა ქმნის სასწრაფოობის განცდას — \"დაუყოვნებლივ შეიყვანეთ პაროლი ან ანგარიში დაიბლოკება\"; ბმული მიუთითებს სხვა ვებსაიტზე — დაასვენეთ კურსორი ბმულზე URL-ის სანახავად; მოითხოვს პაროლს, PIN-ს ან პირად ინფორმაციას; ელ-ფოსტა შეიცავს გრამატიკულ შეცდომებს. Spear Phishing — მიზნობრივი ფიშინგი — ბევრად საშიშია. თავდამსხმელი ამოიკვლევს თქვენ შესახებ ინფორმაციას სოციალური მედიიდან და პირადობით გზავნის დამაჯერებელ შეტყობინებას. ბანკის IT დეპარტამენტი არასოდეს გამოითხოვს პაროლს ელ-ფოსტით. თუ ეჭვი გეპარებათ — დაურეკეთ IT სამსახურს პირდაპირ.",
        key_points: [
          "შეამოწმეთ გამგზავნის ელ-ფოსტის მისამართი ყურადღებით",
          "ბანკის IT სამსახური არასოდეს ითხოვს პაროლს ელ-ფოსტით",
          "სასწრაფოობის განცდა ფიშინგის კლასიკური ნიშანია",
          "ეჭვის შემთხვევაში დაურეკეთ IT სამსახურს პირდაპირ",
        ],
      },
      {
        course_id: c2Id,
        module_number: 3,
        title: "პაროლების უსაფრთხო მართვა",
        content: "სუსტი პაროლი კიბერშეტევის მთავარი კარია. კვლევების მიხედვით, კიბერინციდენტების 80%-ზე მეტი სუსტი ან მოპარული პაროლების გამო ხდება. ძლიერი პაროლის კრიტერიუმები: მინიმუმ 12 სიმბოლო; დიდი და პატარა ასოების კომბინაცია; რიცხვები და სპეციალური სიმბოლოები (!@#$%); სიტყვა, რომელიც ლექსიკონში არ მოიპოვება. პაროლების სახელმძღვანელო წესები: სხვადასხვა სისტემისთვის — სხვადასხვა პაროლი; პაროლი არ უნდა შეიცავდეს პირად ინფორმაციას (სახელი, დაბადების თარიღი); პაროლი არ უნდა გაუზიაროთ კოლეგებს — თუნდაც მენეჯერს; გამოიყენეთ პაროლების მენეჯერი (Password Manager); ჩართეთ ორფაქტორიანი ავთენტიფიკაცია (2FA) ყველა სისტემაში. ბანკის სისტემებში პაროლი უნდა შეიცვალოს ყოველ 90 დღეში. თუ ეჭვი გეპარებათ, რომ პაროლი კომპრომეტირებულია — დაუყოვნებლივ შეცვალეთ და აცნობეთ IT სამსახურს.",
        key_points: [
          "პაროლი მინიმუმ 12 სიმბოლო, რთული კომბინაცია",
          "სხვადასხვა სისტემისთვის სხვადასხვა პაროლი",
          "პაროლი არ გაუზიაროთ არავის — მათ შორის მენეჯერს",
          "ბანკის სისტემებში პაროლი იცვლება 90 დღეში ერთხელ",
        ],
      },
    ];

    await admin.from("course_modules").insert(c2Modules);

    const c2Quiz = [
      { course_id: c2Id, question_number: 1, question: "რომელია ფიშინგის ყველაზე გავრცელებული ნიშანი?", options: ["A. ლამაზი დიზაინი", "B. სასწრაფოობის განცდა და პაროლის მოთხოვნა", "C. ქართული ენა", "D. ბანკის ლოგო"], correct_answer: "B", explanation: "ფიშინგი ყოველთვის ქმნის სასწრაფოობის განცდას და ითხოვს სენსიტიურ ინფორმაციას.", question_type: "multiple_choice" },
      { course_id: c2Id, question_number: 2, question: "ბანკის IT სამსახური ელ-ფოსტით ითხოვს თქვენს პაროლს. თქვენი მოქმედება:", options: ["A. გაუგზავნეთ პაროლი", "B. დაუყოვნებლივ დაურეკეთ IT სამსახურს", "C. შეცვალეთ პაროლი და გაუგზავნეთ ახალი", "D. გადადით ელ-ფოსტაში მითითებულ ბმულზე"], correct_answer: "B", explanation: "IT სამსახური არასოდეს ითხოვს პაროლს ელ-ფოსტით. ეს ფიშინგის ნიშანია.", question_type: "scenario", scenario: "ბანკის IT დეპარტამენტის სახელით მოგივიდათ ელ-ფოსტა, სადაც სასწრაფოდ ითხოვენ პაროლის გაგზავნას." },
      { course_id: c2Id, question_number: 3, question: "რამდენ დღეში უნდა შეიცვალოს პაროლი ბანკის სისტემებში?", options: ["A. 30 დღეში", "B. 60 დღეში", "C. 90 დღეში", "D. 180 დღეში"], correct_answer: "C", explanation: "ბანკის უსაფრთხოების სტანდარტების მიხედვით, პაროლი იცვლება ყოველ 90 დღეში.", question_type: "multiple_choice" },
      { course_id: c2Id, question_number: 4, question: "რომელია ძლიერი პაროლის მაგალითი?", options: ["A. giorgi1990", "B. Bank2024", "C. Kv@l!ge#2024$", "D. password123"], correct_answer: "C", explanation: "ძლიერი პაროლი შეიცავს დიდ და პატარა ასოებს, რიცხვებს და სპეციალურ სიმბოლოებს, მინიმუმ 12 სიმბოლო.", question_type: "multiple_choice" },
      { course_id: c2Id, question_number: 5, question: "რა არის სოციალური ინჟინერია კიბერუსაფრთხოების კონტექსტში?", options: ["A. სოციალური მედიის გამოყენება", "B. ფსიქოლოგიური მანიპულაცია ინფორმაციის მოსაპოვებლად", "C. ბანკის სოციალური პროგრამები", "D. თანამშრომელთა ტრენინგი"], correct_answer: "B", explanation: "სოციალური ინჟინერია არის ფსიქოლოგიური მანიპულაციის მეთოდი, სადაც თავდამსხმელი ატყუებს თანამშრომელს სენსიტიური ინფორმაციის გასაზიარებლად.", question_type: "multiple_choice" },
      { course_id: c2Id, question_number: 6, question: "შეგიძლიათ გაუზიაროთ პაროლი კოლეგას, თუ ის ითხოვს სასწრაფო სამუშაოს შესასრულებლად?", options: ["A. დიახ, სასწრაფო შემთხვევაში", "B. დიახ, მხოლოდ მენეჯერს", "C. არა, არასოდეს", "D. დიახ, სამუშაო საათების შემდეგ"], correct_answer: "C", explanation: "პაროლი არ უნდა გაუზიაროთ არავის — თუნდაც მენეჯერს ან კოლეგას.", question_type: "multiple_choice" },
      { course_id: c2Id, question_number: 7, question: "ეროვნული ბანკის მოთხოვნით, კომერციული ბანკები ვალდებულნი არიან კიბერ-სწავლება ჩაუტარონ თანამშრომლებს:", options: ["A. წელიწადში ერთხელ", "B. კვარტალში ერთხელ", "C. ყოველ თვე", "D. მხოლოდ ახალ თანამშრომლებს"], correct_answer: "B", explanation: "საქართველოს ეროვნული ბანკის 2022 წლის სტანდარტების მიხედვით, სავალდებულოა კვარტალური კიბერ-სწავლება.", question_type: "multiple_choice" },
      { course_id: c2Id, question_number: 8, question: "თქვენ მიხვდით, რომ შეიძლება ფიშინგ ელ-ფოსტაზე გადახვედით. თქვენი პირველი მოქმედება:", options: ["A. კომპიუტერის გამორთვა", "B. დაუყოვნებლივ შეატყობინეთ IT სამსახურს და შეცვალეთ პაროლი", "C. დაელოდეთ და ნახეთ რა მოხდება", "D. ანტივირუსის გაშვება"], correct_answer: "B", explanation: "კიბერინციდენტის შემთხვევაში პირველი ნაბიჯია IT სამსახურის დაუყოვნებელი ინფორმირება და პაროლის შეცვლა.", question_type: "scenario", scenario: "თქვენ მიხვდით რომ ფიშინგ ელ-ფოსტაში მითითებულ ბმულზე გადახვედით და შეიძლება თქვენი მონაცემები კომპრომეტირებულია." },
    ];

    await admin.from("quiz_questions").insert(c2Quiz);

    // ── 6. COURSE 3 — Customer Service ──
    const { data: course3 } = await admin
      .from("courses")
      .insert({
        title: "მომხმარებლის მომსახურების სტანდარტები",
        description: "კურსი მოიცავს პროფესიული საბანკო მომსახურების სტანდარტებს, ეფექტური კომუნიკაციის მეთოდებს, რთულ სიტუაციებში მოქმედებას და კლიენტის კმაყოფილების უზრუნველყოფის პრაქტიკულ უნარებს.",
        category: "Customer Service",
        language: "ka",
        duration_minutes: 40,
        generation_method: "ai_prompt",
        organization_id: orgId,
        created_by: hrUserId,
        status: "published",
        learning_objectives: [
          "პროფესიული კომუნიკაციის სტანდარტების გამოყენება",
          "კლიენტის საჭიროებების სწორი იდენტიფიცირება",
          "რთულ სიტუაციებში ეფექტური მოქმედება",
          "ტელეფონის ეტიკეტის დაცვა",
          "კლიენტის საჩივრის პროფესიული განხილვა",
        ],
      })
      .select()
      .single();

    const c3Id = course3!.id;

    const c3Modules = [
      {
        course_id: c3Id,
        module_number: 1,
        title: "პროფესიული კომუნიკაციის საფუძვლები",
        content: "საბანკო მომსახურება მოითხოვს კომუნიკაციის უმაღლეს სტანდარტებს. კლიენტი ბანკს ენდობა ყველაზე მნიშვნელოვანი ფინანსური საქმეების მართვას — ეს ნდობა უნდა გამოვლინდეს ყოველ ურთიერთობაში. პროფესიული მისალმება: კლიენტის მიდგომისთანავე მოახდინეთ კონტაქტი თვალებით, გაუღიმეთ და მიესალმეთ: \"გამარჯობა, რითი შეგიძლია გემსახუროთ?\" ყოველთვის გამოიყენეთ \"თქვენ\" ფორმა — არა \"შენ\". ყოველი კლიენტი, ასაკის მიუხედავად, \"თქვენ\"-ით მოიხსენიება. სმენის ეტიკეტი: ნუ შეაწყვეტთ კლიენტს; გამოიყენეთ დამადასტურებელი სიტყვები \"გასაგებია\", \"რა თქმა უნდა\"; ჩანიშნეთ ძირითადი პუნქტები. ფიზიკური გარემო: სამუშაო ადგილი სუფთა და მოწყობილი; პირადი ტელეფონი სამუშაო საათებში ჩუმ რეჟიმში; ფარდობა: კლიენტს 70% დრო ვუსმენთ, 30% ვსაუბრობთ.",
        key_points: [
          "ყოველთვის გამოიყენეთ \"თქვენ\" ფორმა ყველა კლიენტთან",
          "კლიენტის შეწყვეტა პროფესიული შეცდომაა",
          "70-30 წესი: მეტი მოსმენა, ნაკლები საუბარი",
          "პირველი შთაბეჭდილება 7 წამში ყალიბდება",
        ],
      },
      {
        course_id: c3Id,
        module_number: 2,
        title: "რთული სიტუაციები და საჩივრების მართვა",
        content: "კლიენტის საჩივარი არ არის პრობლემა — ეს შესაძლებლობაა ნდობის განსამტკიცებლად. კვლევები გვიჩვენებს, რომ სწორად გადაჭრილი საჩივრის შემდეგ კლიენტის ლოიალობა იზრდება. საჩივრის მართვის 5 ეტაპი (LEARN მოდელი): Listen — მოუსმინეთ სრულად, ნუ შეაწყვეტთ; Empathize — გამოხატეთ გაგება: \"გესმის, ეს ნამდვილად შემაწუხებელია\"; Apologize — ბოდიში მოიხადეთ სიტუაციის გამო, თუნდაც თქვენი ბრალი არ იყოს; Resolve — შესთავაზეთ კონკრეტული გადაწყვეტა ან ვადა; Notify — შეატყობინეთ კლიენტს შედეგი დანიშნულ ვადაში. აკრძალული ფრაზები: \"ეს ჩვენი პოლიტიკაა\" (კლიენტს არ აინტერესებს); \"ეს ჩემი პრობლემა არ არის\" (ბანკის ყოველი თანამშრომელი პასუხისმგებელია); \"კომპიუტერი ასე ამბობს\" (ეს კლიენტს არ ეხმარება). გაბრაზებული კლიენტი: შეინარჩუნეთ სიმშვიდე, ხმა არ აუმაღლოთ, მოუსმინეთ სრულად — ბრაზი ხშირად მცირდება, როდესაც კლიენტი გაიგებს, რომ გუისმენთ.",
        key_points: [
          "საჩივარი შესაძლებლობაა — არა პრობლემა",
          "LEARN მოდელი: Listen, Empathize, Apologize, Resolve, Notify",
          "\"ეს ჩვენი პოლიტიკაა\" — აკრძალული ფრაზაა",
          "გაბრაზებულ კლიენტთან ხმა არ ამაღლოთ",
        ],
      },
    ];

    await admin.from("course_modules").insert(c3Modules);

    const c3Quiz = [
      { course_id: c3Id, question_number: 1, question: "რომელ მიმართვის ფორმას უნდა გამოიყენოთ ყველა კლიენტთან?", options: ["A. შენ", "B. თქვენ", "C. სახელით", "D. ბატონო/ქალბატონო"], correct_answer: "B", explanation: "საბანკო მომსახურების სტანდარტი მოითხოვს ყველა კლიენტთან \"თქვენ\" ფორმის გამოყენებას.", question_type: "multiple_choice" },
      { course_id: c3Id, question_number: 2, question: "რა არის LEARN მოდელის პირველი ეტაპი?", options: ["A. Apologize", "B. Resolve", "C. Listen", "D. Empathize"], correct_answer: "C", explanation: "LEARN მოდელი იწყება Listen-ით — კლიენტის სრული მოსმენით.", question_type: "multiple_choice" },
      { course_id: c3Id, question_number: 3, question: "კლიენტი უჩივის, რომ ბანკის სერვისი ცუდია. რომელი პასუხია სწორი?", options: ["A. ეს ჩვენი პოლიტიკაა", "B. კომპიუტერი ასე ამბობს", "C. გესმის, ეს ნამდვილად შემაწუხებელია. მოდი ვნახოთ, რა შეიძლება გავაკეთოთ", "D. ეს ჩემი პრობლემა არ არის"], correct_answer: "C", explanation: "სწორი პასუხი გამოხატავს თანაგრძნობას და გვპირდება პრობლემის გადაჭრას.", question_type: "scenario", scenario: "კლიენტი მოვიდა ფილიალში და ხმამაღლა უჩივის, რომ ბანკის სერვისი ცუდია და მისი პრობლემა არავინ ვერ გადაჭრა." },
      { course_id: c3Id, question_number: 4, question: "70-30 წესი კომუნიკაციაში ნიშნავს:", options: ["A. 70% ვსაუბრობთ, 30% ვუსმენთ", "B. 70% ვუსმენთ, 30% ვსაუბრობთ", "C. 70% ვმუშაობთ, 30% ვისვენებთ", "D. 70% ტელეფონით, 30% პირისპირ"], correct_answer: "B", explanation: "პროფესიული კომუნიკაციის 70-30 წესი: კლიენტს 70% დრო ვუსმენთ და მხოლოდ 30% ვსაუბრობთ.", question_type: "multiple_choice" },
      { course_id: c3Id, question_number: 5, question: "გაბრაზებული კლიენტი ხმამაღლა საუბრობს. სწორი მოქმედება:", options: ["A. იგივე ტონით უპასუხეთ", "B. სთხოვეთ წასვლა", "C. შეინარჩუნეთ სიმშვიდე და მოუსმინეთ სრულად", "D. მენეჯერს დაუძახეთ დაუყოვნებლივ"], correct_answer: "C", explanation: "გაბრაზებულ კლიენტთან სიმშვიდის შენარჩუნება და მოსმენა ყველაზე ეფექტური სტრატეგიაა.", question_type: "multiple_choice" },
      { course_id: c3Id, question_number: 6, question: "რამდენ წამში ყალიბდება პირველი შთაბეჭდილება?", options: ["A. 3 წამში", "B. 7 წამში", "C. 30 წამში", "D. 1 წუთში"], correct_answer: "B", explanation: "კვლევების მიხედვით, პირველი შთაბეჭდილება 7 წამში ყალიბდება.", question_type: "multiple_choice" },
      { course_id: c3Id, question_number: 7, question: "კლიენტს პრობლემა სრულად ვერ გადაუჭერით ადგილზე. სწორი მოქმედება:", options: ["A. სთხოვეთ სხვა ბანკში წასვლა", "B. შესთავაზეთ კონკრეტული ვადა და შეატყობინეთ შედეგი", "C. თქვით რომ ვეცდებით", "D. ფორმა შეავსეთ და ჩააბარეთ"], correct_answer: "B", explanation: "LEARN მოდელის Resolve და Notify ეტაპები: კონკრეტული ვადის შეთავაზება და შედეგის შეტყობინება.", question_type: "multiple_choice" },
      { course_id: c3Id, question_number: 8, question: "საჩივრის სწორად გადაჭრის შემდეგ კლიენტის ლოიალობა:", options: ["A. მცირდება", "B. არ იცვლება", "C. იზრდება", "D. კლიენტი მაინც მიდის"], correct_answer: "C", explanation: "კვლევები ადასტურებს, რომ სწორად გადაჭრილი საჩივრის შემდეგ კლიენტის ლოიალობა იზრდება.", question_type: "multiple_choice" },
    ];

    await admin.from("quiz_questions").insert(c3Quiz);

    // ── 7. Assign all courses to all employees ──
    const courseIds = [c1Id, c2Id, c3Id];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString();

    const assignments: any[] = [];
    for (const cId of courseIds) {
      for (const eId of employeeIds) {
        assignments.push({
          course_id: cId,
          employee_id: eId,
          organization_id: orgId,
          assigned_by: hrUserId,
          due_date: dueDate,
          status: "assigned",
        });
      }
    }

    const { data: insertedAssignments } = await admin
      .from("course_assignments")
      .insert(assignments)
      .select();

    // ── 8. Employee1: completed Course 1 with 90% score ──
    const emp1Id = employeeIds[0];
    const emp1C1Assignment = insertedAssignments?.find(
      (a: any) => a.employee_id === emp1Id && a.course_id === c1Id
    );

    if (emp1C1Assignment) {
      // Update assignment status to completed
      await admin
        .from("course_assignments")
        .update({ status: "completed" })
        .eq("id", emp1C1Assignment.id);

      // Get all module IDs for course 1
      const { data: c1ModuleIds } = await admin
        .from("course_modules")
        .select("id")
        .eq("course_id", c1Id);

      // Create progress record
      await admin.from("course_progress").insert({
        assignment_id: emp1C1Assignment.id,
        course_id: c1Id,
        employee_id: emp1Id,
        current_module: 5,
        completed_modules: c1ModuleIds?.map((m: any) => m.id) || [],
        completed_at: new Date().toISOString(),
      });

      // Create quiz attempt with 90% score (9/10 correct)
      const quizAnswers = c1Quiz.map((q, i) => ({
        question_id: q.question_number,
        selected_answer: i === 5 ? "A" : q.correct_answer, // one wrong answer
        is_correct: i !== 5,
      }));

      await admin.from("quiz_attempts").insert({
        course_id: c1Id,
        employee_id: emp1Id,
        score: 90,
        passed: true,
        answers: quizAnswers,
      });

      // Generate certificate
      const certId = `QUALI-${new Date().getFullYear()}-DEMO01`;
      await admin.from("certificates").insert({
        course_id: c1Id,
        employee_id: emp1Id,
        organization_id: orgId,
        certificate_id: certId,
      });
    }

    // ── 9. Employee2: Course 1 in progress at 60% ──
    const emp2Id = employeeIds[1];
    const emp2C1Assignment = insertedAssignments?.find(
      (a: any) => a.employee_id === emp2Id && a.course_id === c1Id
    );

    if (emp2C1Assignment) {
      await admin
        .from("course_assignments")
        .update({ status: "in_progress" })
        .eq("id", emp2C1Assignment.id);

      const { data: c1ModuleIds } = await admin
        .from("course_modules")
        .select("id")
        .eq("course_id", c1Id)
        .order("module_number")
        .limit(3); // 3 out of 5 modules = 60%

      await admin.from("course_progress").insert({
        assignment_id: emp2C1Assignment.id,
        course_id: c1Id,
        employee_id: emp2Id,
        current_module: 4,
        completed_modules: c1ModuleIds?.map((m: any) => m.id) || [],
      });
    }

    // ── 10. Employee3: all courses not started (already default) ──

    console.log("Demo content seeded successfully!");

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: orgId,
        courses: [c1Id, c2Id, c3Id],
        employees: employeeIds,
        message: "Demo content created: 3 courses, 26 quiz questions, 3 employees, assignments, progress states, and 1 certificate.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
