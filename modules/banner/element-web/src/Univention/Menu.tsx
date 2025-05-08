/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { FC, useEffect, useState } from "react";

import type { Api } from "@element-hq/element-web-module-api";
import { StaticConfig, UniventionConfig } from "../config";
import StaticMenu from "../Menu";
import { fetchNavigation } from "./navigation";
import SilentLogin from "./SilentLogin";

interface Props {
    api: Api;
    config: UniventionConfig;
    fallbackLogoUrl: string;
}

const Menu: FC<Props> = ({ api, config, fallbackLogoUrl }) => {
    const [loggedIn, setLoggedIn] = useState(false);
    const [data, setData] = useState<StaticConfig | null>();
    const language = api.i18n.language.toLowerCase().startsWith("de") ? "de-DE" : "en";

    useEffect(() => {
        let discard = false;

        setData(null);
        fetchNavigation(config.ics_url, language).then((data) => {
            if (discard) return;
            setData(data);
        });

        return (): void => {
            discard = true;
        };
    }, [config, language, loggedIn]);

    if (!loggedIn) {
        return <SilentLogin onLoggedIn={setLoggedIn} icsUrl={config.ics_url} />;
    }
    if (data) {
        return <StaticMenu api={api} config={data} fallbackLogoUrl={fallbackLogoUrl} />;
    }
    return <div />;
};

export default Menu;
