/**
 * API to alter the message composer.
 * @alpha Likely to change
 */
export interface ComposerApi {
    /**
     * Insert plaintext into the current composer.
     * @param text - The plain text to insert
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertTextIntoComposer(text: string): void;
}
