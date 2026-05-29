/**
 * Adds Romanian translations for content arrays to data/site.json.
 * Run once: node scripts/add-ro-translations.js
 * After running, edit translations in admin: Контент → Витрина.
 */

const fs   = require("node:fs");
const path = require("node:path");

const siteFile = path.join(__dirname, "..", "data", "site.json");
const site = JSON.parse(fs.readFileSync(siteFile, "utf8"));

const roContent = {
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
      text: "Alegeți data și un slot liber online fără a aștepta răspuns în mesagerie sau apeluri."
    },
    {
      title: "Veniți la ședință",
      text: "Vom pregăti spațiul pentru vizita dvs., iar dacă este necesar, vom clarifica detaliile programării din timp."
    }
  ],
  faq: [
    {
      question: "Cum să aleg procedura dacă vin la voi pentru prima dată?",
      answer: "Dacă nu ești sigur ce ți se potrivește, alege masajul clasic sau ritualul de relaxare. În comentariul la programare poți indica solicitarea ta, și te vom orienta înainte de vizită."
    },
    {
      question: "Trebuie să aduc ceva cu mine?",
      answer: "Nu, tot ce este necesar se află deja în studio: prosoape, materiale de unică folosință și un spațiu confortabil pentru procedură."
    },
    {
      question: "Pot reprograma vizita?",
      answer: "Da, desigur. Dacă planurile s-au schimbat, anunțați-ne din timp prin telefon sau Telegram și vom găsi un nou timp convenabil."
    }
  ],
  reviews: [
    {
      author: "Anna D.",
      meta: "ritual de relaxare",
      text: "Lucru foarte atent și atmosferă liniștită. După ședință tensiunea din umeri a dispărut, iar seara am adormit calm pentru prima dată de mult timp."
    },
    {
      author: "Maxim L.",
      meta: "lucru profund cu spatele",
      text: "Am venit cu greutate constantă în spate din cauza muncii sedentare. După câteva ședințe a devenit vizibil mai ușor și mișcările mai libere."
    },
    {
      author: "Elena S.",
      meta: "limfodrenaj",
      text: "Îmi place că poți rezerva rapid prin site și să vezi imediat un timp convenabil. Procedura în sine este foarte delicată și plăcută."
    }
  ]
};

// Merge into existing translations.ro
if (!site.translations) site.translations = {};
if (!site.translations.ro) site.translations.ro = {};

Object.assign(site.translations.ro, roContent);

fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + "\n", "utf8");
console.log("✓ Romanian content translations added to data/site.json");
console.log("  Sections translated: overview, process, faq, reviews");
console.log("  Edit via admin: Контент → Витрина → save");
