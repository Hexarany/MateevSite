const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const sitePath = path.join(ROOT, "data", "site.json");
const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));

site.translations = site.translations || {};
site.translations.ro = {
  brand: {
    eyebrow: "Studioul de masaj în Chișinău",
    tagline: "Masaj și terapie corporală pentru recuperare și odihnă profundă"
  },
  navigation: {
    overview: "De ce noi",
    services: "Proceduri",
    specialists: "Specialiști",
    booking: "Programare"
  },
  hero: {
    kicker: "Spațiu de recuperare și îngrijire a corpului",
    title: "Masaj și terapie corporală în Chișinău pentru recuperare, relaxare și resurse interioare",
    subtitle: "Alegeți programul potrivit solicitării dvs.: eliberați tensiunea, recuperați spatele, reduceți edemele sau faceți o pauză liniștită pentru dvs. Programarea online durează mai puțin de un minut.",
    primaryCta: "Programare online",
    secondaryCta: "Vezi catalogul",
    asideEyebrow: "De ce ne aleg",
    asideTitle: "Lucru atent cu corpul, atmosferă liniștită și servicii fără agitație inutilă"
  },
  sections: {
    overview: {
      kicker: "De ce noi",
      title: "Tot ce aveți nevoie pentru o vizită confortabilă și liniștită la studio",
      copy: "De la prima cunoaștere cu studioul până la alegerea unui timp convenabil — totul este organizat astfel încât să vă fie ușor să luați o decizie și să vă programați."
    },
    services: {
      kicker: "Proceduri",
      title: "Programe de masaj și îngrijire cu efect clar și preț transparent",
      copy: "Alegeți ce aveți nevoie acum: relaxare, recuperare după efort, lucru cu spatele sau o pauză SPA delicată pentru dvs."
    },
    specialists: {
      kicker: "Echipa",
      title: "Specialiști care lucrează atent și aud cu adevărat solicitarea dvs.",
      copy: "Fiecare maestru are propriul accent și specializare, astfel încât puteți alege abordarea care vi se potrivește cel mai bine."
    },
    process: {
      kicker: "Cum funcționează",
      title: "Calea de la alegerea programului până la vizita liniștită la studio",
      copy: "Am simplificat programarea pentru ca dvs. să puteți alege procedura necesară fără corespondență lungă și așteptarea răspunsului."
    },
    booking: {
      kicker: "Programare online",
      title: "Alegeți programul, specialistul și ora convenabilă pentru vizită",
      copy: "Completați formularul scurt pentru a lăsa o cerere la slotul convenabil. După trimitere, veți vedea imediat numărul programării.",
      slotHint: "Mai întâi alegeți procedura, specialistul și data.",
      note: "Dacă aveți preferințe privind starea sănătății sau zonele de lucru, indicați-le în comentariul la programare.",
      summaryKicker: "Rezumatul programării",
      contactsKicker: "Contactele studioului"
    },
    reviews: {
      kicker: "Încredere",
      title: "Recenziile oaspeților și răspunsuri la întrebări înainte de prima vizită",
      copy: "Am adunat ce este cel mai important de știut înainte de programare: senzațiile după ședință, formatul vizitei și detaliile organizatorice."
    },
    footer: {
      eyebrow: "Mateev Spa Studio",
      copy: "Studio pentru cei care doresc să elibereze tensiunea, să simtă ușurința în corp și să-și aloce timp fără grabă și agitație."
    }
  },
  bookingForm: {
    serviceLabel: "Procedură",
    specialistLabel: "Specialist",
    dateLabel: "Data",
    slotsLabel: "Intervale libere",
    nameLabel: "Numele clientului",
    namePlaceholder: "De exemplu, Ana",
    phoneLabel: "Telefon",
    phonePlaceholder: "+373...",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    notesLabel: "Comentariu",
    notesPlaceholder: "De exemplu, accent pe spate",
    submitLabel: "Confirmați programarea"
  },
  ui: {
    serviceCardCta: "Alegeți",
    specialistCardCta: "Alegeți maestrul",
    contactAddressLabel: "Adresă",
    contactPhoneLabel: "Telefon",
    contactEmailLabel: "Email",
    contactHoursLabel: "Program",
    summaryServiceLabel: "Procedură",
    summarySpecialistLabel: "Specialist",
    summaryDateLabel: "Data",
    summaryTimeLabel: "Ora",
    summaryPriceLabel: "Cost",
    summaryClientLabel: "Client",
    summaryContactLabel: "Contact"
  },
  overview: [
    {
      title: "Abordare individuală",
      text: "Selectăm tehnica, intensitatea și durata în funcție de solicitarea dvs., ritmul vieții și starea actuală a corpului."
    },
    {
      title: "Atmosferă liniștită",
      text: "Spațiu cald, lucru delicat și senzația de pauză pentru sine fără grabă și zgomot inutil."
    },
    {
      title: "Programare convenabilă",
      text: "Intervalele libere sunt vizibile imediat, iar rezervarea unui slot potrivit durează câteva clicuri."
    },
    {
      title: "Grijă pentru rezultat",
      text: "După ședință vă vom spune cum să mențineți ușurința în corp și ce program să alegeți în continuare."
    }
  ],
  process: [
    {
      title: "Alegeți solicitarea",
      text: "Determinați ce are nevoie corpul acum: odihnă, lucru cu spatele, reducerea edemelor sau recuperare după efort."
    },
    {
      title: "Alegeți specialistul",
      text: "Cunoașteți maeștrii și alegeți-l pe cel a cărui abordare, experiență și specializare vă sunt mai apropiată."
    },
    {
      title: "Rezervați un timp convenabil",
      text: "Alegeți data și un slot liber online fără a aștepta răspuns în mesagerie sau apeluri telefonice."
    },
    {
      title: "Veniți la ședință",
      text: "Vom pregăti spațiul pentru vizita dvs., iar dacă este necesar, vom clarifica detaliile programării din timp."
    }
  ],
  reviews: [
    {
      author: "Veaceslav Buzîrev",
      meta: "Google · ★★★★★",
      text: "Specialist înalt calificat, care iubește ceea ce face și este capabil să rezolve probleme reale."
    },
    {
      author: "Alexei",
      meta: "Google · ★★★★★",
      text: "Am efectuat un complex de masaj, totul a fost la cel mai înalt nivel! Îi mulțumesc lui Denis pentru profesionalism. Cu Dumnezeu ne vom revedea."
    },
    {
      author: "Mercury Global",
      meta: "Google · ★★★★★",
      text: "Masajul este pur și simplu minunat, recomand!"
    },
    {
      author: "Sabina Bulat",
      meta: "Google · ★★★★★",
      text: "Recomand cu încredere! Stăpânește foarte bine această meserie și se merită din plin!!!"
    },
    {
      author: "Dimitriana Popov",
      meta: "Google · ★★★★★",
      text: "Mâini de aur! Profesionalism!"
    }
  ],
  faq: [
    {
      question: "Cum să aleg procedura dacă vin la voi pentru prima dată?",
      answer: "Dacă nu ești sigur ce ți se potrivește, alege masajul clasic sau ritualul de relaxare. În comentariul la programare poți indica solicitarea ta și te vom orienta înainte de vizită."
    },
    {
      question: "Trebuie să aduc ceva cu mine?",
      answer: "Nu, tot ce este necesar se află deja în studio: prosoape, materiale de unică folosință și un spațiu confortabil pentru procedură."
    },
    {
      question: "Pot reprograma vizita?",
      answer: "Da, desigur. Dacă planurile s-au schimbat, anunțați-ne din timp prin telefon sau Telegram și vom găsi un nou timp convenabil."
    }
  ]
};

fs.writeFileSync(sitePath, JSON.stringify(site, null, 2) + "\n", "utf8");
console.log("OK — translations.ro updated");
console.log("Keys:", Object.keys(site.translations.ro).join(", "));
