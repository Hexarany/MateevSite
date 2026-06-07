const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

// ── Services ────────────────────────────────────────────────────────────────
const serviceRo = {
  classic: {
    nameRo: "Masaj clasic",
    categoryRo: "Clasic",
    descriptionRo: "Tehnică echilibrată pentru eliminarea tensiunii, îmbunătățirea circulației sanguine și senzația de ușurință în tot corpul.",
    benefitsRo: ["Elimină tensiunea din gât și spate", "Redă tonusul și mobilitatea corpului", "Potrivit pentru prima vizită la studio"]
  },
  sports: {
    nameRo: "Masaj sportiv",
    categoryRo: "Sportiv",
    descriptionRo: "Lucru intensiv cu mușchii pentru clienții activi, recuperare după antrenamente și menținerea corpului în formă.",
    benefitsRo: ["Accelerează recuperarea după efort", "Reduce febra musculară și oboseala", "Îmbunătățește mobilitatea țesuturilor"]
  },
  lymph: {
    nameRo: "Limfodrenaj",
    categoryRo: "Corectarea figurii",
    descriptionRo: "Procedură delicată pentru reducerea edemelor, senzației de greutate și susținerea blândă a contururilor corpului.",
    benefitsRo: ["Reduce edemele", "Oferă senzația de ușurință", "Potrivit în programele de recuperare"]
  },
  deep: {
    nameRo: "Lucru profund cu spatele",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Lucru punctual și profund cu spatele, centura scapulară și zona lombară pentru cei obosiți de contracturi și efort sedentar.",
    benefitsRo: ["Lucrează cu tensiunea profundă", "Elimină disconfortul muncii sedentare", "Potrivit la contracturi pronunțate"]
  },
  "anti-cellulite": {
    nameRo: "Masaj anticelulitic",
    categoryRo: "Corectarea figurii",
    descriptionRo: "Masaj eficient al zonelor problemă pentru combaterea celulitei, reducerea volumelor și modelarea unui siluet elastic.",
    benefitsRo: ["Activează descompunerea depozitelor de grăsime", "Elimină lichidul în exces și edemele", "Uniformizează textura și crește fermitatea pielii"]
  },
  myofascial: {
    nameRo: "Masaj miofascial (MFR)",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Tehnică manuală profundă de acțiune asupra țesutului conjunctiv (fascie) și mușchilor pentru eliminarea durerilor cronice și restabilirea flexibilității.",
    benefitsRo: ["Elimină punctele trigger și durerile musculare", "Restabilește mobilitatea naturală a articulațiilor", "Corectează postura și elimină fenomenele de stagnare"]
  },
  kids: {
    nameRo: "Masaj pentru copii",
    categoryRo: "Program special",
    descriptionRo: "Tehnică blândă și sigură de masaj, adaptată particularităților organismului în creștere. Ajută la dezvoltarea fizică armonioasă și normalizarea tonusului muscular.",
    benefitsRo: ["Întărește mușchii și aparatul locomotor", "Îmbunătățește calitatea somnului și apetitul", "Reduce excitabilitatea crescută și stresul"]
  },
  pregnancy: {
    nameRo: "Masaj pentru gravide",
    categoryRo: "Program special",
    descriptionRo: "Îngrijire atentă a corpului viitoarei mămici cu tehnici absolut sigure. Ajută să facă față oboselii fizice, descarcă zona lombară și oferă relaxare profundă.",
    benefitsRo: ["Reduce edemele la picioare și senzația de greutate", "Descarcă eficient zona lombară și spatele", "Îmbunătățește starea emoțională a mamei"]
  },
  "face-sculpt": {
    nameRo: "Masaj facial (sculptural)",
    categoryRo: "Corectarea figurii",
    descriptionRo: "Lucru profund cu mușchii mimici și masticatori pentru lifting natural și eliminarea spasmelor. Modelează ovalul feței și redă tenului un aspect sănătos.",
    benefitsRo: ["Lifting vizibil fără operație", "Elimină spasmul mușchilor masticatori și edemele", "Îmbunătățește culoarea tenului și microcirculația"]
  },
  "neck-zone": {
    nameRo: "Masaj zona cervico-umărară",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Masaj local al gâtului, umerilor și părții superioare a spatelui pentru persoanele cu muncă sedentară. Elimină imediat rigiditatea de la calculator și durerile de cap.",
    benefitsRo: ["Elimină imediat greutatea din umeri și gât", "Îmbunătățește fluxul sanguin spre creier", "Crește concentrarea și capacitatea de muncă"]
  },
  "thai-traditional-90": {
    nameRo: "Masaj thai tradițional",
    categoryRo: "Masaj thai",
    descriptionRo: "Sistem antic de vindecare asemănător yogăi pasive. Maestrul întinde blând corpul, folosind răsuciri și presiune profundă pe liniile energetice. Se practică pe saltea, în îmbrăcăminte comodă.",
    benefitsRo: ["Deschidere maximă a articulațiilor și flexibilitate", "Întinde și descarcă blând coloana vertebrală", "Restabilește fluxul liber de energie în corp"]
  },
  "honey-detox": {
    nameRo: "Masaj detox cu miere",
    categoryRo: "Corectarea figurii",
    descriptionRo: "Procedură de curățare intensivă cu miere naturală. Tehnica specială de bătăi ajută la adsorbția toxinelor, curățarea profundă a porilor și face pielea mătăsoasă.",
    benefitsRo: ["Efect puternic de peeling și reînnoire a pielii", "Activează eliminarea substanțelor nocive subcutanate", "Îmbunătățește vizibil turgorului și fermitatea țesuturilor"]
  },
  "anti-arthrosis": {
    nameRo: "Masaj articular (Antiartroză)",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Tehnică terapeutică specializată pentru îmbunătățirea nutriției articulațiilor. Tracțiunile blânde activează producerea lichidului sinovial, elimină rigiditatea și încetinesc distrugerea cartilajului.",
    benefitsRo: ["Crește mobilitatea și flexibilitatea articulațiilor", "Stimulează circulația sanguină în cartilaj", "Reduce sindromul dureros în artroze și artrite"]
  },
  "pir-therapy": {
    nameRo: "Relaxare postizometrică (PIR)",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Tehnică manuală blândă ce combină tensiunea musculară scurtă a clientului cu întinderea pasivă ulterioară. Permite relaxarea absolut nedureroasă a mușchilor aflați în spasm cronic.",
    benefitsRo: ["Elimină rapid blocajele musculare acute și durerile", "Întindere sigură a mușchilor scurtați", "Ideal la radiculită și osteocondroză"]
  },
  "visceral-massage": {
    nameRo: "Masaj visceral",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Tehnică de presare profundă a spațiului abdominal intern prin peretele abdominal anterior. Normalizează poziția anatomică a organelor, elimină stagnările și îmbunătățește digestia.",
    benefitsRo: ["Îmbunătățește funcția tractului digestiv", "Elimină spasmele musculaturii netede a organelor", "Contribuie la reducerea volumului taliei"]
  },
  "foot-reflexology": {
    nameRo: "Reflexoterapia tălpilor",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Acțiune punctuală intensivă asupra zonelor bioactive ale tălpii, fiecare legată de un organ intern. Elimină oboseala locală, stimulează forțele de apărare ale organismului.",
    benefitsRo: ["Elimină sindromul «picioarelor grele» după o zi întreagă", "Activează resursele interne de autovindecare", "Îmbunătățește starea generală și tonusul"]
  },
  "decollete-lifting": {
    nameRo: "Masaj de modelare zona decolteu",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Tehnică estetică și de sănătate pentru zona delicată. Elimină tensiunea din mușchii pectorali, îmbunătățește microcirculația și limfodrenajul, ajutând la menținerea fermității pielii.",
    benefitsRo: ["Îmbunătățește tonusul și elasticitatea pielii", "Elimină contracturile toracice și deschide postura", "Activează limfodrenajul și elimină stagnările"]
  },
  "joint-mobilization": {
    nameRo: "Mobilizare biomecanică a articulațiilor",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Tehnică funcțională blândă pentru restabilirea mobilității naturale a articulațiilor și coloanei vertebrale. Pe baza testării musculare manuale, maestrul aplică tracțiuni și articulații pentru eliminarea nedureroasă a spasmelor de blocare.",
    benefitsRo: ["Eliminarea blândă și sigură a blocajelor funcționale", "Restabilirea mobilității anatomice a coloanei", "Tehnică de reabilitare legal atestată"]
  },
  "thoracic-mobilization": {
    nameRo: "Corecția regiunii toracice (tehnici manuale blânde)",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Lucru anatomic profund cu aparatul musculo-ligamentar al cutiei toracice. Tehnica elimină cifoza (aplecarea), rigiditatea mușchilor intercostali și restabilește mobilitatea articulațiilor costo-vertebrale.",
    benefitsRo: ["Elimină aplecarea și restabilește deschiderea umerilor", "Reduce rigiditatea și spasmele mușchilor intercostali", "Crește volumul inspirației și îmbunătățește ventilația pulmonară"]
  },
  "lumbar-mobilization": {
    nameRo: "Corecția regiunii lombo-sacrale și a pelvisului",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Lucru biomecanic profund cu regiunea lombară, sacrul și inelul pelvin. Tehnica elimină înclinările pelvisului, decomprimă nervul sciatic și lucrează profund cu mușchii psoas, piriform și pătrat lombar.",
    benefitsRo: ["Elimină înclinările pelvisului și egalizează lungimea picioarelor", "Reduce compresia nervului sciatic și spasmul lombar", "Descarcă sigur discurile la protruzie și hernii"]
  },
  "cervical-rehab": {
    nameRo: "Reabilitarea și mobilizarea regiunii cervicale",
    categoryRo: "Îngrijire terapeutică",
    descriptionRo: "Lucru terapeutic precis cu tranziția cervico-craniană și flexorii profunzi ai gâtului. Metoda restabilește sigur mobilitatea vertebrelor la osteocondroza, hernii și protruzie, eliminând triggerele suboccipitale.",
    benefitsRo: ["Elimină rigiditatea gâtului și restabilește rotația capului", "Lichidează durerile de cap de tensiune și amețelile", "Tracțiune sigură și decompresie a vertebrelor cervicale"]
  }
};

