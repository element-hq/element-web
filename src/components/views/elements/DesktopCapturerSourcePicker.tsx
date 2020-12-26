/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import { _td } from '../../../languageHandler';
import BaseDialog from "..//dialogs/BaseDialog"
import AccessibleButton from './AccessibleButton';

export enum Tabs {
    Screens = "screens",
    Windows = "windows",
}
export interface ElectronDesktopCapturerSource {
    display_id: string;
    id: string;
    name: string;
    thumbnail,
    appIcon,
}
export interface DesktopCapturerSourceIProps {
    source: ElectronDesktopCapturerSource,
    onSelect(source: ElectronDesktopCapturerSource): void,
}

export class DesktopCapturerSource extends React.Component<DesktopCapturerSourceIProps> {
    constructor(props) {
        super(props);
    }

    onClick = (ev) => {
        //ev.stopPropagation();
        this.props.onSelect(this.props.source);
    }

    render() {
        return (
            <AccessibleButton
                className="mx_streamSelectorDialog_stream_button"
                data-id={this.props.source.id}
                title={this.props.source.name}
                onClick={this.onClick} >
                <img
                    className="mx_streamSelectorDialog_stream_thumbnail"
                    src={this.props.source.thumbnail.toDataURL()}
                />
                <span className="mx_streamSelectorDialog_stream_name">{this.props.source.name}</span>
            </AccessibleButton>
        );
    }
}


export interface DesktopCapturerSourcePickerIState {
    selectedTab: Tabs;
}
export interface DesktopCapturerSourcePickerIProps {
    sources: Array<ElectronDesktopCapturerSource>;
    onFinished(source: ElectronDesktopCapturerSource): void,
}

// TODO: Figure out a way to update sources for live preview

export default class DesktopCapturerSourcePicker extends React.Component<
    DesktopCapturerSourcePickerIProps,
    DesktopCapturerSourcePickerIState
    > {
    constructor(props) {
        super(props);

        this.state = {
            selectedTab: Tabs.Screens,
        }
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
            sources = this.props.sources
                .filter((source) => {
                    return source.id.startsWith("screen");
                })
                .map((source) => {
                    return <DesktopCapturerSource source={source} onSelect={this.onSelect} key={source.id} />;
                });
        } else {
            sources = this.props.sources
                .filter((source) => {
                    return source.id.startsWith("window");
                })
                .map((source) => {
                    return <DesktopCapturerSource source={source} onSelect={this.onSelect} key={source.id} />;
                });
        }
        const buttonStyle = "mx_streamSelectorDialog_tabLabel";
        const screensButtonStyle = buttonStyle + ((this.state.selectedTab === Tabs.Screens) ? "_selected" : "");
        const windowsButtonStyle = buttonStyle + ((this.state.selectedTab === Tabs.Windows) ? "_selected" : "");
        console.log(screensButtonStyle, windowsButtonStyle);

        return (
            <BaseDialog
                className="mx_streamSelectorDialog"
                onFinished={this.onCloseClick}
                title={_td("Share your screen")}
            >
                <div className="mx_streamSelectorDialog_tabLabels">
                    <AccessibleButton
                        className={screensButtonStyle}
                        onClick={this.onScreensClick}
                    >
                        {_td("Screens")}
                    </AccessibleButton>
                    <AccessibleButton
                        className={windowsButtonStyle}
                        onClick={this.onWindowsClick}
                    >
                        {_td("Windows")}
                    </AccessibleButton>
                </div>
                <div className="mx_streamSelectorDialog_panel">
                    { sources }
                </div>
            </BaseDialog>
        );
    }
}
