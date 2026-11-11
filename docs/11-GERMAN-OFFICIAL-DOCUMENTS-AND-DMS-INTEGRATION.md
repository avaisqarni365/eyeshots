# EyeShots: German Official Forms, Jobcenter Documents & DMS Integration

This document defines the specialized engine, form detection heuristics, and state-level workflows for German official, social, and tax documents within EyeShots.

---

## 1. German Official Documents & Authorities

EyeShots provides specialized handling for all German government, social, and municipal PDF documents across all **16 Bundesländer** (Federal States).

### Route: `/german-forms`

### 1.1 Jobcenter & Bundesagentur für Arbeit (SGB II Bürgergeld)
- **HA (Hauptantrag):** Initial application for citizen's allowance (*Bürgergeld*).
- **WBA (Weiterbewilligungsantrag):** 12-month renewal declarations.
- **Anlage KdU (Kosten der Unterkunft):** Rent, heating, and utility cost statements with municipal appropriateness limits (*Angemessenheitsgrenzen*).
- **Anlage EK (Einkommen) & VM (Vermögen):** Income proofs, minijob calculations, and protected asset declarations (*Schonvermögen*).

### 1.2 Finanzamt & Elster (Tax Authorities)
- **ESt 1 A (Mantelbogen):** Federal income tax declaration.
- **Anlage N:** Employment income, commuter allowances (*Entfernungspauschale*), and home office deductions.
- **Anlage Vorsorgeaufwand:** Health, care, and pension insurance contributions.

### 1.3 Familienkasse & Wohngeldamt
- **Antrag KG 1:** Federal child benefit (*Kindergeld*).
- **Wohngeldantrag:** State-specific housing allowance declarations.

---

## 2. 100% Fillable Form Engine

### 2.1 Native AcroForm & Interactive Form XObjects
- **Parser:** [apps/web/lib/pdf/german-forms-engine.ts](file:///d:/EyeShots/apps/web/lib/pdf/german-forms-engine.ts)
- Directly extracts and exposes all native interactive text fields, checkboxes, and radio buttons.

### 2.2 Heuristic Detection for Flat & Scanned Forms
When opening a non-interactive scanned Jobcenter letter or state tax form:
- Scans for standard German bureaucratic input markers:
  - `Name, Vorname: ........`
  - `Geburtsdatum (TT.MM.JJJJ): [  ].[  ].[    ]`
  - `IBAN / BIC: DE__ ____ ____ ____`
  - `Aktenzeichen / BG-Nummer:`
  - `Unterschrift: ________`
- **1-Click Conversion:** "Make Entire Form Fillable" superimposes interactive Fabric.js text and checkbox fields over the detected spans.

---

## 3. High-Fidelity Viewing & Scan Enhancement

- **Vector Precision:** Zoom up to 300% without pixilation or distortion.
- **Magic Clean Presets:** Neutralizes grey scanner cast and shadow artifacts common on office copies from German authorities while keeping authentic stamps and signatures genuine.
- **Visual Form Field Highlighting:** Fillable fields are highlighted in light blue/amber with guided tab sequencing.

---

## 4. Saving to EyeShots DMS by State & Authority

Right from the editor or form portal:
- **1-Click Save to DMS:** Automatically routes the completed document to the subscriber's EyeShots DMS vault.
- **Folder Categorization:** Tagged by Bundesland (e.g. *Berlin*, *Bayern*, *NRW*) and Authority (*Jobcenter*, *Finanzamt*).
- **Status Lifecycle:** `Draft` $\rightarrow$ `Under Review` $\rightarrow$ `Amt-Bereit / Ready for Submission`.

---

## 5. Opening Any PDF in EyeShots

- **Desktop File Association:** With the Tauri 2.0 desktop edition (`apps/desktop`), set EyeShots as the default system handler for `.pdf` files.
- **Browser Drag-and-Drop:** Drag any official PDF into EyeShots to immediately unlock in-place editing, OCR, translation, and voice explanation memos.