// ── Specialists ─────────────────────────────────────────────────────────────
const specialistRo = {
  "denis-matievici": {
    roleRo: "Terapeut corporal",
    bioRo: "Maseur practicant și profesor cu peste 10 ani de experiență. Specializat în masaj clasic, thai, terapeutic, sportiv, tehnici miofasciale și de reabilitare, lucrul cu punctele trigger. Membru al Asociației Maseurilor și Reabilitologilor din Moldova (AMRM)."
  },
  "narek-ghiulumean": {
    roleRo: "Maseur",
    bioRo: "Specialist diplomat în masaj, câștigătorul medaliei de argint la Campionatul Național VIII și Internațional IX de masaj din Republica Moldova. Membru activ al Asociației Maseurilor și Reabilitologilor din Moldova (AMRM)."
  }
};

// ── Apply to services.json ───────────────────────────────────────────────────
const servicesPath = path.join(ROOT, "data", "services.json");
const services = JSON.parse(fs.readFileSync(servicesPath, "utf8"));
const updatedServices = services.map(s => {
  const ro = serviceRo[s.id];
  if (!ro) { console.log("  ! No RO translation for:", s.id); return s; }
  return { ...s, ...ro };
});
fs.writeFileSync(servicesPath, JSON.stringify(updatedServices, null, 2) + "\n", "utf8");
console.log("OK — services.json updated with RO fields");

// ── Apply to specialists.json ────────────────────────────────────────────────
const specialistsPath = path.join(ROOT, "data", "specialists.json");
const specialists = JSON.parse(fs.readFileSync(specialistsPath, "utf8"));
const updatedSpecialists = specialists.map(s => {
  const ro = specialistRo[s.id];
  if (!ro) { console.log("  ! No RO translation for specialist:", s.id); return s; }
  return { ...s, ...ro };
});
fs.writeFileSync(specialistsPath, JSON.stringify(updatedSpecialists, null, 2) + "\n", "utf8");
console.log("OK — specialists.json updated with RO fields");
