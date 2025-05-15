/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Module, Api, ModuleFactory } from "@element-hq/element-web-module-api";
import Translations from "./translations.json";
import { ModuleConfig, CONFIG_KEY } from "./config";
import Banner from "./Banner";
import { name as ModuleName } from "../package.json";

class BannerModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0";

    private config?: ModuleConfig;

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        this.api.i18n.register(Translations);

        try {
            this.config = ModuleConfig.parse(this.api.config.get(CONFIG_KEY));
        } catch (e) {
            console.error("Failed to init module", e);
            throw new Error(`Errors in module configuration for "${ModuleName}"`);
        }

        const div = document.createElement("div");
        this.api.rootNode.before(div);

        const root = this.api.createRoot(div);
        root.render(
            <Banner
                api={this.api}
                logoUrl={this.config.logo_url}
                href={this.config.logo_link_url}
                menu={this.config.menu}
            />,
        );
    }
}

export default BannerModule satisfies ModuleFactory;
