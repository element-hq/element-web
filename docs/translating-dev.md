# How to translate riot-web (Dev Guide)

## Requirements

- A working [Development Setup](../../#setting-up-a-dev-environment)
- Be able to understand English
- Be able to understand the language you want to translate riot-web into

## Translating strings vs. marking strings for translation

Translating strings are done with the `_t()` function found in matrix-react-sdk/lib/languageHandler.js. It is recommended to call this function wherever you introduce a string constant which should be translated. However, translating can not be performed until after the translation system has been initialized. Thus, sometimes translation must be performed at a different location in the source code than where the string is introduced. This breaks some tooling and makes it difficult to find translatable strings. Therefore, there is the alternative `_td()` function which is used to mark strings for translation, without actually performig the translation (which must still be performed separately, and after the translation system has been initialized).

Basically, whenever a translatable string is introduced, you should call either `_t()` immediately OR `_td()` and later `_t()`.

## Adding new strings

1. Check if the import ``import { _t } from 'matrix-react-sdk/lib/languageHandler';`` is present. If not add it to the other import statements. Also import `_td` if needed.
2. Add ``_t()`` to your string. (Don't forget curly braces when you assign an expression to JSX attributes in the render method). If the string is introduced at a point before the translation system has not yet been initialized, use `_td()` instead, and call `_t()` at the appropriate time.
3. Add the String to the ``en_EN.json`` file in ``src/i18n/strings`` (respect which repository you are on).

## Adding variables inside a string.

1. Extend your ``_t()`` call. Instead of ``_t(STRING)`` use ``_t(STRING, {})``
2. Decide how to name it. Please think about if the person who has to translate it can understand what it does.
3. Add it to the array in ``_t`` for example ``_t(STRING, {variable: this.variable})``
4. Add the variable inside the string. The syntax for variables is ``%(variable)s``. Please note the s at the end. The name of the variable has to match the previous used name.

## Things to know/Style Guides

- Do not use `_t()` inside ``getDefaultProps`` at the point where ``getDefaultProps`` is initialized when the translations aren't loaded yet and it causes missing translations. Use `_td()` instead and perform the actual translation later.
- If using translated strings as constants, translated strings can't be in constants loaded at class-load time since the translations won't be loaded. Mark the strings using `_td()` instead and perform the actual translation later.
- If a string is presented in the UI with punctuation like a full stop, include this in the translation strings, since punctuation varies between languages too.
- Avoid "translation in parts", i.e. concatenating translated strings or using translated strings in variable substitutions. Context is important for translations, and translating partial strings this way is simply not always possible.
- Concatenating strings often also introduces an implicit assumption about word order (e.g. that the subject of the sentence comes first), which is incorrect for many languages.
