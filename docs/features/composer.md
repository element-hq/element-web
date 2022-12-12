# Composer Features

## Auto Complete

-   Hitting tab tries to auto-complete the word before the caret as a room member
    -   If no matching name is found, a visual bell is shown
-   @ + a letter opens auto complete for members starting with the given letter
    -   When inserting a user pill at the start in the composer, a colon and space is appended to the pill
    -   When inserting a user pill anywhere else in composer, only a space is appended to the pill
-   # + a letter opens auto complete for rooms starting with the given letter
-   : open auto complete for emoji
-   Pressing arrow-up/arrow-down while the autocomplete is open navigates between auto complete options
-   Pressing tab while the autocomplete is open goes to the next autocomplete option,
    wrapping around at the end after reverting to the typed text first.

## Formatting

-   When selecting text, a formatting bar appears above the selection.
-   The formatting bar allows to format the selected test as:
    bold, italic, strikethrough, a block quote, and a code block (inline if no linebreak is selected).
-   Formatting is applied as markdown syntax.
-   Hitting ctrl/cmd+B also marks the selected text as bold
-   Hitting ctrl/cmd+I also marks the selected text as italic
-   Hitting ctrl/cmd+> also marks the selected text as a blockquote

## Misc

-   When hitting the arrow-up button while having the caret at the start in the composer,
    the last message sent by the syncing user is edited.
-   Clicking a display name on an event in the timeline inserts a user pill into the composer
-   Emoticons (like :-), >:-), :-/, ...) are replaced by emojis while typing if the relevant setting is enabled
-   Typing in the composer sends typing notifications in the room
-   Pressing ctrl/mod+z and ctrl/mod+y undoes/redoes modifications
-   Pressing shift+enter inserts a line break
-   Pressing enter sends the message.
-   Choosing "Quote" in the context menu of an event inserts a quote of the event body in the composer.
-   Choosing "Reply" in the context menu of an event shows a preview above the composer to reply to.
-   Pressing alt+arrow up/arrow down navigates in previously sent messages, putting them in the composer.
