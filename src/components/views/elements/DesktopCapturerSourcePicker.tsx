/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React from 'react';
import { _t } from '../../../languageHandler';
import BaseDialog from "..//dialogs/BaseDialog"
import AccessibleButton from './AccessibleButton';
import {getDesktopCapturerSources} from "matrix-js-sdk/src/webrtc/call";
import {replaceableComponent} from "../../../utils/replaceableComponent";

export interface DesktopCapturerSource {
    id: string;
    name: string;
    thumbnailURL;
}

export enum Tabs {
    Screens = "screens",
    Windows = "windows",
}

export interface DesktopCapturerSourceIProps {
    source: DesktopCapturerSource;
    onSelect(source: DesktopCapturerSource): void;
}

export class ExistingSource extends React.Component<DesktopCapturerSourceIProps> {
    constructor(props) {
        super(props);
    }

    onClick = (ev) => {
        this.props.onSelect(this.props.source);
    }

    render() {
        return (
            <AccessibleButton
                className="mx_desktopCapturerSourcePicker_stream_button"
                title={this.props.source.name}
                onClick={this.onClick} >
                <img
                    className="mx_desktopCapturerSourcePicker_stream_thumbnail"
                    src={this.props.source.thumbnailURL}
                />
                <span className="mx_desktopCapturerSourcePicker_stream_name">{this.props.source.name}</span>
            </AccessibleButton>
        );
    }
}

export interface DesktopCapturerSourcePickerIState {
    selectedTab: Tabs;
    sources: Array<DesktopCapturerSource>;
}
export interface DesktopCapturerSourcePickerIProps {
    onFinished(source: DesktopCapturerSource): void;
}

@replaceableComponent("views.elements.DesktopCapturerSourcePicker")
export default class DesktopCapturerSourcePicker extends React.Component<
    DesktopCapturerSourcePickerIProps,
    DesktopCapturerSourcePickerIState
    > {
    interval;

    constructor(props) {
        super(props);

        this.state = {
            selectedTab: Tabs.Screens,
            sources: [],
        };
    }

    async componentDidMount() {
        // setInterval() first waits and then executes, therefore
        // we call getDesktopCapturerSources() here without any delay.
        // Otherwise the dialog would be left empty for some time.
        this.setState({
            sources: await getDesktopCapturerSources(),
        });

        // We update the sources every 500ms to get newer thumbnails
        this.interval = setInterval(async () => {
            this.setState({
                sources: await getDesktopCapturerSources(),
            });
        }, 500);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    onSelect = (source) => {
        this.props.onFinished(source);
    }

    onScreensClick = (ev) => {
        this.setState({selectedTab: Tabs.Screens});
    }

    onWindowsClick = (ev) => {
        this.setState({selectedTab: Tabs.Windows});
    }

    onCloseClick = (ev) => {
        this.props.onFinished(null);
    }

    render() {
        let sources;
        if (this.state.selectedTab === Tabs.Screens) {
            sources = this.state.sources
                .filter((source) => {
                    return source.id.startsWith("screen");
                })
                .map((source) => {
                    return <ExistingSource source={source} onSelect={this.onSelect} key={source.id} />;
                });
        } else {
            sources = this.state.sources
                .filter((source) => {
                    return source.id.startsWith("window");
                })
                .map((source) => {
                    return <ExistingSource source={source} onSelect={this.onSelect} key={source.id} />;
                });
        }

        const buttonStyle = "mx_desktopCapturerSourcePicker_tabLabel";
        const screensButtonStyle = buttonStyle + ((this.state.selectedTab === Tabs.Screens) ? "_selected" : "");
        const windowsButtonStyle = buttonStyle + ((this.state.selectedTab === Tabs.Windows) ? "_selected" : "");

        return (
            <BaseDialog
                className="mx_desktopCapturerSourcePicker"
                onFinished={this.onCloseClick}
                title={_t("Share your screen")}
            >
                <div className="mx_desktopCapturerSourcePicker_tabLabels">
                    <AccessibleButton
                        className={screensButtonStyle}
                        onClick={this.onScreensClick}
                    >
                        {_t("Screens")}
                    </AccessibleButton>
                    <AccessibleButton
                        className={windowsButtonStyle}
                        onClick={this.onWindowsClick}
                    >
                        {_t("Windows")}
                    </AccessibleButton>
                </div>
                <div className="mx_desktopCapturerSourcePicker_panel">
                    { sources }
                </div>
            </BaseDialog>
        );
    }
}
