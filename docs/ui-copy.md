# UI Copy and Localisation Guidelines

Language-independent rules for Element's interface copy: how to write the English source, and how any translation should relate to it.

Applies to Element Web, Element Desktop, shared-components, Element X, Element Call, Element Admin and MAS. Per-language conventions live in the language guides in `docs/translations/` (e.g. the [German translation guidelines](./translations/de.md)).

This document covers **what to write**. For **how to wire it up** — `_t()` vs `_td()`, key naming, running `pnpm i18n`, Localazy behaviour, tag substitution — see [How to translate Element (Dev Guide)](./translating-dev.md). For how to join the translation effort, see [How to translate Element](./translating.md).

---

## 1. Voice

- **Write for the person in front of the screen, not for the code.** If a string names an internal concept the user has never seen — an event ID, a Megolm session, a MIME type, a homeserver — ask whether the user can act on it. If not, name the effect instead.

- **Plain language.** Avoid jargon unless it is a fixed product or spec term. A technical-sounding string is not automatically read by a technical person.

- **Short sentences.** One idea per sentence. Two sentences beat one sentence with a subordinate clause.

- **Friendly, not chatty.** No filler, no unnecessary emoji.

- **Say what happens next.** An error that states only what went wrong leaves the user stuck. Where a remedy exists, name it.

- **Make consequences explicit, and conditional where the app knows.** "You'll lose your message history" is wrong for a user who has recovery configured. If the code can distinguish the two cases, the copy should too.

---

## 2. Grammatical form follows position

The form a string takes depends on where it renders, not on what it says. English hides this, because the imperative and the infinitive look identical — but most languages distinguish them, so the choice is being made whether or not the author notices.

The same action, in every position it can appear:

| Position            | Form                                                             | Example                                                             |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Button, menu item   | Names the action. No article, no period                          | **Deactivate account**                                              |
| Dialog title        | Names the action, or asks about it                               | **Deactivate account?**                                             |
| Body text           | Addresses the user. Article, full sentence, period               | **You're about to deactivate your account. This cannot be undone.** |
| Empty state         | Addresses the user, names the next step                          | **No messages yet. Send the first one.**                            |
| Feature description | Third person, describes behaviour                                | **Removes messages automatically after 30 days.**                   |
| Progress state      | Progressive                                                      | **Deactivating…**                                                   |
| Accessible label    | Self-contained: names the control and, where relevant, its state | **Deactivate account, button**                                      |

**The tells, when you can't decide which you are writing:**

- **Article** — "Send **the** first message" is body text; "Send message" is a button.
- **Period** — labels and titles never have one; body text does.
- **Length** — labels are one to three words. If it needs a comma, it is not a label.
- **Subject** — body text can say _you_; a label never does.

**Keep a family internally consistent.** Slash-command descriptions, join-rule labels, filter chips and list items are read against each other; a single outlier looks like a bug.

**Why it matters beyond style:** in German, "Send the first message" is an imperative („Sende …") and "Deactivate account" is an infinitive („Konto deaktivieren") — visibly different constructions. Choosing the wrong one is immediately wrong to a reader, and the English author has no way to feel the error.

---

## 3. Punctuation

**The test is position, not grammatical completeness.** A string can be a full sentence and still take no period.

| Takes a period                      | Takes none                     |
| ----------------------------------- | ------------------------------ |
| Body text and descriptions          | Titles and headings            |
| Any string of two or more sentences | Buttons, labels, menu items    |
|                                     | Inline form-validation errors  |
|                                     | List and bullet items          |
|                                     | Tooltips and short status text |

- **Within a list, every item follows the same convention.** Check the siblings before deciding one item.

- **A string containing a sentence break must end with one.** "This session has been terminated. Sign out to be able to log back in" without a final stop is wrong.

- **Punctuation belongs in the string, not in the code.** If a label is followed by a colon on screen, the colon is part of the translatable string — punctuation, spacing and quotation conventions all vary by language.

- **Other punctuation:** sentence case in buttons and labels; a single ellipsis character `…` rather than three dots; acronyms uppercase (MIME, URL, URI, SSO, PIN).

---

## 4. Interaction verbs

- **`select` is the default.** It is device-neutral and works for pointer, touch and keyboard.

- **`click` only where the interaction is genuinely pointer-specific** — a drag handle, a right-click menu, something paired with dragging.

- **`tap` only where the surface is touch-only** — a mobile-only product, or a string instructing the user about their phone while they read it on a desktop. Element X is mobile-only, so _tap_ is correct throughout it; the exception is a string describing what to do on a desktop, such as the QR sign-in steps.

- **Before dropping the verb entirely, check what else signals the affordance.**

| Surface                                  | Verb needed?                          |
| ---------------------------------------- | ------------------------------------- |
| Tooltip on a hovered element             | No — hovering already implies action  |
| Link text                                | No                                    |
| Standalone instruction with no other cue | **Yes** — e.g. text over an empty map |

---

## 5. Terminology

- **One name per concept, across every product.** If Element Web, Element X and MAS each call the same thing something different, users moving between them have to relearn it. Five names for one feature is a product problem that copy cannot fix.

- **Ask what a word _names_, not how technical the reader is.** This is the test that decides between a user-facing term and an internal one:

