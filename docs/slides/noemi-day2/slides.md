---
theme: default
title: NoéMI - 2.nap
info: Prompt Engineering
---

# NoéMI - 2. nap

2026.03.10.

Rendszer és Felhasználói Promptok

---

# Rendszer (System) Prompt

Meghatározza a modell:

- viselkedését
- stílusát
- korlátait
- szakértelmét

**Ki adja meg?**

Általában a fejlesztő (vagy az, aki egyedi GPT-t / AI agentet épít).

**Célja**

Hosszú távú keretet ad a válaszoknak.

### Példa

> Te egy tapasztalt jogi asszisztens vagy.  
> Mindig szakmai, tömör válaszokat adj.  
> Kerüld a szlenget, és minden válasz végén emeld ki, hogy ez nem minősül hivatalos jogi tanácsadásnak.

---

# Felhasználói (User) Prompt

Ez a konkrét feladat vagy kérdés, amit az adott pillanatban meg szeretnél oldani.

Tulajdonságai:

- dinamikus
- változó
- közvetlen

**Ki adja meg?**

A végfelhasználó a chat felületen.

### Példa

> Írd meg nekem egy bérleti szerződés felmondásának vázlatát!

---

# Hogyan váljunk „szerencsejátékosból” MI-mérnökké?

## A Prompt Fejlődési Hierarchia

---

# 1. Szint – Homályos (Vague)

„A szerencsejáték szint”

A felhasználó csak egy általános témát dob be:

- nincs kontextus
- nincs cél
- nincs struktúra

### Prompt


Írj egy emailt egy projekt késéséről.


### Eredmény

Az MI kénytelen találgatni.

Ez gyakran:

- irreleváns tartalomhoz
- vagy hallucinációhoz vezet.

---

# 2. Szint – Specifikus (Specific)

„A kérés szint”

Megjelenik:

- a tárgy
- a címzett

De hiányzik:

- a stílus
- a pontos terjedelem
- a korlátok

### Prompt


Írj egy profi emailt Kovács úrnak
a NoéMI projekt 2 hetes csúszásáról
technikai okok miatt.


---

# Eredmény

Használható vázlat.

De:

- lehet túl rideg
- lehet túl bőbeszédű
- nem ismeri a cég hangvételét

Ezért utólagos kézi javítást igényel.

---

# 3. Szint – Strukturált (Structured)

„A termékleírás szint”

Itt már tudatosan irányítjuk a kimenetet.

Megadjuk:

- struktúrát
- stílust
- formátumot

Ez már egy **recept az MI számára**.

---

# Strukturált Prompt Példa


Írj egy válaszlevelet az alábbi paraméterekkel:

Tárgy: NoéMI projekt ütemezés frissítése

Stílus:
Tömör, bocsánatkérő, de megoldásfókuszú

Struktúra:

Késés bejelentése (2 hét)

Ok megnevezése (szerver migráció)

Új határidő felajánlása

Következő lépés (státusz meeting)

Kimenet:
Markdown formátum
Max 150 szó


---

# Eredmény

Kiváló minőségű, azonnal használható szöveg.

Előnyei:

- pontos
- üzleti környezetbe illeszkedik
- minimális utómunka

---

# 4. Szint – Kontextuális (Contextual)

„A NoéMI Engineering szint”

Az MI már nem csak szöveget ír.

Hanem **ügynökként működik**.

Képes:

- adatot elemezni
- feltételeket vizsgálni
- logikai döntéseket hozni
- fájlokból dolgozni

---

# Kontextuális Prompt Példa


Szerep:
NoéMI Virtuális Adminisztrátor

Feladat:
Elemezd a csatolt project_status.json fájlt
és keresd meg a NoéMI projekt csúszásait.

Logika:

Ha a csúszás > 5 nap
→ készíts email tervezetet Kovács úrnak

Ha a csúszás < 5 nap
→ írj Slack üzenetet a projektmenedzsernek

Korlátok:

Ne használj külső forrásokat

Csak a fájl adatait használd

Ha adat hiányzik → kérdezz vissza


---

# Átmenet az automatizálásba

## Adatkinyerés (Parsing)

Az e-mailből a gép számára értelmezhető adat lesz.

---

# JSON

JavaScript Object Notation

Strukturált adat formátum.

Gyakran használják:

- API kommunikációhoz
- workflow automatizációhoz
- AI input/output feldolgozáshoz

---

# Munkafolyamat-automatizálás

---

# n8n

Az **n8n** egy rugalmas, low-code workflow automatizálási eszköz.

Segítségével összekapcsolhatók különböző rendszerek:

- Gmail
- Google Sheets
- Slack
- AI modellek

---

# Miért különleges?

## Vizuális workflow

Node-okat kapcsolsz össze.

Így látod az adatok útját.

---

# Összekötő kapocs

Példa workflow:

Email → AI feldolgozás → adatbázis → értesítés

---

# AI-Native

Kiválóan integrálható AI modellekkel:

- GPT
- Gemini
- egyéb modellek

---

# Saját tárhely vagy felhő

Az n8n futtatható:

- saját szerveren (self-hosted)
- vagy felhőben
