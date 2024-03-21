# The CIDER (Contenteditable-Input-Diff-Error-Reconcile) editor

The CIDER editor is a custom editor written for Element.
Most of the code can be found in the `/editor/` directory of the `matrix-react-sdk` project.
It is used to power the composer main composer (both to send and edit messages), and might be used for other usecases where autocomplete is desired (invite box, ...).

## High-level overview.

The editor is backed by a model that contains parts.
A part has some text and a type (plain text, pill, ...). When typing in the editor,
the model validates the input and updates the parts.
The parts are then reconciled with the DOM.

## Inner workings

When typing in the `contenteditable` element, the `input` event fires and
the DOM of the editor is turned into a string. The way this is done has
some logic to it to deal with adding newlines for block elements, to make sure
the caret offset is calculated in the same way as the content string, and to ignore
caret nodes (more on that later).
For these reasons it doesn't use `innerText`, `textContent` or anything similar.
The model addresses any content in the editor within as an offset within this string.
The caret position is thus also converted from a position in the DOM tree
to an offset in the content string. This happens in `getCaretOffsetAndText` in `dom.ts`.

Once the content string and caret offset is calculated, it is passed to the `update()`
method of the model. The model first calculates the same content string of its current parts,
basically just concatenating their text. It then looks for differences between
the current and the new content string. The diffing algorithm is very basic,
and assumes there is only one change around the caret offset,
so this should be very inexpensive. See `diff.ts` for details.

The result of the diffing is the strings that were added and/or removed from
the current content. These differences are then applied to the parts,
where parts can apply validation logic to these changes.

For example, if you type an @ in some plain text, the plain text part rejects
that character, and this character is then presented to the part creator,
which will turn it into a pill candidate part.
Pill candidate parts are what opens the auto completion, and upon picking a completion,
replace themselves with an actual pill which can't be edited anymore.

The diffing is needed to preserve state in the parts apart from their text
(which is the only thing the model receives from the DOM), e.g. to build
the model incrementally. Any text that didn't change is assumed
to leave the parts it intersects alone.

The benefit of this is that we can use the `input` event, which is broadly supported,
to find changes in the editor. We don't have to rely on keyboard events,
which relate poorly to text input or changes, and don't need the `beforeinput` event,
which isn't broadly supported yet.

Once the parts of the model are updated, the DOM of the editor is then reconciled
with the new model state, see `renderModel` in `render.ts` for this.
If the model didn't reject the input and didn't make any additional changes,
this won't make any changes to the DOM at all, and should thus be fairly efficient.

For the browser to allow the user to place the caret between two pills,
or between a pill and the start and end of the line, we need some extra DOM nodes.
These DOM nodes are called caret nodes, and contain an invisble character, so
the caret can be placed into them. The model is unaware of caret nodes, and they
are only added to the DOM during the render phase. Likewise, when calculating
the content string, caret nodes need to be ignored, as they would confuse the model.

As part of the reconciliation, the caret position is also adjusted to any changes
the model made to the input. The caret is passed around in two formats.
The model receives the caret _offset_ within the content string (which includes
an atNodeEnd flag to make it unambiguous if it is at a part and or the next part start).
The model converts this to a caret _position_ internally, which has a partIndex
and an offset within the part text, which is more natural to work with.
From there on, the caret _position_ is used, also during reconciliation.
