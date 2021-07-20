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

import { MatrixEvent } from "matrix-js-sdk/src";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import React, { createRef } from "react";
import { RovingAccessibleTooltipButton } from "../../../accessibility/RovingTabIndex";
import Spinner from "../elements/Spinner";
import classNames from "classnames";
import { _t } from "../../../languageHandler";
import { replaceableComponent } from "../../../utils/replaceableComponent";

interface IProps {
    mxEvent: MatrixEvent;

    // XXX: It can take a cycle or two for the MessageActionBar to have all the props/setup
    // required to get us a MediaEventHelper, so we use a getter function instead to prod for
    // one.
    mediaEventHelperGet: () => MediaEventHelper;
}

interface IState {
    loading: boolean;
    blob?: Blob;
}

@replaceableComponent("views.messages.DownloadActionButton")
export default class DownloadActionButton extends React.PureComponent<IProps, IState> {
    private iframe: React.RefObject<HTMLIFrameElement> = createRef();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            loading: false,
        };
    }

    private onDownloadClick = async () => {
        if (this.state.loading) return;

        this.setState({ loading: true });

        if (this.state.blob) {
            // Cheat and trigger a download, again.
            return this.onFrameLoad();
        }

        const blob = await this.props.mediaEventHelperGet().sourceBlob.value;
        this.setState({ blob });
    };

    private onFrameLoad = () => {
        this.setState({ loading: false });

        // we aren't showing the iframe, so we can send over the bare minimum styles and such.
        this.iframe.current.contentWindow.postMessage({
            imgSrc: "", // no image
            imgStyle: null,
            style: "",
            blob: this.state.blob,
            download: this.props.mediaEventHelperGet().fileName,
            textContent: "",
            auto: true, // autodownload
        }, '*');
    };

    public render() {
        let spinner: JSX.Element;
        if (this.state.loading) {
            spinner = <Spinner w={18} h={18} />;
        }

        const classes = classNames({
            'mx_MessageActionBar_maskButton': true,
            'mx_MessageActionBar_downloadButton': true,
            'mx_MessageActionBar_downloadSpinnerButton': !!spinner,
        });

        return <RovingAccessibleTooltipButton
            className={classes}
            title={spinner ? _t("Downloading") : _t("Download")}
            onClick={this.onDownloadClick}
            disabled={!!spinner}
        >
            { spinner }
            { this.state.blob && <iframe
                src="usercontent/" // XXX: Like MFileBody, this should come from the skin
                ref={this.iframe}
                onLoad={this.onFrameLoad}
                sandbox="allow-scripts allow-downloads allow-downloads-without-user-activation"
                style={{ display: "none" }}
            /> }
        </RovingAccessibleTooltipButton>;
    }
}
