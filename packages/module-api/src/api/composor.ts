import { ComponentType, ReactNode, SVGAttributes } from "react";

/**
 * An option presented to the user for uploading a file.
 * @alpha Unlikely to change
 */
export type ComposorApiFileUploadOption = {
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
export const ComposorApiFileUploadLocal = "local";

/**
 * Result from a file upload.
 * @alpha Unlikely to change
 */
export type FileUploadResult = { mxc: string } | { file: File } | { blob: Blob } | null;

/**
 * API to alter the message composor.
 * @alpha Likely to change
 */
export interface ComposorApi {
    /**
     * Add a new file upload option for the user.
     * Use {@link ComposorApiFileUploadLocal} to alter the local file upload logic.
     * @throws If another option is already using the same `type`.
     * @param option - TODO
     */
    addFileUploadOption(option: ComposorApiFileUploadOption): void;
    /**
     * Disable an existing file upload option
     * Use {@link ComposorApiFileUploadLocal} to disable local file uploads.
     * @param type - The `type` of an {@link ComposorApiFileUploadOption}
     * @returns Whether or not the option existed in the currenty configured set.
     */
    disableFileUploadOption(type: string): boolean;
}
