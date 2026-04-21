import { ComponentType, ReactNode, SVGAttributes } from "react";

/**
 * An option presented to the user for uploading a file.
 * @alpha Unlikely to change
 */
export type ComposerApiFileUploadOption = {
    type: string;
    label: string;
    icon: ComponentType<SVGAttributes<SVGElement>>;
    onSelected: (roomId: string, onFileSelected: (result: FileUploadResult) => void) => Promise<void> | void;
};
/**
 * A constant representing the ability to upload local files.
 * This also handles drag and drop files.
 * @alpha Unlikely to change
 */
export const ComposerApiFileUploadLocal = "local";

/**
 * Result from a file upload.
 * @alpha Unlikely to change
 */
export type FileUploadResult = { mxc: string } | { file: File } | { blob: Blob } | null;

/**
 * Rendered represntation of extra content for a message.
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
 * API to alter the message composer.
 * @alpha Likely to change
 */
export interface ComposerApi {
    readonly ComposerApiFileUploadLocal: typeof ComposerApiFileUploadLocal;
    /**
     * Add a new file upload option for the user.
     * Use {@link ComposerApiFileUploadLocal} to alter the local file upload logic.
     * @throws If another option is already using the same `type`.
     * @param option - TODO
     * @alpha Likely to change
     */
    addFileUploadOption(option: ComposerApiFileUploadOption): void;
    /**
     * Disable an existing file upload option
     * Use {@link ComposerApiFileUploadLocal} to disable local file uploads.
     * @param type - The `type` of an {@link ComposerApiFileUploadOption}
     * @returns Whether or not the option existed in the currenty configured set.
     * @alpha Likely to change
     */
    disableFileUploadOption(type: string): boolean;
    /**
     * Insert plaintext into the current composer.
     * @param text - The plain text to insert
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertTextIntoComposer(text: string): void;
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
