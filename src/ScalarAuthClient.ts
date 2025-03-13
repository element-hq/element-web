/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2019 , 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { SERVICE_TYPES, type Room, type IOpenIDToken } from "matrix-js-sdk/src/matrix";

import SettingsStore from "./settings/SettingsStore";
import { Service, startTermsFlow, type TermsInteractionCallback, TermsNotSignedError } from "./Terms";
import { MatrixClientPeg } from "./MatrixClientPeg";
import SdkConfig from "./SdkConfig";
import { type WidgetType } from "./widgets/WidgetType";
import { parseUrl } from "./utils/UrlUtils";

// The version of the integration manager API we're intending to work with
const imApiVersion = "1.1";

// TODO: Generify the name of this class and all components within - it's not just for Scalar.

export default class ScalarAuthClient {
    private scalarToken: string | null;
    private termsInteractionCallback?: TermsInteractionCallback;
    private isDefaultManager: boolean;

    public constructor(
        private apiUrl: string,
        private uiUrl: string,
    ) {
        this.scalarToken = null;
        // `undefined` to allow `startTermsFlow` to fallback to a default
        // callback if this is unset.
        this.termsInteractionCallback = undefined;

        // We try and store the token on a per-manager basis, but need a fallback
        // for the default manager.
        const configApiUrl = SdkConfig.get("integrations_rest_url");
        const configUiUrl = SdkConfig.get("integrations_ui_url");
        this.isDefaultManager = apiUrl === configApiUrl && configUiUrl === uiUrl;
    }

    private writeTokenToStore(): void {
        window.localStorage.setItem("mx_scalar_token_at_" + this.apiUrl, this.scalarToken ?? "");
        if (this.isDefaultManager) {
            // We remove the old token from storage to migrate upwards. This is safe
            // to do because even if the user switches to /app when this is on /develop
            // they'll at worst register for a new token.
            window.localStorage.removeItem("mx_scalar_token"); // no-op when not present
        }
    }

    private readTokenFromStore(): string | null {
        let token = window.localStorage.getItem("mx_scalar_token_at_" + this.apiUrl);
        if (!token && this.isDefaultManager) {
            token = window.localStorage.getItem("mx_scalar_token");
        }
        return token;
    }

    private readToken(): string | null {
        if (this.scalarToken) return this.scalarToken;
        return this.readTokenFromStore();
    }

    public setTermsInteractionCallback(callback: TermsInteractionCallback): void {
        this.termsInteractionCallback = callback;
    }

    public connect(): Promise<void> {
        return this.getScalarToken().then((tok) => {
            this.scalarToken = tok;
        });
    }

    public hasCredentials(): boolean {
        return this.scalarToken != null; // undef or null
    }

    // Returns a promise that resolves to a scalar_token string
    public getScalarToken(): Promise<string> {
        const token = this.readToken();

        if (!token) {
            return this.registerForToken();
        } else {
            return this.checkToken(token).catch((e) => {
                if (e instanceof TermsNotSignedError) {
                    // retrying won't help this
                    throw e;
                }
                return this.registerForToken();
            });
        }
    }

    private async getAccountName(token: string): Promise<string> {
        const url = new URL(this.apiUrl + "/account");
        url.searchParams.set("scalar_token", token);
        url.searchParams.set("v", imApiVersion);

        const res = await fetch(url, {
            method: "GET",
        });

        const body = await res.json();
        if (body?.errcode === "M_TERMS_NOT_SIGNED") {
            throw new TermsNotSignedError();
        }

        if (!res.ok) {
            throw body;
        }

        if (!body?.user_id) {
            throw new Error("Missing user_id in response");
        }

        return body.user_id;
    }

