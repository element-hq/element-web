/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Note: eslint-plugin-jsdoc doesn't like import types as parameters, so we
// get around it with @typedef
/**
 * @typedef {import("@element-hq/element-web-module-api").Api} Api
 * @typedef {import("@element-hq/element-web-module-api").ComposerApiTarget} ComposerApiTarget
 */

const MARKDOWN = "# Module heading\n\nModule body text";

export default class DocumentPreviewModule {
    static moduleApiVersion = "^*";
    /**
     * Basic module for testing document previews.
     * @param {Api} api API object
     */
    constructor(api) {
        this.api = api;
    }

    /**
     * Preview a file if the client can, otherwise offer to upload it instead, so that tests can
     * tell whether the client gave us an opener.
     * @param {ComposerApiTarget} view The view the upload option was selected in
     * @param {string} mimetype The mimetype of the file
     * @param {string | undefined} name The file name, if any
     * @param {() => Promise<Blob>} blob Resolves to the file contents
     */
    async previewOrUpload(view, mimetype, name, blob) {
        const openPreview = this.api.documentPreviews.getPreviewOpener({ mimetype, name });
        if (openPreview) {
            openPreview({ blob });
            return;
        }

        const file = new File([await blob()], name ?? "untitled", { type: mimetype });
        this.api.composer.openFileUploadConfirmation([file], view);
    }

    async load() {
        const markdown = async () => new Blob([MARKDOWN], { type: "text/markdown" });

        this.api.composer.addFileUploadOption({
            type: "org.example.preview_markdown",
            label: "Preview Markdown",
            onSelected: (_roomId, view) => this.previewOrUpload(view, "text/markdown", "notes.md", markdown),
        });

        // No name, so the preview should fall back to a generic title.
        this.api.composer.addFileUploadOption({
            type: "org.example.preview_unnamed_markdown",
            label: "Preview unnamed Markdown",
            onSelected: (_roomId, view) => this.previewOrUpload(view, "text/markdown", undefined, markdown),
        });

        // The file cannot be fetched, so the preview should show an error.
        this.api.composer.addFileUploadOption({
            type: "org.example.preview_broken_markdown",
            label: "Preview broken Markdown",
            onSelected: (_roomId, view) =>
                this.previewOrUpload(view, "text/markdown", "broken.md", async () => {
                    throw new Error("Could not fetch file");
                }),
        });
    }
}
