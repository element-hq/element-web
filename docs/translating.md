# How to translate Element

## Requirements

- Web Browser
- Be able to understand English
- Be able to understand the language you want to translate Element into

## Join #element-translations:matrix.org

1. Come and join https://matrix.to/#/#element-translations:matrix.org for general discussion
2. Join https://matrix.to/#/#element-translators:matrix.org for language-specific rooms
3. Read scrollback and/or ask if anyone else is working on your language, and co-ordinate if needed. In general little-or-no coordination is needed though :)

## How to check if your language already is being translated

Go to https://localazy.com/p/element-web. If your language is listed then you can get started. Have a read
of https://localazy.com/docs/general/translating-strings if you need help getting started. If your language is not yet
listed please express your wishes to start translating it in the general discussion room linked above.

### What are `%(something)s`?

These things are placeholders that are expanded when displayed by Element. They can be room names, usernames or similar.
If you find one, you can move to the right place for your language, but not delete it as the variable will be missing if you do.
A special case is `%(count)s` as this is also used to determine which pluralisation is used.

### What are `<link>Something</link>`

These things are markup tags, they encapsulate sections of translations to be marked up, with links, buttons, emphasis and such.
You must keep these markers surrounding the equivalent string in your language that needs to be marked up.

### When will my translations be available?

We automatically pull changes from Localazy 3 times a week, so your translations should be available at https://develop.element.io
within a few days of you submitting them and them being approved. They will then also be included in the following release cycle.
