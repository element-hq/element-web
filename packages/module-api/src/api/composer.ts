import { ReactNode } from "react";

/**
 * Extra content that may be included on an event.
 * @alpha Subject to change.
 */
export type ComposerEventExtraContent =
    | {
          [key: string]: ComposerEventExtraContent;
      }
    | string
    | number
    | boolean
    | null;

/**
 * Rendered represntation of extra content for a message that shows at the top of the composer.
 * @alpha Likely to change
 * @example
 * ```ts
 * function ExtraContentPreview({contentKey, content, onContentChange}) {
 * return <div>
 *  <span> Event will include a counter {content.count}. </span>
 *  <button onClick={() => onContentChange({count: content.count + 1})}> Increase count </button>
 *  <button onClick={() => onContentChange(null)}> Remove content </button>
 * </div>
 * }
 * ```
 */
export type ComposerExtraContentPreview<T = ComposerEventExtraContent> = (props: {
    /**
     * The unique key used to identify the content.
     */
    contentKey: string;
    /**
     * The extra event content only.
     */
    content: T;
    /**
     * Called when the extra contents should be changed.
     * @param newContent - The new content, or `null` if the contents should be removed.
     */
    onContentChange: (newContent: T | null) => void;
}) => ReactNode;

/**
 * API to interact with the message composer.
 * @alpha Likely to change
 */
export interface ComposerApi {
    /**
     * Insert plaintext into the current composer.
     * @param plaintext - The plain text to insert
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertPlaintextIntoComposer(plaintext: string): void;
    /**
     * Insert extra event content into the current composer, including a preview for the user to
     * modify or remove the content.
     *
     * Content is merged atop existing content so conflicting keys will overwrite the base content (e.g.
     * specifying `body` on a message will allow you to override the `body` key).
     *
     * This content is NOT kept between session restarts, and is removed when a message is queued to send.
     *
     * @param key - A unique key to identify the content. Subsequent calls to this function
     *              will overwrite the previosu content.
     * @param eventContent - Freeform event contents to be added to the Matrix event.
     * @param previewComponent - A component to render at the top of the composer to show the extra content.
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertEventContentIntoComposer<T extends ComposerEventExtraContent>(
        key: string,
        eventContent: T,
        previewComponent: ComposerExtraContentPreview<T>,
    ): void;
}
