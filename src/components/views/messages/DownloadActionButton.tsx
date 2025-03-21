/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import React, { type JSX } from "react";
import classNames from "classnames";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type MediaEventHelper } from "../../../utils/MediaEventHelper";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import Spinner from "../elements/Spinner";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import { FileDownloader } from "../../../utils/FileDownloader";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";

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

export default class DownloadActionButton extends React.PureComponent<IProps, IState> {
    private downloader = new FileDownloader();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            loading: false,
            tooltip: _td("timeline|download_action_downloading"),
        };
    }

    private onDownloadClick = async (): Promise<void> => {
        try {
            await this.doDownload();
        } catch (e) {
            Modal.createDialog(ErrorDialog, {
                title: _t("timeline|download_failed"),
                description: (
                    <>
                        <div>{_t("timeline|download_failed_description")}</div>
                        <div>{e instanceof Error ? e.toString() : ""}</div>
                    </>
                ),
            });
            this.setState({ loading: false });
        }
    };

    private async doDownload(): Promise<void> {
        const mediaEventHelper = this.props.mediaEventHelperGet();
        if (this.state.loading || !mediaEventHelper) return;

        if (mediaEventHelper.media.isEncrypted) {
            this.setState({ tooltip: _td("timeline|download_action_decrypting") });
        }

        this.setState({ loading: true });

        if (this.state.blob) {
            // Cheat and trigger a download, again.
            return this.downloadBlob(this.state.blob);
        }

        const blob = await mediaEventHelper.sourceBlob.value;
        this.setState({ blob });
        await this.downloadBlob(blob);
    }

    private async downloadBlob(blob: Blob): Promise<void> {
        await this.downloader.download({
            blob,
            name: this.props.mediaEventHelperGet()!.fileName,
        });
        this.setState({ loading: false });
    }

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
                onClick={this.onDownloadClick}
                disabled={!!spinner}
                placement="left"
            >
                <DownloadIcon />
                {spinner}
            </RovingAccessibleButton>
        );
    }
}
