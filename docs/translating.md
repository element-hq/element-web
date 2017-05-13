# How to translate riot-web

## Requirements

- Web Browser
- Be able to understand English
- Be able to understand the language you want to translate riot-web into

## Step 1: Preparing your Weblate Profile

1. Head to https://translate.nordgedanken.de and register either via Github or email
2. After register check if you got a email to verify your account and click the link (if there is none head to step 1.4)
3. Log into weblate
4. Head to https://translate.nordgedanken.de/accounts/profile/ and select the languages you know and maybe another language you know too.
6. Head to https://translate.nordgedanken.de/accounts/profile/#subscriptions and select Riot Web as Project

## How to check if your language already is being translated

Go to https://translate.nordgedanken.de/projects/riot-web/ and in all 3 sub projects if your language is listed.
If it is listed go to Step 2a if not go to Step 2b

## Step 2a: Helping on existing languages.

1. Head to one of the projects listed https://translate.nordgedanken.de/projects/riot-web/
2. Click on the ``translate`` button on the right side of your language
3. Fill in the translations in the writeable field. You will see the original English string and the String of your second language above.

Head to the explanations under Steb 2b

## Step 2b: Adding a new language

1. Go to one of the projects listed https://translate.nordgedanken.de/projects/riot-web/
2. Click the ``Start new language`` button at the bottom
3. Select our language
4. Start translating like in 2a.3
5. Repeat these steps for the other projects which are listed at the link of step 2b.1
6. Add your language to the array at https://github.com/MTRNord/matrix-react-sdk/blob/translations/src/components/views/elements/LanguageDropdown.js#L23

### What means the green button under the text field?

The green button let you save our translations directly. Please only use it if you are 100% sure about that translation. If you do not know a translation please DO NOT click that button. Use the arrows above the translations field and click to the right.

### What means the yellow button under the text field?

The yellow button has to be used if you are unsure about the translation but you have a rough idea. It ads a new suggestion to the string which can than be reviewed by others.

### What are "%(something)s"?

These things are variables that are filled inside the code. They can be room names, usernames or similiar. If you find one use it for changing the word order but do not delete it as thing are missing if you do so.

### "I want to come back to this string. How?"

You can use inside the translation field "Review needed" checkbox. It will be shown as Strings that need to be reviewed.

### Further reading

The official Doc provides some more in-deepth explanation on how to do translations and talks about do and don't's. You can find it at: https://docs.weblate.org/en/latest/user/translating.html
