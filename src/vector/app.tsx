/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// To ensure we load the browser-matrix version first
import "matrix-js-sdk/src/browser-index";

import React, { ReactElement } from "react";
import PlatformPeg from "matrix-react-sdk/src/PlatformPeg";
import { UserFriendlyError } from "matrix-react-sdk/src/languageHandler";
import AutoDiscoveryUtils from "matrix-react-sdk/src/utils/AutoDiscoveryUtils";
import { AutoDiscovery, ClientConfig } from "matrix-js-sdk/src/autodiscovery";
import * as Lifecycle from "matrix-react-sdk/src/Lifecycle";
import SdkConfig, { parseSsoRedirectOptions } from "matrix-react-sdk/src/SdkConfig";
import { IConfigOptions } from "matrix-react-sdk/src/IConfigOptions";
import { logger } from "matrix-js-sdk/src/logger";
import { createClient } from "matrix-js-sdk/src/matrix";
import { SnakedObject } from "matrix-react-sdk/src/utils/SnakedObject";
import MatrixChat from "matrix-react-sdk/src/components/structures/MatrixChat";
import { ValidatedServerConfig } from "matrix-react-sdk/src/utils/ValidatedServerConfig";
import { QueryDict, encodeParams } from "matrix-js-sdk/src/utils";

import { parseQs } from "./url_utils";
import VectorBasePlatform from "./platform/VectorBasePlatform";
import { getInitialScreenAfterLogin, getScreenFromLocation, init as initRouting, onNewScreen } from "./routing";

// add React and ReactPerf to the global namespace, to make them easier to access via the console
// this incidentally means we can forget our React imports in JSX files without penalty.
window.React = React;

logger.log(`Application is running in ${process.env.NODE_ENV} mode`);

window.matrixLogger = logger;

// We use this to work out what URL the SDK should
// pass through when registering to allow the user to
// click back to the client having registered.
// It's up to us to recognise if we're loaded with
// this URL and tell MatrixClient to resume registration.
//
// If we're in electron, we should never pass through a file:// URL otherwise
// the identity server will try to 302 the browser to it, which breaks horribly.
// so in that instance, hardcode to use app.element.io for now instead.
function makeRegistrationUrl(params: QueryDict): string {
    let url: string;
    if (window.location.protocol === "vector:") {
        url = "https://app.element.io/#/register";
    } else {
        url = window.location.protocol + "//" + window.location.host + window.location.pathname + "#/register";
    }

    const encodedParams = encodeParams(params);
    if (encodedParams) {
        url += "?" + encodedParams;
    }

    return url;
}

function onTokenLoginCompleted(): void {
    // if we did a token login, we're now left with the token, hs and is
    // url as query params in the url;
    // if we did an oidc authorization code flow login, we're left with the auth code and state
    // as query params in the url;
    // a little nasty but let's redirect to clear them.
    const url = new URL(window.location.href);

    url.searchParams.delete("loginToken");
    url.searchParams.delete("state");
    url.searchParams.delete("code");

    logger.log(`Redirecting to ${url.href} to drop delegated authentication params from queryparams`);
    window.history.replaceState(null, "", url.href);
}

export async function loadApp(fragParams: {}): Promise<ReactElement> {
    initRouting();
    const platform = PlatformPeg.get();

    const params = parseQs(window.location);

    const urlWithoutQuery = window.location.protocol + "//" + window.location.host + window.location.pathname;
    logger.log("Vector starting at " + urlWithoutQuery);

    (platform as VectorBasePlatform).startUpdater();

    // Don't bother loading the app until the config is verified
    const config = await verifyServerConfig();
    const snakedConfig = new SnakedObject<IConfigOptions>(config);

    // Before we continue, let's see if we're supposed to do an SSO redirect
    const [userId] = await Lifecycle.getStoredSessionOwner();
    const hasPossibleToken = !!userId;
    const isReturningFromSso = !!params.loginToken;
    const ssoRedirects = parseSsoRedirectOptions(config);
    let autoRedirect = ssoRedirects.immediate === true;
    // XXX: This path matching is a bit brittle, but better to do it early instead of in the app code.
    const isWelcomeOrLanding =
        window.location.hash === "#/welcome" || window.location.hash === "#" || window.location.hash === "";
    if (!autoRedirect && ssoRedirects.on_welcome_page && isWelcomeOrLanding) {
        autoRedirect = true;
    }
    if (!hasPossibleToken && !isReturningFromSso && autoRedirect) {
        logger.log("Bypassing app load to redirect to SSO");
        const tempCli = createClient({
            baseUrl: config.validated_server_config!.hsUrl,
            idBaseUrl: config.validated_server_config!.isUrl,
        });
        PlatformPeg.get()!.startSingleSignOn(tempCli, "sso", `/${getScreenFromLocation(window.location).screen}`);

        // We return here because startSingleSignOn() will asynchronously redirect us. We don't
        // care to wait for it, and don't want to show any UI while we wait (not even half a welcome
        // page). As such, just don't even bother loading the MatrixChat component.
        return <React.Fragment />;
    }

    const defaultDeviceName =
        snakedConfig.get("default_device_display_name") ?? platform?.getDefaultDeviceDisplayName();

    const initialScreenAfterLogin = getInitialScreenAfterLogin(window.location);

    return (
        <MatrixChat
            onNewScreen={onNewScreen}
            makeRegistrationUrl={makeRegistrationUrl}
            config={config}
            realQueryParams={params}
            startingFragmentQueryParams={fragParams}
            enableGuest={!config.disable_guests}
            onTokenLoginCompleted={onTokenLoginCompleted}
            initialScreenAfterLogin={initialScreenAfterLogin}
            defaultDeviceDisplayName={defaultDeviceName}
        />
    );
}

