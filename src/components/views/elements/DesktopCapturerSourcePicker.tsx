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
import DialogButtons from "./DialogButtons"
import AccessibleButton from './AccessibleButton';
import { getDesktopCapturerSources } from "matrix-js-sdk/src/webrtc/call";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import classNames from 'classnames';

export interface DesktopCapturerSource {
    id: string;
    name: string;
    thumbnailURL;
}

export enum Tabs {
    Screens = "screen",
    Windows = "window",
}

export interface ExistingSourceIProps {
    source: DesktopCapturerSource;
    onSelect(source: DesktopCapturerSource): void;
    selected: boolean;
}

export class ExistingSource extends React.Component<ExistingSourceIProps> {
    constructor(props) {
        super(props);
    }

    onClick = (ev) => {
        this.props.onSelect(this.props.source);
    }

    render() {
        const classes = classNames({
            mx_desktopCapturerSourcePicker_stream_button: true,
            mx_desktopCapturerSourcePicker_stream_button_selected: this.props.selected,
        });

        return (
            <AccessibleButton
                className={classes}
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

export interface PickerIState {
    selectedTab: Tabs;
    sources: Array<DesktopCapturerSource>;
    selectedSource: DesktopCapturerSource | null;
}
export interface PickerIProps {
    onFinished(source: DesktopCapturerSource): void;
}

@replaceableComponent("views.elements.DesktopCapturerSourcePicker")
export default class DesktopCapturerSourcePicker extends React.Component<
    PickerIProps,
    PickerIState
    > {
    interval;

    constructor(props) {
        super(props);

        this.state = {
            selectedTab: Tabs.Screens,
            sources: [],
            selectedSource: null,
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
        this.setState({ selectedSource: source });
    }

    onShare = () => {
        this.props.onFinished(this.state.selectedSource);
    }

    onScreensClick = () => {
        if (this.state.selectedTab === Tabs.Screens) return;
        this.setState({
            selectedTab: Tabs.Screens,
            selectedSource: null,
        });
    }

    onWindowsClick = () => {
        if (this.state.selectedTab === Tabs.Windows) return;
        this.setState({
            selectedTab: Tabs.Windows,
            selectedSource: null,
        });
    }

    onCloseClick = () => {
        this.props.onFinished(null);
    }

    render() {
        const sources = this.state.sources.filter((source) => {
            return source.id.startsWith(this.state.selectedTab)
        });
        const sourceElements = sources.map((source) => {
            return (
                <ExistingSource
                    selected={this.state.selectedSource?.id === source.id}
                    source={source}
                    onSelect={this.onSelect}
                    key={source.id}
                />
            );
        });

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
                    { sourceElements }
                </div>
                <DialogButtons
                    primaryButton={_t("Share")}
                    hasCancel={true}
                    onCancel={this.onCloseClick}
                    onPrimaryButtonClick={this.onShare}
                    primaryDisabled={!this.state.selectedSource}
                />
            </BaseDialog>
        );
    }
}
