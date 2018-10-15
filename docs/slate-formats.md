Guide to data types used by the Slate-based Rich Text Editor
------------------------------------------------------------

We always store the Slate editor state in its Value form.

The schema for the Value is the same whether the editor is in MD or rich text mode, and is currently (rather arbitrarily)
dictated by the schema expected by slate-md-serializer, simply because it was the only bit of the pipeline which
has opinions on the schema. (slate-html-serializer lets you define how to serialize whatever schema you like).

The BLOCK_TAGS and MARK_TAGS give the mapping from HTML tags to the schema's node types (for blocks, which describe
block content like divs, and marks, which describe inline formatted sections like spans).

We use <p/> as the parent tag for the message (XXX: although some tags are technically not allowed to be nested within p's)

Various conversions are performed as content is moved between HTML, MD, and plaintext representations of HTML and MD.

The primitives used are:

 * Markdown.js - models commonmark-formatted MD strings (as entered by the composer in MD mode)
   * toHtml() - renders them to HTML suitable for sending on the wire
   * isPlainText() - checks whether the parsed MD contains anything other than simple text.
   * toPlainText() - renders MD to plain text in order to remove backslashes.  Only works if the MD is already plaintext (otherwise it just emits HTML)

 * slate-html-serializer
   * converts Values to HTML (serialising) using our schema rules
   * converts HTML to Values (deserialising) using our schema rules

 * slate-md-serializer
   * converts rich Values to MD strings (serialising) but using a non-commonmark generic MD dialect.
   * This should use commonmark, but we use the serializer here for expedience rather than writing a commonmark one.

 * slate-plain-serializer
  * converts Values to plain text strings (serialising them) by concatenating the strings together
  * converts Values from plain text strings (deserialiasing them).
  * Used to initialise the editor by deserializing "" into a Value. Apparently this is the idiomatic way to initialise a blank editor.
  * Used (as a bodge) to turn a rich text editor into a MD editor, when deserialising the converted MD string of the editor into a value

 * PlainWithPillsSerializer
  * A fork of slate-plain-serializer which is aware of Pills (hence the name) and Emoji.
  * It can be configured to output Pills as:
    * "plain": Pills are rendered via their 'completion' text - e.g. 'Matthew'; used for sending messages)
    * "md": Pills are rendered as MD, e.g. [Matthew](https://matrix.to/#/@matthew:matrix.org) )
    * "id": Pills are rendered as IDs, e.g. '@matthew:matrix.org' (used for authoring / commands)
  * Emoji nodes are converted to inline utf8 emoji.

The actual conversion transitions are:

 * Quoting:
   * The message being quoted is taken as HTML
   * ...and deserialised into a Value
   * ...and then serialised into MD via slate-md-serializer if the editor is in MD mode

 * Roundtripping between MD and rich text editor mode
   * From MD to richtext (mdToRichEditorState):
     * Serialise the MD-format Value to a MD string (converting pills to MD) with PlainWithPillsSerializer in 'md' mode
     * Convert that MD string to HTML via Markdown.js
     * Deserialise that Value to HTML via slate-html-serializer
   * From richtext to MD (richToMdEditorState):
     * Serialise the richtext-format Value to a MD string with slate-md-serializer (XXX: this should use commonmark)
     * Deserialise that to a plain text value via slate-plain-serializer

 * Loading history in one format into an editor which is in the other format
   * Uses the same functions as for roundtripping

 * Scanning the editor for a slash command
   * If the editor is a single line node starting with /, then serialize it to a string with PlainWithPillsSerializer in 'id' mode
     So that pills get converted to IDs suitable for commands being passed around

 * Sending messages
   * In RT mode:
     * If there is rich content, serialize the RT-format Value to HTML body via slate-html-serializer
     * Serialize the RT-format Value to the plain text fallback via PlainWithPillsSerializer in 'plain' mode
   * In MD mode:
     * Serialize the MD-format Value into an MD string with PlainWithPillsSerializer in 'md' mode
     * Parse the string with Markdown.js
     * If it contains no formatting:
       * Send as plaintext (as taken from Markdown.toPlainText())
     * Otherwise
       * Send as HTML (as taken from Markdown.toHtml())
       * Serialize the RT-format Value to the plain text fallback via PlainWithPillsSerializer in 'plain' mode

 * Pasting HTML
   * Deserialize HTML to a RT Value via slate-html-serializer
   * In RT mode, insert it straight into the editor as a fragment
   * In MD mode, serialise it to an MD string via slate-md-serializer and then insert the string into the editor as a fragment.

The various scenarios and transitions could be drawn into a pretty diagram if one felt the urge, but hopefully the above
gives sufficient detail on how it's all meant to work.