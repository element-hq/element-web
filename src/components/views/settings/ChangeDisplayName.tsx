/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import EditableTextContainer from "../elements/EditableTextContainer";

export default class ChangeDisplayName extends React.Component {
    private getDisplayName = async (): Promise<string> => {
        const cli = MatrixClientPeg.safeGet();
        try {
            const res = await cli.getProfileInfo(cli.getUserId()!);
            return res.displayname ?? "";
        } catch (e) {
            throw new Error("Failed to fetch display name");
        }
    };

    private changeDisplayName = (newDisplayname: string): Promise<{}> => {
        const cli = MatrixClientPeg.safeGet();
        return cli.setDisplayName(newDisplayname).catch(function () {
            throw new Error("Failed to set display name");
        });
    };

    public render(): React.ReactNode {
        return (
            <EditableTextContainer
                getInitialValue={this.getDisplayName}
                placeholder={_t("settings|general|name_placeholder")}
                blurToSubmit={true}
                onSubmit={this.changeDisplayName}
            />
        );
    }
}
