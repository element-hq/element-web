/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import React from "react";
import classNames from "classnames";
import { VisibilityOffIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type MediaEventHelper } from "../../../utils/MediaEventHelper";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import Spinner from "../elements/Spinner";
import { _t, _td, type TranslationKey } from "../../../languageHandler";

interface IProps {
    mxEvent: MatrixEvent;

    // XXX: It can take a cycle or two for the MessageActionBar to have all the props/setup
    // required to get us a MediaEventHelper, so we use a getter function instead to prod for
    // one.
    mediaEventHelperGet: () => MediaEventHelper | undefined;
}

interface IState {
    loading: boolean;
    blob?: Blob;
    tooltip: TranslationKey;
}

export default class HideActionButton extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            loading: false,
            tooltip: _td("timeline|download_action_downloading"),
        };
    }

    private onClick = async (): Promise<void> => {};

    public render(): React.ReactNode {
        let spinner: JSX.Element | undefined;
        if (this.state.loading) {
            spinner = <Spinner w={18} h={18} />;
        }

        const classes = classNames({
            mx_MessageActionBar_iconButton: true,
            mx_MessageActionBar_downloadButton: true,
            mx_MessageActionBar_downloadSpinnerButton: !!spinner,
        });

        return (
            <RovingAccessibleButton
                className={classes}
                title={spinner ? _t(this.state.tooltip) : _t("action|download")}
                onClick={this.onClick}
                disabled={!!spinner}
                placement="left"
            >
                <VisibilityOffIcon />
                {spinner}
            </RovingAccessibleButton>
        );
    }
}
