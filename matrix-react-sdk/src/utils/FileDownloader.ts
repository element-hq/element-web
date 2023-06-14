/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

export type GetIframeFn = () => HTMLIFrameElement | null;

export const DEFAULT_STYLES = {
    imgSrc: "",
    imgStyle: null as string | null, // css props
    style: "",
    textContent: "",
};

type DownloadOptions = {
    blob: Blob;
    name: string;
    autoDownload?: boolean;
    opts?: typeof DEFAULT_STYLES;
};

// set up the iframe as a singleton so we don't have to figure out destruction of it down the line.
let managedIframe: HTMLIFrameElement;
let onLoadPromise: Promise<void>;
function getManagedIframe(): { iframe: HTMLIFrameElement; onLoadPromise: Promise<void> } {
    if (managedIframe) return { iframe: managedIframe, onLoadPromise };

    managedIframe = document.createElement("iframe");

    // Need to append the iframe in order for the browser to load it.
    document.body.appendChild(managedIframe);

    // Dev note: the reassignment warnings are entirely incorrect here.

    managedIframe.style.display = "none";

    // @ts-ignore
    // noinspection JSConstantReassignment
    managedIframe.sandbox = "allow-scripts allow-downloads allow-downloads-without-user-activation";

    onLoadPromise = new Promise((resolve) => {
        managedIframe.onload = () => {
            resolve();
        };
        managedIframe.src = "usercontent/"; // XXX: Should come from the skin
    });

    return { iframe: managedIframe, onLoadPromise };
}

// TODO: If we decide to keep the download link behaviour, we should bring the style management into here.

/**
 * Helper to handle safe file downloads. This operates off an iframe for reasons described
 * by the blob helpers. By default, this will use a hidden iframe to manage the download
 * through a user content wrapper, but can be given an iframe reference if the caller needs
 * additional control over the styling/position of the iframe itself.
 */
export class FileDownloader {
    private onLoadPromise?: Promise<void>;

    /**
     * Creates a new file downloader
     * @param iframeFn Function to get a pre-configured iframe. Set to null to have the downloader
     * use a generic, hidden, iframe.
     */
    public constructor(private iframeFn?: GetIframeFn) {}

    private get iframe(): HTMLIFrameElement {
        const iframe = this.iframeFn?.();
        if (!iframe) {
            const managed = getManagedIframe();
            this.onLoadPromise = managed.onLoadPromise;
            return managed.iframe;
        }
        this.onLoadPromise = undefined;
        return iframe;
    }

    public async download({ blob, name, autoDownload = true, opts = DEFAULT_STYLES }: DownloadOptions): Promise<void> {
        const iframe = this.iframe; // get the iframe first just in case we need to await onload
        if (this.onLoadPromise) await this.onLoadPromise;
        iframe.contentWindow?.postMessage(
            {
                ...opts,
                blob: blob,
                download: name,
                auto: autoDownload,
            },
            "*",
        );
    }
}
