import type { UrlPreviewHandler, UrlPreviewApi as IUrlPreviewApi } from "@element-hq/element-web-module-api";
import type { UrlPreview } from "shared-types";

export class UrlPreviewApi implements IUrlPreviewApi {
    private readonly handlers = new Map <RegExp, UrlPreviewHandler>();
    public registerPreviewHandler(regex: RegExp, handler: UrlPreviewHandler) {
        this.handlers.set(regex, handler);
    };
    public getPreview(url: string): UrlPreview|null {
        for (const [regex, handler] of this.handlers) {
            // If the regex matches, we skip other handler regardless of the outcome.
            if (regex.test(url.toString())) {
                return handler(url);
            }
        }
        return null;
    }
}
