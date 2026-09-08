import type { UrlPreviewHandler, UrlPreviewApi as IUrlPreviewApi } from "@element-hq/element-web-module-api";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { UrlPreview } from "shared-types";

import { getModuleMatrixEvent } from "./models/Event";

export class UrlPreviewApi implements IUrlPreviewApi {
    private readonly handlers = new Map <RegExp, UrlPreviewHandler>();
    public registerPreviewHandler(regex: RegExp, handler: UrlPreviewHandler) {
        this.handlers.set(regex, handler);
    };
    public async getPreview(url: string, mxEvent?: MatrixEvent): Promise<UrlPreview|null> {
        for (const [regex, handler] of this.handlers) {
            // If the regex matches, we skip other handler regardless of the outcome.
            if (url.toString().match(regex)) {
                const moduleEv = (mxEvent && getModuleMatrixEvent(mxEvent)) || undefined;
                return await handler(url, moduleEv);
            }
        }
        return null;
    }
}