    private checkToken(token: string): Promise<string> {
        return this.getAccountName(token)
            .then((userId) => {
                const me = MatrixClientPeg.safeGet().getUserId();
                if (userId !== me) {
                    throw new Error("Scalar token is owned by someone else: " + me);
                }
                return token;
            })
            .catch((e) => {
                if (e instanceof TermsNotSignedError) {
                    logger.log("Integration manager requires new terms to be agreed to");
                    // The terms endpoints are new and so live on standard _matrix prefixes,
                    // but IM rest urls are currently configured with paths, so remove the
                    // path from the base URL before passing it to the js-sdk

                    // We continue to use the full URL for the calls done by
                    // matrix-react-sdk, but the standard terms API called
                    // by the js-sdk lives on the standard _matrix path. This means we
                    // don't support running IMs on a non-root path, but it's the only
                    // realistic way of transitioning to _matrix paths since configs in
                    // the wild contain bits of the API path.

                    // Once we've fully transitioned to _matrix URLs, we can give people
                    // a grace period to update their configs, then use the rest url as
                    // a regular base url.
                    const parsedImRestUrl = parseUrl(this.apiUrl);
                    parsedImRestUrl.pathname = "";
                    return startTermsFlow(
                        MatrixClientPeg.safeGet(),
                        [new Service(SERVICE_TYPES.IM, parsedImRestUrl.toString(), token)],
                        this.termsInteractionCallback,
                    ).then(() => {
                        return token;
                    });
                } else {
                    throw e;
                }
            });
    }

    public registerForToken(): Promise<string> {
        // Get openid bearer token from the HS as the first part of our dance
        return MatrixClientPeg.safeGet()
            .getOpenIdToken()
            .then((tokenObject) => {
                // Now we can send that to scalar and exchange it for a scalar token
                return this.exchangeForScalarToken(tokenObject);
            })
            .then((token) => {
                // Validate it (this mostly checks to see if the IM needs us to agree to some terms)
                return this.checkToken(token);
            })
            .then((token) => {
                this.scalarToken = token;
                this.writeTokenToStore();
                return token;
            });
    }

    public async exchangeForScalarToken(openidTokenObject: IOpenIDToken): Promise<string> {
        const scalarRestUrl = new URL(this.apiUrl + "/register");
        scalarRestUrl.searchParams.set("v", imApiVersion);

        const res = await fetch(scalarRestUrl, {
            method: "POST",
            body: JSON.stringify(openidTokenObject),
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            throw new Error(`Scalar request failed: ${res.status}`);
        }

        const body = await res.json();
        if (!body?.scalar_token) {
            throw new Error("Missing scalar_token in response");
        }

        return body.scalar_token;
    }

    public async getScalarPageTitle(url: string): Promise<string> {
        const scalarPageLookupUrl = new URL(this.getStarterLink(this.apiUrl + "/widgets/title_lookup"));
        scalarPageLookupUrl.searchParams.set("curl", encodeURIComponent(url));

        const res = await fetch(scalarPageLookupUrl, {
            method: "GET",
        });

        if (!res.ok) {
            throw new Error(`Scalar request failed: ${res.status}`);
        }

        const body = await res.json();
        return body?.page_title_cache_item?.cached_title;
    }

    /**
     * Mark all assets associated with the specified widget as "disabled" in the
     * integration manager database.
     * This can be useful to temporarily prevent purchased assets from being displayed.
     * @param  {WidgetType} widgetType The Widget Type to disable assets for
     * @param  {string} widgetId   The widget ID to disable assets for
     * @return {Promise}           Resolves on completion
     */
    public async disableWidgetAssets(widgetType: WidgetType, widgetId: string): Promise<void> {
        const url = new URL(this.getStarterLink(this.apiUrl + "/widgets/set_assets_state"));
        url.searchParams.set("widget_type", widgetType.preferred);
        url.searchParams.set("widget_id", widgetId);
        url.searchParams.set("state", "disable");

        const res = await fetch(url, {
            method: "GET", // XXX: Actions shouldn't be GET requests
        });

        if (!res.ok) {
            throw new Error(`Scalar request failed: ${res.status}`);
        }

        const body = await res.text();
        if (!body) {
            throw new Error("Failed to set widget assets state");
        }
    }

    public getScalarInterfaceUrlForRoom(room: Room, screen?: string, id?: string): string {
        const roomId = room.roomId;
        const roomName = room.name;
        let url = this.uiUrl;
        if (this.scalarToken) url += "?scalar_token=" + encodeURIComponent(this.scalarToken);
        url += "&room_id=" + encodeURIComponent(roomId);
        url += "&room_name=" + encodeURIComponent(roomName);
        url += "&theme=" + encodeURIComponent(SettingsStore.getValue("theme"));
        if (id) {
            url += "&integ_id=" + encodeURIComponent(id);
        }
        if (screen) {
            url += "&screen=" + encodeURIComponent(screen);
        }
        return url;
    }

    public getStarterLink(starterLinkUrl: string): string {
        if (!this.scalarToken) return starterLinkUrl;
        return starterLinkUrl + "?scalar_token=" + encodeURIComponent(this.scalarToken);
    }
}