| The word names…                                                               | Use                                       |
| ----------------------------------------------------------------------------- | ----------------------------------------- |
| A **party** — whose account it is, who to contact, who supports a feature     | the user-facing term (_account provider_) |
| A party, but nobody is being contacted                                        | a neutral word (_service_)                |
| A **thing** — a URL, config key, API version, certificate, discovery response | the technical term (_homeserver_)         |
| Nothing the reader can use                                                    | drop the noun entirely                    |

- **Check what a word already means inside Element before you use it.** Several are already spoken for, and reusing one attaches your string to the wrong concept.

    - _Admin_ means a **room** admin. "Contact your admin" reads as "ask a moderator here", whatever you intended.
    - _Session_ means a Megolm session in crypto contexts, and locally stored login state in others.
    - _Client_ means an OAuth client in MAS and admin surfaces.

    If the word you want is taken, pick a different one rather than relying on context to disambiguate. Context does not survive translation — a translator works string by string and has none.

- **Never name a control that does not exist.** A string saying `By clicking "Join call now"` when the button says _Continue_ is a defect. Prefer an interpolated placeholder over a hardcoded label so the reference cannot rot.

- **When referencing another system's UI** — iOS Settings, Android, another Element app — match that system's wording exactly, in every language. Some names (Apple's alert-tone names) are untranslated in every locale.

- **Name variables for the translator, not for the programmer.** `recipient` tells a translator nothing — is it a person, an email address, a user ID? `recipientEmailAddress` does. The variable name is often the only context a translator gets.

- **Before adding a string, check whether it already exists** in a related project. Reusing a shared string is better than a near-duplicate — but if the existing one is _wrong_, fix it rather than working around it, or the divergence spreads.

---

## 6. Progress and idle states must differ

If a control has an idle label and a progressive one, they must be visibly different in **every** language. A button reading the same before and during an action looks broken.

This is the commonest place a translation silently collapses two English states into one word.

---

## 7. What a translation must and must not do

- **Placeholders and markup are copied verbatim**, including case and index — `%(name)s`, `%1$@`, `{{count}}`, `<a>`, `<user/>`.

    - **Never introduce a placeholder the source does not have.** It will render literally.
    - **Never add markup the source does not have.** `<b>` invented in a translation can display as raw text.

- **Fill every plural form the source declares.** An empty form falls back to the source language.

- **Never add a claim the source does not make, and never drop a consequence it does.** Both have happened: translations promising an invitation that was never mentioned, and translations omitting that message history would be lost.

- **Identical source text gets identical translation**, across products as well as within a file. Where two call sites genuinely need different wording, record why.

- **When you change one half of a pair, check the twin.** `…_room` / `…_space` and `…_one` / `…_multiple` variants differ by a single word; changing one is the commonest way a file drifts out of step.

- **A translation that says something the source no longer says is stale, not free.** When the source changes, the translation is not always re-flagged.

- **Whitespace:** no leading, trailing or doubled spaces; no space before punctuation or a closing bracket; spaces belong **outside** markup tags, not inside them.

---

## 8. Never build a sentence out of parts

The most damaging thing a source string can do to a translation is arrive incomplete.

- **Do not concatenate translated strings**, and do not substitute one translated string into another. Concatenation bakes in an implicit word order — typically that the subject comes first — which is wrong for many languages. It also strips the context a translator needs.

- **The fragment smell test.** If a string does not begin with a capital letter, or ends with a colon, a comma or a preposition, it is probably a fragment. Check before shipping it.

- **Prefer full repeated sentences over shared fragments.** Several near-identical strings that differ by a word or two look like waste, but they translate faster and more accurately than fewer strings assembled from pieces. This is the opposite of the instinct that serves you well in code.

- **Use the framework's plural mechanism, never an `if`.** Choosing between a singular and a plural string in code assumes two forms; some languages have up to six. Pass the count and let the translation declare its own forms.

---

## 9. Renaming keys when copy changes

There are two kinds of copy change and they need opposite handling.

| Change                                                                        | Rename the key?                                                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **The meaning changes** — the string now says something different             | **Yes.** Renaming forces every language to retranslate, which is what should happen    |
| **The wording changes, same referent** — the same thing described differently | **No.** The key is still accurate; the translations need updating but not invalidating |

The test: **would a translator reading only the new string produce something different from what they produced before?** If yes, rename — every language should be forced to look again. If the string describes the same thing in different words, keep the key and update the translations.

**Where a rename is not worth it** — a large family where every key would change and nothing user-visible improves — accept that translations will not be re-flagged automatically, and sweep them deliberately instead.

---

## 10. Working practice

- **Run the machine checks whenever the files change.** Key coverage, placeholder and markup parity, plural completeness, whitespace, and translation-identical-to-source are all mechanical, cost seconds, and catch regressions that reading does not.

- **Prefer one visit per key.** Batch related changes so a string is not edited three times in three sweeps.

- **Trace the render before deciding wording.** Whether a string is a tooltip, a title, an accessible label or an overlay changes the right answer, and the key name is often misleading.

- **Record decisions with their reasoning.** Every terminology choice will be questioned again by someone who wasn't there.
