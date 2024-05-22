/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import React from "react";
import classNames from "classnames";

import { Icon as DownloadIcon } from "../../../../res/img/download.svg";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import Spinner from "../elements/Spinner";
import { _t, _td, TranslationKey } from "../../../languageHandler";
import { FileDownloader } from "../../../utils/FileDownloader";

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
        const mediaEventHelper = this.props.mediaEventHelperGet();
        if (this.state.loading || !mediaEventHelper) return;

        if (mediaEventHelper.media.isEncrypted) {
            this.setState({ tooltip: _td("timeline|download_action_decrypting") });
        }

        this.setState({ loading: true });

        if (this.state.blob) {
            // Cheat and trigger a download, again.
            return this.doDownload(this.state.blob);
        }

        const blob = await mediaEventHelper.sourceBlob.value;
        this.setState({ blob });
        await this.doDownload(blob);
    };

    private async doDownload(blob: Blob): Promise<void> {
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
