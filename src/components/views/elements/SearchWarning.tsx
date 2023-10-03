/*
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

import React, { ReactNode } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import EventIndexPeg from "../../../indexing/EventIndexPeg";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import AccessibleButton, { ButtonEvent } from "./AccessibleButton";

export enum WarningKind {
    Files,
    Search,
}

interface IProps {
    isRoomEncrypted?: boolean;
    kind: WarningKind;
}

export default function SearchWarning({ isRoomEncrypted, kind }: IProps): JSX.Element {
    if (!isRoomEncrypted) return <></>;
    if (EventIndexPeg.get()) return <></>;

    if (EventIndexPeg.error) {
        return (
            <div className="mx_SearchWarning">
                {_t(
                    "seshat|error_initialising",
                    {},
                    {
                        a: (sub) => (
                            <AccessibleButton
                                kind="link_inline"
                                onClick={(evt: ButtonEvent) => {
                                    evt.preventDefault();
                                    dis.dispatch({
                                        action: Action.ViewUserSettings,
                                        initialTabId: UserTab.Security,
                                    });
                                }}
                            >
                                {sub}
                            </AccessibleButton>
                        ),
                    },
                )}
            </div>
        );
    }

    const brand = SdkConfig.get("brand");
    const desktopBuilds = SdkConfig.getObject("desktop_builds");

    let text: ReactNode | undefined;
    let logo: JSX.Element | undefined;
    if (desktopBuilds?.get("available")) {
        logo = <img alt="" src={desktopBuilds.get("logo")} />;
        const buildUrl = desktopBuilds.get("url");
        switch (kind) {
            case WarningKind.Files:
                text = _t(
                    "seshat|warning_kind_files_app",
                    {},
                    {
                        a: (sub) => (
                            <a href={buildUrl} target="_blank" rel="noreferrer noopener">
                                {sub}
                            </a>
                        ),
                    },
                );
                break;
            case WarningKind.Search:
                text = _t(
                    "seshat|warning_kind_search_app",
                    {},
                    {
                        a: (sub) => (
                            <a href={buildUrl} target="_blank" rel="noreferrer noopener">
                                {sub}
                            </a>
                        ),
                    },
                );
                break;
        }
    } else {
        switch (kind) {
            case WarningKind.Files:
                text = _t("seshat|warning_kind_files", { brand });
                break;
            case WarningKind.Search:
                text = _t("seshat|warning_kind_search", { brand });
                break;
        }
    }

    // for safety
    if (!text) {
        logger.warn("Unknown desktop builds warning kind: ", kind);
        return <></>;
    }

    return (
        <div className="mx_SearchWarning">
            {logo}
            <span>{text}</span>
        </div>
    );
}
