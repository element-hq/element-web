# How to translate Element (Dev Guide)

## Requirements

- A working [Development Setup](../README.md#setting-up-a-dev-environment)
- Latest LTS version of Node.js installed
- Be able to understand English

## Translating strings vs. marking strings for translation

Translating strings are done with the `_t()` function found in `languageHandler.tsx`.
It is recommended to call this function wherever you introduce a string constant which should be translated.
However, translating can not be performed until after the translation system has been initialized.
Thus, sometimes translation must be performed at a different location in the source code than where the string is introduced.
This breaks some tooling and makes it difficult to find translatable strings.
Therefore, there is the alternative `_td()` function which is used to mark strings for translation,
without actually performing the translation (which must still be performed separately, and after the translation system has been initialized).

Basically, whenever a translatable string is introduced, you should call either `_t()` immediately OR `_td()` and later `_t()`.

Example:

```
// Module-level constant
const COLORS = {
    '#f8481c': _td('reddish orange'), // Can't call _t() here yet
    '#fc2647': _td('pinky red') // Use _td() instead so the text is picked up for translation anyway
}

// Function that is called some time after i18n has been loaded
function getColorName(hex) {
    return _t(COLORS[hex]); // Perform actual translation here
}
```

## Key naming rules

These rules are based on https://github.com/element-hq/element-x-android/blob/develop/tools/localazy/README.md
At this time we are not trying to have a translation key per UI element as some methodologies use,
whilst that would offer the greatest flexibility, it would also make reuse between projects nigh impossible.
We are aiming for a set of common strings to be shared then some more localised translations per context they may appear in.

1. Ensure the string doesn't already exist in a related project, such as https://localazy.com/p/element
2. Keys for common strings, i.e. strings that can be used at multiple places must start by `action_` if this is a verb, or `common_` if not
3. Keys for common accessibility strings must start by `a11y_`. Example: `a11y_hide_password`
4. Otherwise, try to group keys logically and nest where appropriate, such as `keyboard_` for strings relating to keyboard shortcuts.
5. Ensure your translation keys do not include `.` or `|` or ` `. Try to balance string length against descriptiveness.

## Adding new strings

1. Check if the import `import { _t } from ".../languageHandler";` is present. If not add it to the other import statements. Also import `_td` if needed.
1. Add `_t()` to your string passing the translation key you come up with based on the rules above. If the string is introduced at a point before the translation system has not yet been initialized, use `_td()` instead, and call `_t()` at the appropriate time.
1. Run `yarn i18n` to add the keys to `src/i18n/strings/en_EN.json`
1. Modify the new entries in `src/i18n/strings/en_EN.json` with the English (UK) translations for the added keys.

## Editing existing strings

Edits to existing strings should be performed only via Localazy.
There you can also require all translations to be redone if the meaning of the string has changed significantly.

## Adding variables inside a string.

1. Extend your `_t()` call. Instead of `_t(TKEY)` use `_t(TKEY, {})`
1. Decide how to name it. Please think about if the person who has to translate it can understand what it does. E.g. using the name 'recipient' is bad, because a translator does not know if it is the name of a person, an email address, a user ID, etc. Rather use e.g. recipientEmailAddress.
1. Add it to the array in `_t` for example `_t(TKEY, {variable: this.variable})`
1. Add the variable inside the string. The syntax for variables is `%(variable)s`. Please note the _s_ at the end. The name of the variable has to match the previous used name.

- You can use the special `count` variable to choose between multiple versions of the same string, in order to get the correct pluralization. E.g. `_t('You have %(count)s new messages', { count: 2 })` would show 'You have 2 new messages', while `_t('You have %(count)s new messages', { count: 1 })` would show 'You have one new message' (assuming a singular version of the string has been added to the translation file. See above). Passing in `count` is much preferred over having an if-statement choose the correct string to use, because some languages have much more complicated plural rules than english (e.g. they might need a completely different form if there are three things rather than two).
- If you want to translate text that includes e.g. hyperlinks or other HTML you have to also use tag substitution, e.g. `_t('<a>Click here!</a>', {}, { 'a': (sub) => <a>{sub}</a> })`. If you don't do the tag substitution you will end up showing literally '<a>' rather than making a hyperlink.
- You can also use React components with normal variable substitution if you want to insert HTML markup, e.g. `_t('Your email address is %(emailAddress)s', { emailAddress: <i>{userEmailAddress}</i> })`.

## Things to know/Style Guides

- Do not use `_t()` inside `getDefaultProps`: the translations aren't loaded when `getDefaultProps` is called, leading to missing translations. Use `_td()` to indicate that `_t()` will be called on the string later.
- If using translated strings as constants, translated strings can't be in constants loaded at class-load time since the translations won't be loaded. Mark the strings using `_td()` instead and perform the actual translation later.
- If a string is presented in the UI with punctuation like a full stop, include this in the translation strings, since punctuation varies between languages too.
- Avoid "translation in parts", i.e. concatenating translated strings or using translated strings in variable substitutions. Context is important for translations, and translating partial strings this way is simply not always possible.
- Concatenating strings often also introduces an implicit assumption about word order (e.g. that the subject of the sentence comes first), which is incorrect for many languages.
- Translation 'smell test': If you have a string that does not begin with a capital letter (is not the start of a sentence) or it ends with e.g. ':' or a preposition (e.g. 'to') you should recheck that you are not trying to translate a partial sentence.
- If you have multiple strings, that are almost identical, except some part (e.g. a word or two) it is still better to translate the full sentence multiple times. It may seem like inefficient repetition, but unlike programming where you try to minimize repetition, translation is much faster if you have many, full, clear, sentences to work with, rather than fewer, but incomplete sentence fragments.
- Don't forget curly braces when you assign an expression to JSX attributes in the render method)
