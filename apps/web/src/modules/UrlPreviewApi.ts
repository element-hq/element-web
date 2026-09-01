import type { UrlPreviewHandler, UrlPreviewApi as IUrlPreviewApi } from "@element-hq/element-web-module-api";
import type { UrlPreview } from "shared-types";

export class UrlPreviewApi implements IUrlPreviewApi {
    private readonly handlers = new Map <RegExp, UrlPreviewHandler>();
    public registerPreviewHandler(regex: RegExp, handler: UrlPreviewHandler) {
        this.handlers.set(regex, handler);
    };
    public async getPreview(url: string): Promise<UrlPreview|null> {
        for (const [regex, handler] of this.handlers) {
            // If the regex matches, we skip other handler regardless of the outcome.
            console.log("Requesting preview for", regex, url, regex.test(url.toString()));
            if (regex.test(url.toString())) {
                return await handler(url);
            }
        }
        return null;
    }
}
