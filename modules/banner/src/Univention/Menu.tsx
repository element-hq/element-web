/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC, useEffect, useState } from "react";
import { type Api } from "@element-hq/element-web-module-api";

import { type StaticConfig, type UniventionConfig } from "../config";
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
    const [data, setData] = useState<StaticConfig | Error>();
    const language = api.i18n.language.toLowerCase().startsWith("de") ? "de-DE" : "en";

    useEffect(() => {
        let discard = false;

        setData(undefined);
        fetchNavigation(config.ics_url, language)
            .then((data) => {
                if (discard) return;
                setData(data);
            })
            .catch((error) => {
                if (discard) return;
                setData(error);
            });

        return (): void => {
            discard = true;
        };
    }, [config, language, loggedIn]);

    return (
        <>
            {!loggedIn && <SilentLogin onLoggedIn={setLoggedIn} icsUrl={config.ics_url} />}
            <StaticMenu api={api} config={data ?? null} fallbackLogoUrl={config.logo_url ?? fallbackLogoUrl} />
        </>
    );
};

export default Menu;
