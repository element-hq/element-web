# English → German Translation Guidelines

These guidelines keep Element's German UI consistent and familiar—aligned with muscle memory from WhatsApp, Signal, Teams, and Slack.

Applies to Element Web, Element Desktop, shared-components, Element X, Element Call, Element Admin and MAS. Where a rule differs by product, it is called out explicitly.

Language-independent rules — grammatical form by position, punctuation, placeholders, plurals — live in the [UI copy and localisation guidelines](../ui-copy.md). For how to join the translation effort, see [How to translate Element](../translating.md).

## Tone & Voice

- **Addressing users:** use **du** (lowercase), never _Sie_. This applies to **every** product, including Element Admin — an administrator is still a person using a product.

    - informal language even though used in professional contexts

    - Watch for third-person „Sie"/„sie" that is not address at all: „Sie umfasst alle Funktionen" (the distribution), „Sie stimmen überein" (the emoji). Those are correct.

- **Direct & action-first:** prefer short sentences. The grammatical form depends on position:

    | Position                                            | Form         | Example                              |
    | --------------------------------------------------- | ------------ | ------------------------------------ |
    | Body text, instructions, empty states               | Imperative   | „Sende die erste Nachricht."         |
    | Dialog titles, buttons, menu items, checkbox labels | Infinitive   | „Konto deaktivieren"                 |
    | Descriptions of what a feature does                 | Third person | „Entfernt Nachrichten automatisch …" |
    - ❌ Never use the imperative for a dialog title („Deaktiviere das Konto?").

    - „Bitte" is kept where the English source says _Please_. It is not filler; dropping it changes register.

- **Plain language:** avoid jargon unless it's a **fixed term** in the glossary (e.g. **Homeserver**).

- **Friendly, not chatty:** no filler, no excessive emojis. Keep microcopy crisp.

- **Match the source's register — do not default to formal.** German should be exactly as informal as the English it translates, no more and no less.

    - ❌ „Falsches Passwort, versuch's nochmal" for _Incorrect password, please try again_ — the German is chattier than the source.

    - ✓ „Los geht's" for _Get started_ — the English is equally informal, so the German is right.

    - Colloquial elisions (_versuch's_, _gibt's_, _probier's_) are the usual symptom. Prefer the full form unless the English is casual too.

## Style Conventions

- **Sentence case** in buttons/labels: „Nachricht senden", „Fertig".

- **Quotation marks:** always German typographic quotes **„…“**, single **‚…‘**.

    - ⚠ **The closing double quote is the same character English uses as an _opening_ quote** (U+201C). They look nothing alike in a font but are easy to confuse when copying. This is the single commonest error in the German files.

    | Character | Purpose                            | Unicode | Windows Alt code |
    | --------- | ---------------------------------- | ------- | ---------------- |
    | „         | opening double                     | U+201E  | Alt + 0132       |
    | “         | closing double                     | U+201C  | Alt + 0147       |
    | ‚         | opening single                     | U+201A  | Alt + 0130       |
    | ‘         | closing single                     | U+2018  | Alt + 0145       |
    | ’         | apostrophe (elision, „Los geht’s") | U+2019  | Alt + 0146       |
    - Alt codes need the **separate numeric keypad** with Num Lock on — the number row above the letters does not work, and most laptops have no keypad. Copying the character is usually faster.

    - ‘ and ’ are mirror images: ‘ curls like a 6, ’ curls like a 9. The closing single quote and the apostrophe are **different characters** despite looking alike.

    - Never straight quotes (`"…"`) — those are inch marks, not quotation marks.

    - This applies even where the English source uses straight quotes or curly English ones.

    - A quote **inside** a quote takes the single form ‚…'.

    - Do **not** add quotes the English does not have. Several German strings had invented them around placeholders and adjectives.

    - Practical bonus: „ and " need no escaping in JSON, unlike `\"`.

- **Apostrophes:** the elision apostrophe is **’** (U+2019), never the straight `'`.

    - Never carry an **English possessive `'s`** into German — „%(displayName)s's Identität" is not German. Restructure with _von_: „die digitale Identität von %(displayName)s". This also avoids the problem of a name that already ends in _s_, since a placeholder cannot be inflected.

- **Punctuation — the test is _position_, not grammatical completeness.** A string can be a full sentence and still take no period.

    | Takes a period                      | Takes none                                                                    |
    | ----------------------------------- | ----------------------------------------------------------------------------- |
    | Body text and descriptions          | Titles and headings                                                           |
    | Any string of two or more sentences | Buttons, labels, menu items                                                   |
    |                                     | Inline form-validation errors („Dieser Wert passt nicht zu deiner Matrix-ID") |
    |                                     | List and bullet items                                                         |
    |                                     | Tooltips and short status text                                                |
    - **Within any list, every item follows the same convention** — check the siblings before deciding one item.

    - **A string containing a sentence break must end with a period.** „Diese Sitzung wurde beendet. Melde dich ab…" without a final stop is wrong in either language; if the English lacks it, that is an English defect to raise, not a German one to copy.

    - German follows the source per string — do not add or drop a period the English does not have, unless the rule above is being applied to both languages.

    - ⚠ **A period mismatch is sometimes a symptom, not the problem.** Before mechanically adding or removing one, check the German still translates the current English. `screen.leave_space.subtitle` differed only by a full stop in the scan, but the German was translating a source that no longer existed.

- **Dashes:** spaced en dash **„ – "**, never a hyphen („ - ") in dash constructions. Where the English uses an em dash („ — "), German still takes the spaced en dash — a deliberate divergence, not a mismatch.

- **Ellipsis:** single character **…**, never three dots. German puts a space before it: „Wird vorbereitet …". This is a deliberate divergence from the English source, which has no space.

- **Numbers & dates:** follow German format (1.234,56; 31.12.2025). Non-breaking space between number and unit: „1 h", „25 MB".

- **Acronyms** stay uppercase: MIME, URL, URI, SSO, PIN.

- **Compounds with loanwords** take a hyphen: „Legacy-Gerät", „LiveKit-Server", „State-Events", „Grant-Typen", „Redirect-URIs". Native compounds are written closed: „Kontoanbieter", „Schlüsselspeicher", „Gruppenbild".

- **Gender:** Prefer phrasing that avoids gendered nouns

    - use **du**, plurals, or role nouns

    - there is no policy (yet) on gender language, so for now avoid it (z. B. „Besitzer:in", „Nutzer:innen")

    - Where the English uses singular _they_ about one unknown person, use **„Person"** or restructure: „Diese Person kann …", not „Er/Sie kann …"

    - Where the object is really an account rather than a human, name the object: „Konto deaktivieren", not „Nutzer deaktivieren"

## Microcopy Patterns

- **Primary actions:** „Senden", „Teilen", „Speichern", „Bestätigen", „Fertig" (final step), „Abschließen" (wirklich final/transaktional).

- **Secondary/escape actions:** „Abbrechen", „Zurück".

- **Destructive:** „Löschen", „Entfernen", „Verlassen".

    - Note: in Matrix, often content cannot be truly deleted, so use „Löschen" only where appropriate

- **Progress states** — always the **passive** form, so the control visibly changes state:

    - Preparing: **„Wird vorbereitet …"** (spezifisch: „Upload wird vorbereitet …")

    - Loading: **„Wird geladen …"**

    - Syncing: **„Wird synchronisiert …"**

    - Downloading: **„Wird heruntergeladen …"**

    - Saving: **„Wird gespeichert …"**

    - ❌ Never reuse the idle infinitive for the progress state — „Herunterladen" / „Herunterladen" leaves the button looking unchanged.

- **Completion:** „Erfolgreich gespeichert", „Gesendet", „Erledigt".

- **Errors:** klar + lösungsorientiert.

    - „Verbindung unterbrochen. **Erneut versuchen**"

    - „Senden fehlgeschlagen. **Nochmal senden**"

    - State the consequence where one exists, and make it conditional if the app knows: „Wenn du die Wiederherstellung eingerichtet hast, …"

## Touch & Interaction Terms

- **Select (device-neutral, default):** **wählen** / **auswählen** („Wähle „Fortfahren"")

    - This is the default rendering of the English _select_, which is replacing _click_ and _tap_ in the source.

- **Click:** **klicken** — only where the interaction is genuinely pointer-specific, e.g. a drag handle („Zum Aufklappen klicken oder ziehen").

- **Tap:** **tippen** („Tippe auf …") — only where the instruction refers to a phone the user is holding, e.g. QR sign-in steps performed on the mobile device.

- **Drag / drop:** **ziehen** / **ablegen** (Teams convention). _Verschieben_ is reserved for the menu command „Verschieben nach".

- **Long-press:** **„Tippen und halten"** / **„Berühren und halten"**

- **Before dropping an interaction verb, check what else signals the affordance.** English strings like _Click to view edits_ often read better in German without the verb — but only where the user is already interacting with the element.

    | Surface                                  | Verb needed?                         | Example                                                                                                                                                            |
    | ---------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | Tooltip on a hovered element             | No — hovering already implies action | `room.read_topic` → „Vollständiges Thema anzeigen"                                                                                                                 |
    | Link text                                | No                                   | `see_older_messages` → „Ältere Nachrichten anzeigen"                                                                                                               |
    | Standalone instruction with no other cue | **Yes** — keep it                    | `location_sharing.click_drop_pin` renders as text over an empty map; „Standort setzen" would read as a button label, so it becomes „Wähle einen Ort auf der Karte" |
    - Where the verb must stay, use the device-neutral **wählen**, not _klicken_ or _tippen_.

- **Element X is mobile-only**, so **tippen** is correct throughout it — not only in strings that instruct the user about a phone. The exception is a string describing what to do on a _desktop_, e.g. the QR sign-in steps.

- **Double-tap:** **doppeltippen**

## Messaging Concepts (preferred German)

- **Room (Matrix) / generic conversation:** **Chat** — the catch-all term, covering DMs and groups alike („Alle Chats", „Chats erkunden").

- **Group:** **Gruppe** — only where the English distinguishes a non-DM room from a DM, or where the UI creates one specifically („Neue Gruppe").

- **Direct 1:1 chat:** **Direktnachricht**

- **Channel (kontextspezifisch, wenn vorhanden):** **Chat**

- **Chat bubbles:** **Sprechblasen**

- **@-mention:** **Erwähnung** / **jemanden mit @ erwähnen**

- **Group image / room avatar:** **Gruppenbild** (WhatsApp convention). A person's avatar is **Profilbild**. Do not use „Avatar".

- **Join:** **beitreten** (dative), noun **Beitritt**, **Beitrittsanfrage**.

    - ❌ Never _betreten_ — Element German calls rooms „Chats", so the physical-entry metaphor does not fit.

    - Watch the case: _beitreten_ takes the dative, _betreten_ the accusative. Sentences like „diesen Space sehen und betreten" need restructuring: „diesen Space sehen und **ihm** beitreten".

- **Ban / unban:** **sperren**, noun **Sperre**; unban is **„die Sperre aufheben"**.

    - ❌ Never _bannen_, _verbannen_, _ausschließen_.

    - _entsperren_ is avoided for people — it reads as unlocking a phone.

## Matrix-spezifische Begriffe

- **Homeserver vs account provider vs service.** Ask what the word **names**, not how technical the reader is — plenty of technical-sounding strings are read by ordinary users.

    | The word names…                                                                   | Use               | Examples                                                                            |
    | --------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
    | A **party** — whose account it is, who to contact, who supports a feature         | **Kontoanbieter** | „Dein Kontoanbieter unterstützt das nicht", „Wende dich an deinen Kontoanbieter"    |
    | A party, but nobody is being contacted and no relationship is implied             | **Dienst**        | „Dieser Dienst hat sein Limit erreicht"                                             |
    | A **thing** — a URL, config key, API version, discovery response, SSL certificate | **Homeserver**    | „Homeserver-URL", „SSL-Zertifikat deines Homeservers", „Homeserver-Erkennung"       |
    | Nothing useful to the reader                                                      | drop the noun     | „Keine Verbindung möglich" — Teams German never says _Server_ in a connection error |
    - ❌ **Never** _Heimserver_, _Heim-Server_, _Home-Server_ under any circumstances.

    - **Kontoanbieter** is a closed compound — never _Konto-Anbieter_ or _Konto-Provider_.

    - **Exception — Element Admin:** the admin console is only ever seen by operators, so **Homeserver** is correct throughout, including where it names a party.

- **Administrator.** Use sparingly, and only where the person is acting in an admin capacity that the account provider as an organisation would not.

    - ⚠ **Ambiguity risk:** in Element, _admin_ usually means a **room admin**. A string that says „wende dich an den Administrator" can easily be read as _ask a moderator in this chat_. Where the intended party is whoever runs the account, say **Kontoanbieter** instead.

    - Where it genuinely is the deployment operator and no account relationship is implied, use **Server-Administration**. Element Call is currently the only case: it has no account concept today, so there is no provider to point at. Revisit if that changes.

    - ❌ Never _Admin_ (clipped), _Systemadministrator_, _Serviceadministrator_, _Serveradmin_.

    - _Owner_ → **Inhaber**, or restructure.

- **Room upgrade (Version):** **„Chatversion aktualisieren"** / „Zum neuen Chat wechseln".

- **State events:** **State-Events** (spec term, hyphenated in compounds). Encryption of them: **State-Verschlüsselung**.

- **Sticky Events, Secret Storage, Sliding Sync, MSC numbers:** untranslated spec terms.

- **Grant type, redirect URI, scope, client, token, user agent (OAuth/MAS):** untranslated — „Grant-Typ", „Redirect-URI", „Scope", „Client", „Token", „User-Agent".

## Verschlüsselung & Sicherheit

- **Digital identity:** **digitale Identität**

    - ❌ Never _kryptografische Identität_, _Cross-Signing-Identität_, or _Sicherheitsnummer_. The last is Signal's _Safety Number_, a per-conversation fingerprint — a different concept that would import a false mental model.

- **Backup:** noun **Backup**, verb **sichern** / **gesichert** (Signal/WhatsApp convention).

    - ❌ Never _backuppen_; never _Sicherung_ as the noun in user-facing UI.

    - The noun and the verb should not collide in one sentence („Das Backup wird gesichert" is nonsense).

- **Recovery key:** **Wiederherstellungsschlüssel**.

    - _Recovery_ never stands alone as a feature name — it appears only as part of _Wiederherstellungsschlüssel_.

- **Key storage:** **Schlüsselspeicher** — a separately labelled control, distinct from Backup. Keep the two apart.

- **Device (cryptographic):** **Gerät**, not _Sitzung_.

    - _Sitzung_ is reserved for a locally stored login state (e.g. session restore errors), which is a different object.

- **Verify:** **verifizieren** — reserved for device/identity verification (cross-signing). For confirming a one-time code, use **bestätigen** („Bestätigungscode").

- **Message keys:** **Nachrichtenschlüssel**.

## UI-Struktur & Aktionen

- **Section:** **Abschnitt** (Teams convention). „Neuer Abschnitt", „Verschieben nach", „Aus Abschnitt entfernen".

- **Collapse / expand:** always check what the control actually collapses before choosing. The same English key can need different German in different products — in Element Web `action.collapse` folds lists, trees and code blocks, while in MAS the identical key wraps an HTML `<section>`.

    - Sections: **reduzieren** / **erweitern** (Teams convention).

    - Lists, trees, plural objects, content blocks: **einklappen** / **ausklappen** — „Filterliste erweitern" would read as _add more filters_.

    - Enlarging or shrinking a visual element (map, video tile, text field): **vergrößern** / **verkleinern**.

- **Clear** — four distinct German verbs; pick by what happens to the thing:

    | Situation                            | German           | Example                           |
    | ------------------------------------ | ---------------- | --------------------------------- |
    | Container persists, contents removed | **leeren**       | an input field, „Chat leeren"     |
    | Stored entries are destroyed         | **löschen**      | search history, logs              |
    | Individual items taken out of a set  | **entfernen**    | „Alle entfernen" for URL previews |
    | Restored to a default                | **zurücksetzen** | filters, form defaults            |

- **Pin / unpin:** **fixieren** / **Fixiert** / **lösen**.

    - ❌ Never _anheften_.

- **View source:** **Rohdaten anzeigen** — what is shown is raw event JSON, not source code. ❌ Never _Quelltext_.

- **User:** **Nutzer**, **Nutzername**.

    - ❌ Never _Benutzer_, _Benutzername_ — Element X is already fully _Nutzer_, and it matches German public-sector register (OZG, BSI, ZenDiS).

    - **Exception:** **benutzerdefiniert** is the fixed German for _custom_ and must not be touched.

## Referencing other UI elements

- When a string names a button or control, the German must match that control's **own translated label**, not the English one.

    - Live example of the failure mode: copy told users to press „Weiter" while `action|continue` rendered as „Fortfahren".

    - Prefer an interpolated placeholder over a hardcoded label where the developer can provide one.

- When a string references a **system** UI element (iOS, Android, another Element app), match that system's German exactly.

    - „Genauer Standort" (iOS Settings), „Verwaltung der Verschlüsselungs-Schlüssel" (legacy Element Android).

    - Apple's alert-tone names (Tri-tone, Chime, Glass, Electronic) ship untranslated in every locale — do not translate them.

## Do & Don't (with examples)

- **Do (imperative, short):**

    - „**Nachricht senden**"

    - „**Link kopieren**"

- **Don't (verbose, passive, formal):**

    - „Die Nachricht kann nun gesendet werden."

    - „Bitte klicken Sie, um fortzufahren."

- **Do (neutral, user-first):**

    - „**Du wurdest** in #projekt **erwähnt**."

    - „**Upload wird vorbereitet …**"

- **Don't (jargon):**

    - „User wurde gepingt."

    - „Pre-Processing wird ausgeführt."

- **Don't (invented content):** never add claims the source does not make, and never drop a consequence it does. Several legacy strings promised things the English never said, or omitted that message history would be lost.

## Glossary (living list)

Please make use of the built-in glossary but sense-check before applying. Some terms have different translations in different contexts.

### Standard renderings

Agreed across all products. Where a term is product-specific, that is noted.

| English                | German                                                         | Note                                                                                                                                |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Continue               | „Weiter"                                                       | not _Fortfahren_                                                                                                                    |
| Retry                  | „Erneut versuchen"                                             | not _Wiederholen_                                                                                                                   |
| Dismiss                | „Schließen"                                                    | not _Ausblenden_, which means hide                                                                                                  |
| Start over             | „Neu beginnen"                                                 |                                                                                                                                     |
| Clear                  | see the four-way rule above                                    |                                                                                                                                     |
| Loading…               | „Wird geladen …"                                               |                                                                                                                                     |
| Confirm password       | „Passwort bestätigen"                                          |                                                                                                                                     |
| Preferences            | „Präferenzen"                                                  | **only** as the Element Web settings tab name, where „Einstellungen" would collide with _Settings_. „Einstellungen" everywhere else |
| View all               | „Alle anzeigen"                                                |                                                                                                                                     |
| View source            | „Rohdaten anzeigen"                                            | raw event JSON, not source code                                                                                                     |
| Something went wrong   | „Etwas ist schief gelaufen"                                    | no terminal period                                                                                                                  |
| This field is required | „Dieses Feld ist ein Pflichtfeld"                              |                                                                                                                                     |
| Not encrypted          | „Nicht verschlüsselt"                                          | not _Unverschlüsselt_                                                                                                               |
| Invite only            | „Nur mit Einladung"                                            |                                                                                                                                     |
| Invite people          | „Personen einladen"                                            |                                                                                                                                     |
| Create account         | „Konto erstellen"                                              | not _Konto anlegen_                                                                                                                 |
| Ask to join            | „Beitritt anfragen" (action) · „Auf Anfrage" (join-rule label) |                                                                                                                                     |
| Request to join sent   | „Beitrittsanfrage gestellt"                                    | _eine Anfrage stellen_, not _schicken_                                                                                              |
| Get recovery key       | „Wiederherstellungsschlüssel erstellen"                        |                                                                                                                                     |
| New room               | „Neue Gruppe"                                                  | it creates a non-DM room                                                                                                            |
| Start chat             | „Chat starten"                                                 | the umbrella action covering both DM and group                                                                                      |
| Message history        | „Nachrichtenverlauf"                                           |                                                                                                                                     |
| Anyone                 | „Alle"                                                         | prefer over _Jeder_                                                                                                                 |
| Please try again       | „Bitte versuche es erneut"                                     | not _versuch's nochmal_                                                                                                             |
| Get started            | „Los geht's"                                                   | typographic apostrophe                                                                                                              |

## Practical Tips

- **Name collisions:** If a term differs between ecosystems (e.g., Slack vs. Teams), pick the variant that best matches **Element's model** and document it in the comments with cross-refs.

- **Space constraints:** Prefer the shorter, widely understood term („Fertig" über „Fertigstellen").

- **Empty states:** explain next step: „Noch keine Nachrichten. **Schreibe die erste Nachricht.**"

- **Placeholders and markup** (`%(name)s`, `%1$@`, `<a>`, `<user/>`) are copied verbatim, including case. Never introduce a placeholder the English does not have — the German will render it literally.

- **Plurals:** German has `one` and `other`. Fill both; leaving `one` empty falls back to English.

- **Stale translations:** when the English changes, the German is not always re-flagged. If a German string says something the English no longer says, it is stale, not a free translation.

- **Whitespace:** no leading, trailing or doubled spaces. No space before punctuation or before a closing bracket. Spaces belong **outside** markup tags, not inside them — „Standard `<2>`({{name}})`</2>`", never „Standard`<2>` ({{name}} )`</2>`".

- **Never add markup the English does not have.** `<b>`, `<a>`, `<user/>` and the rest are copied verbatim from the source. Adding emphasis that isn't in the English risks rendering the raw tag on screen.

- **Identical English gets identical German**, across products as well as within one file. Where two call sites genuinely need different German, record why — otherwise the divergence looks like an error to the next reviewer.

- **When you change one half of a pair, check the twin.** Element has many `…_room` / `…_space` and `…_one` / `…_multiple` variants that differ by a single word. Changing one and not the other is the commonest way a file drifts out of step.

## Decisions log

Recorded so they are not relitigated.

| Decision                                                                                                   | Rationale                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _Nutzer_, not _Benutzer_                                                                                   | Element X already 100% _Nutzer_; matches German public-sector register. Microsoft uses _Benutzer_ but is outweighed here.                                                                                                                                                                                                      |
| _digitale Identität_, not _kryptografische Identität_ or _Sicherheitsnummer_                               | User-facing term agreed with product; _Sicherheitsnummer_ is Signal's Safety Number, a different concept.                                                                                                                                                                                                                      |
| Noun _Backup_, verb _sichern_                                                                              | Signal and WhatsApp both do this; German has no usable verb for _Backup_.                                                                                                                                                                                                                                                      |
| _Recovery_ only as _Wiederherstellungsschlüssel_                                                           | Removes one of several competing names for one feature.                                                                                                                                                                                                                                                                        |
| _Schlüsselspeicher_ stays distinct from _Backup_                                                           | It is a separately labelled control in the UI.                                                                                                                                                                                                                                                                                 |
| German quotes „…" everywhere                                                                               | German convention and Microsoft's German UI style guide; straight quotes are inch marks.                                                                                                                                                                                                                                       |
| _beitreten_, not _betreten_                                                                                | Rooms are called _Chats_; the physical-entry metaphor does not fit. Noun family already established.                                                                                                                                                                                                                           |
| _Abschnitt_, _reduzieren/erweitern_, _Verschieben nach_                                                    | Verbatim matches with Teams German, for users migrating from M365.                                                                                                                                                                                                                                                             |
| _einklappen/ausklappen_ for lists                                                                          | _erweitern_ on a list reads as "add more items".                                                                                                                                                                                                                                                                               |
| _fixieren/lösen_, not _anheften_                                                                           | Element X iOS and the majority of Element Web already use it.                                                                                                                                                                                                                                                                  |
| _Gerät_, not _Sitzung_, for the cryptographic device                                                       | Users read "sign out" as reversible; removal destroys the device.                                                                                                                                                                                                                                                              |
| No gendered forms (_:innen_) for now                                                                       | No Element-wide policy; avoid rather than invent.                                                                                                                                                                                                                                                                              |
| **du** in every product, including Element Admin                                                           | An earlier version of this guideline claimed Element Admin used _Sie_. The file does not: 11 strings use du forms and only 2 used Sie, which were the outliers. Element's German voice is du throughout.                                                                                                                       |
| Homeserver / Kontoanbieter / Dienst decided by what the word **names**, not by how technical the reader is | The audience test failed in practice: strings like „This homeserver does not support login using email address" look technical but are read by ordinary users, and _homeserver_ there just means _whoever runs your account_. Only strings naming an actual artefact — a URL, a certificate, a config key — keep _Homeserver_. |
| Element Admin keeps _Homeserver_ throughout                                                                | Only operators ever open the admin console.                                                                                                                                                                                                                                                                                    |
| _Administrator_ used sparingly                                                                             | In Element, _admin_ normally means a room admin, so an unqualified „Administrator" is read as _a moderator in this chat_.                                                                                                                                                                                                      |