async function verifyServerConfig(): Promise<IConfigOptions> {
    let validatedConfig: ValidatedServerConfig;
    try {
        logger.log("Verifying homeserver configuration");

        // Note: the query string may include is_url and hs_url - we only respect these in the
        // context of email validation. Because we don't respect them otherwise, we do not need
        // to parse or consider them here.

        // Note: Although we throw all 3 possible configuration options through a .well-known-style
        // verification, we do not care if the servers are online at this point. We do moderately
        // care if they are syntactically correct though, so we shove them through the .well-known
        // validators for that purpose.

        const config = SdkConfig.get();
        let wkConfig = config["default_server_config"]; // overwritten later under some conditions
        const serverName = config["default_server_name"];
        const hsUrl = config["default_hs_url"];
        const isUrl = config["default_is_url"];

        const incompatibleOptions = [wkConfig, serverName, hsUrl].filter((i) => !!i);
        if (hsUrl && (wkConfig || serverName)) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UserFriendlyError(
                "Invalid configuration: a default_hs_url can't be specified along with default_server_name " +
                    "or default_server_config",
            );
        }
        if (incompatibleOptions.length < 1) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UserFriendlyError("Invalid configuration: no default server specified.");
        }

        if (hsUrl) {
            logger.log("Config uses a default_hs_url - constructing a default_server_config using this information");
            logger.warn(
                "DEPRECATED CONFIG OPTION: In the future, default_hs_url will not be accepted. Please use " +
                    "default_server_config instead.",
            );

            wkConfig = {
                "m.homeserver": {
                    base_url: hsUrl,
                },
            };
            if (isUrl) {
                wkConfig["m.identity_server"] = {
                    base_url: isUrl,
                };
            }
        }

        let discoveryResult: ClientConfig | undefined;
        if (!serverName && wkConfig) {
            logger.log("Config uses a default_server_config - validating object");
            discoveryResult = await AutoDiscovery.fromDiscoveryConfig(wkConfig);
        }

        if (serverName) {
            logger.log("Config uses a default_server_name - doing .well-known lookup");
            logger.warn(
                "DEPRECATED CONFIG OPTION: In the future, default_server_name will not be accepted. Please " +
                    "use default_server_config instead.",
            );
            discoveryResult = await AutoDiscovery.findClientConfig(serverName);
            if (discoveryResult["m.homeserver"].base_url === null && wkConfig) {
                logger.log("Finding base_url failed but a default_server_config was found - using it as a fallback");
                discoveryResult = await AutoDiscovery.fromDiscoveryConfig(wkConfig);
            }
        }

        validatedConfig = AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, true);
    } catch (e) {
        const { hsUrl, isUrl, userId } = await Lifecycle.getStoredSessionVars();
        if (hsUrl && userId) {
            logger.error(e);
            logger.warn("A session was found - suppressing config error and using the session's homeserver");

            logger.log("Using pre-existing hsUrl and isUrl: ", { hsUrl, isUrl });
            validatedConfig = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl, true);
        } else {
            // the user is not logged in, so scream
            throw e;
        }
    }

    validatedConfig.isDefault = true;

    // Just in case we ever have to debug this
    logger.log("Using homeserver config:", validatedConfig);

    // Add the newly built config to the actual config for use by the app
    logger.log("Updating SdkConfig with validated discovery information");
    SdkConfig.add({ validated_server_config: validatedConfig });

    return SdkConfig.get();
}
