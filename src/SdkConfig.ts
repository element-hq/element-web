/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import { Optional } from "matrix-events-sdk";
import { mergeWith } from "lodash";

import { SnakedObject } from "./utils/SnakedObject";
import { IConfigOptions, ISsoRedirectOptions } from "./IConfigOptions";
import { isObject, objectClone } from "./utils/objects";
import { DeepReadonly, Defaultize } from "./@types/common";

// see element-web config.md for docs, or the IConfigOptions interface for dev docs
export const DEFAULTS: DeepReadonly<IConfigOptions> = {
    brand: "Element",
    integrations_ui_url: "https://scalar.vector.im/",
    integrations_rest_url: "https://scalar.vector.im/api",
    uisi_autorageshake_app: "element-auto-uisi",

    jitsi: {
        preferred_domain: "meet.element.io",
    },
    element_call: {
        url: "https://call.element.io",
        use_exclusively: false,
        participant_limit: 8,
        brand: "Element Call",
    },

    // @ts-ignore - we deliberately use the camelCase version here so we trigger
    // the fallback behaviour. If we used the snake_case version then we'd break
    // everyone's config which has the camelCase property because our default would
    // be preferred over their config.
    desktopBuilds: {
        available: true,
        logo: require("../res/img/element-desktop-logo.svg").default,
        url: "https://element.io/get-started",
    },
    voice_broadcast: {
        chunk_length: 2 * 60, // two minutes
        max_length: 4 * 60 * 60, // four hours
    },

    feedback: {
        existing_issues_url:
            "https://github.com/vector-im/element-web/issues?q=is%3Aopen+is%3Aissue+sort%3Areactions-%2B1-desc",
        new_issue_url: "https://github.com/vector-im/element-web/issues/new/choose",
    },
};

export type ConfigOptions = Defaultize<IConfigOptions, typeof DEFAULTS>;

function mergeConfig(
    config: DeepReadonly<IConfigOptions>,
    changes: DeepReadonly<Partial<IConfigOptions>>,
): DeepReadonly<IConfigOptions> {
    // return { ...config, ...changes };
    return mergeWith(objectClone(config), changes, (objValue, srcValue) => {
        // Don't merge arrays, prefer values from newer object
        if (Array.isArray(objValue)) {
            return srcValue;
        }

        // Don't allow objects to get nulled out, this will break our types
        if (isObject(objValue) && !isObject(srcValue)) {
            return objValue;
        }
    });
}

type ObjectType<K extends keyof IConfigOptions> = IConfigOptions[K] extends object
    ? SnakedObject<NonNullable<IConfigOptions[K]>>
    : Optional<SnakedObject<NonNullable<IConfigOptions[K]>>>;

export default class SdkConfig {
    private static instance: DeepReadonly<IConfigOptions>;
    private static fallback: SnakedObject<DeepReadonly<IConfigOptions>>;

    private static setInstance(i: DeepReadonly<IConfigOptions>): void {
        SdkConfig.instance = i;
        SdkConfig.fallback = new SnakedObject(i);

        // For debugging purposes
        window.mxReactSdkConfig = i;
    }

    public static get(): IConfigOptions;
    public static get<K extends keyof IConfigOptions>(key: K, altCaseName?: string): IConfigOptions[K];
    public static get<K extends keyof IConfigOptions = never>(
        key?: K,
        altCaseName?: string,
    ): DeepReadonly<IConfigOptions> | DeepReadonly<IConfigOptions>[K] {
        if (key === undefined) {
            // safe to cast as a fallback - we want to break the runtime contract in this case
            return SdkConfig.instance || <IConfigOptions>{};
        }
        return SdkConfig.fallback.get(key, altCaseName);
    }

    public static getObject<K extends keyof IConfigOptions>(key: K, altCaseName?: string): ObjectType<K> {
        const val = SdkConfig.get(key, altCaseName);
        if (isObject(val)) {
            return new SnakedObject(val);
        }

        // return the same type for sensitive callers (some want `undefined` specifically)
        return (val === undefined ? undefined : null) as ObjectType<K>;
    }

    public static put(cfg: DeepReadonly<ConfigOptions>): void {
        SdkConfig.setInstance(mergeConfig(DEFAULTS, cfg));
    }

    /**
     * Resets the config.
     */
    public static reset(): void {
        SdkConfig.setInstance(mergeConfig(DEFAULTS, {})); // safe to cast - defaults will be applied
    }

    public static add(cfg: Partial<ConfigOptions>): void {
        SdkConfig.put(mergeConfig(SdkConfig.get(), cfg));
    }
}

export function parseSsoRedirectOptions(config: IConfigOptions): ISsoRedirectOptions {
    // Ignore deprecated options if the config is using new ones
    if (config.sso_redirect_options) return config.sso_redirect_options;

    // We can cheat here because the default is false anyways
    if (config.sso_immediate_redirect) return { immediate: true };

    // Default: do nothing
    return {};
}
