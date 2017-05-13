# How to translate riot-web (Dev Guide)

## Requirements

- A working [Development Setup](../../#setting-up-a-dev-environment)
- Be able to understand English
- Be able to understand the language you want to translate riot-web into

## Adding new strings

1. Check if the import ``import _t from 'counterpart'`` is present. If not add it to the other import statements.
2. Add ``_t()`` to your string. (Don't forget that reactjs sometimes need ``{}`` around functions called in the render)
3. Add the String to the ``en_EN.json`` file in ``src/i18n`` or if you are working in matrix-react-sdk you can find the json file in ``src/i18n/strings``

## Adding variables inside a string.

1. Extend your ``_t()`` call. Instead of ``_t(STRING)`` use ``_t(STRING, {})``
2. Decide how to name it. Please think about if the person who has to translate it can understand what it does.
3. Add it to the array in ``_t`` for example ``_t(STRING, {variable: this.variable})``
4. Add the variable inside the string. The syntax for variables is ``%(variable)s``. Please note the s at the end. The name of the variable has to match the previous used name.

## Things to know/Style Guides

- Do not use it inside ``getDefaultProps`` at the point where ``getDefaultProps`` is initialized the translations aren't loaded yet and it causes missing translations.
- Do use ``Array.push()`` instead of directly defining it inside the array. Arrays are not able to access ``_t()`` at runtime.
- Do not include full stops, Emoji or similiar miscellaneous Things to the strings. They are not required to be translated.
