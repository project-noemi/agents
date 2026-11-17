# Notice Templates — Abuse Takedown Optional Reference

Bilingual customer notice templates for common languages. Load when generating customer notifications in a specific language + English.

---

## English Template

**Subject:** Copyright infringement notice – access to content disabled [TICKET-ID]

Dear [Customer name],

On [date] we received a copyright infringement notice from [complainant], acting on behalf of the rights holder [rights holder]. The notice states that the following content, made available through the service we provide to you (IP address [IP]), infringes the copyright in "[work title]":  
[URL]

Under [legal framework], we are required as a hosting provider to promptly disable access to content identified in a valid notice from the rights holder. Accordingly, as of [date, time] UTC we have [disabled access to the content / suspended the service].

**Counter-Notice Process:**

If you believe the content was lawfully made available (for example, because you hold a license from the rights holder), you may submit a written, reasoned objection to us within [timeframe] of receiving this notice. Your objection must include:
- Your name, address, telephone number, and email address
- Identification of the disabled content and its location
- Reasons for your objection, with a statement and supporting proof that the content is lawful
- [If DMCA: A statement under penalty of perjury that you believe in good faith the material was removed by mistake or misidentification, your consent to the jurisdiction of the competent court, and your physical or electronic signature]

On receipt of a valid objection we will follow the procedure required by law and forward it to the rights holder.

**Terms of Service:**

Please note that our Terms of Service and Acceptable Use Policy prohibit hosting copyright-infringing content, and repeated infringement may lead to termination of service.

A copy of the original notice is attached.

Kind regards,  
[Provider Name]  
[Contact details]

---

## Hungarian Template (+ English)

**Tárgy:** Szerzői jogsértési értesítés – a tartalomhoz való hozzáférés letiltása [TICKET-ID]

Tisztelt [Ügyfél neve]!

Tájékoztatjuk, hogy [dátum] napján szerzői jogsértési értesítést kaptunk a(z) [panaszos]-tól, amely a(z) [jogosult] jogosult nevében járt el. Az értesítés szerint az Ön által az általunk nyújtott tárhelyszolgáltatás keretében (IP-cím: [IP]) elérhetővé tett alábbi tartalom sérti a(z) „[mű címe]" című mű szerzői jogát:  
[URL]

Az elektronikus kereskedelmi szolgáltatások, valamint az információs társadalommal összefüggő szolgáltatások egyes kérdéseiről szóló 2001. évi CVIII. törvény (Ekertv.) 13. §-a, valamint [additional framework] alapján, tárhelyszolgáltatóként kötelesek vagyunk a jogosult szabályszerű értesítése alapján a kifogásolt tartalomhoz való hozzáférést haladéktalanul megszüntetni. Ennek megfelelően [dátum, időpont] UTC időponttól [a fenti tartalomhoz való hozzáférést letiltottuk / a szolgáltatást felfüggesztettük].

**Kifogás benyújtása:**

Ha Ön úgy véli, hogy a tartalom elérhetővé tétele jogszerű volt (például rendelkezik a jogosult engedélyével), az Ekertv. 13. §-a alapján az értesítés kézhezvételétől számított nyolc munkanapon belül írásban, indokolt kifogást nyújthat be nekünk. A kifogásnak tartalmaznia kell:
- Az Ön nevét, címét, telefonszámát és e-mail-címét
- A letiltott tartalom és annak elérhetőségének megjelölését
- A kifogás indokolását, és a tartalom jogszerűségét alátámasztó nyilatkozatot és bizonyítékot

Szabályszerű kifogás esetén a jogszabályban előírt eljárást követjük, és a kifogást továbbítjuk a jogosultnak.

**Általános Szerződési Feltételek:**

Felhívjuk figyelmét, hogy az Általános Szerződési Feltételeink és Elfogadható Felhasználási Szabályzatunk tiltja a szerzői jogot sértő tartalmak tárolását, és ismételt jogsértés esetén a szolgáltatást megszüntethetjük.

Az eredeti értesítés másolatát mellékeljük.

Üdvözlettel:  
[Szolgáltató neve]  
[Elérhetőség]

---

**English translation:**

Dear [Customer name],

On [date] we received a copyright infringement notice from [complainant], acting on behalf of the rights holder [rights holder]. The notice states that the following content, made available through the hosting service we provide to you (IP address [IP]), infringes the copyright in "[work title]":  
[URL]

Under Section 13 of Hungarian Act CVIII of 2001 on electronic commerce services (Ekertv.) and [additional framework], we are required as a hosting provider to promptly disable access to content identified in a valid notice from the rights holder. Accordingly, as of [date, time] UTC we have [disabled access to the content / suspended the service].

**Objection Process:**

If you believe the content was lawfully made available (for example, because you hold a license from the rights holder), you may submit a written, reasoned objection to us within eight business days of receiving this notice, under Section 13 of the Ekertv. Your objection must include your name, address, telephone number and email address; identification of the disabled content and its location; and the reasons for your objection, with a statement and supporting proof that the content is lawful.

On receipt of a valid objection we will follow the procedure required by law and forward it to the rights holder.

**Terms of Service:**

Please note that our Terms of Service and Acceptable Use Policy prohibit hosting copyright-infringing content, and repeated infringement may lead to termination of service.

A copy of the original notice is attached.

Kind regards,  
[Provider Name]  
[Contact details]

---

## Template Variables

Replace these placeholders when generating notices:

- `[Customer name]` — Customer's name or account identifier
- `[date]` — Date notice received (e.g., "October 18, 2026")
- `[complainant]` — Complainant's name or organization
- `[rights holder]` — Rights holder's name (if different from complainant)
- `[IP]` — IP address in question
- `[work title]` — Title of the claimed work
- `[URL]` — Infringing URL(s)
- `[legal framework]` — Legal framework name (e.g., "the US Digital Millennium Copyright Act (17 U.S.C. § 512)", "Regulation (EU) 2022/2065 (Digital Services Act)", "Section 13 of the Ekertv.")
- `[date, time]` — Action timestamp (ISO 8601 UTC, e.g., "2026-10-18 14:23:00")
- `[disabled access to the content / suspended the service]` — Choose based on action taken
- `[timeframe]` — Objection deadline per jurisdiction (e.g., "eight business days", "10-14 business days")
- `[Provider Name]` — Your organization name
- `[Contact details]` — Support email, phone, website
- `[TICKET-ID]` — Internal ticket reference (e.g., "ABUSE-0001")

---

## Adding Additional Languages

To add a new language template:

1. Use formal, neutral tone
2. Include all placeholders in brackets
3. Follow the structure: greeting, notice received, legal framework, action taken, counter-notice process, AUP warning, closing, contact details
4. If bilingual (local + English), place local language first, then English translation below a separator line
5. Test with a native speaker for legal/formal accuracy
