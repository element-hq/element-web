import { ReactNode } from "react";

/**
 * Rendered represntation of extra content for a message that shows at the top of the composer.
 * @alpha Likely to change
 */
export type ComposerExtraContentPreview<T = Record<string, unknown>> = (props: {
    contentKey: string;
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
     * Insert extra event content into the current composer.
     * @param key - A unique key to identify the content, that can allow existing content to be overridden.
     * @param eventContent - Freeform event contents to be added to the Matrix event.
     * @param previewComponent - A component to render at the top of the composer to show the extra content.
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertEventContentIntoComposer<T extends object>(
        key: string,
        eventContent: T,
        previewComponent: ComposerExtraContentPreview<T>,
    ): void;
}
