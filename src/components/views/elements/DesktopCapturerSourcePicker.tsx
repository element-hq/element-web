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
            <button
                className="desktop-capturer-selection-button"
                data-id={this.props.source.id}
                title={this.props.source.name}
                onClick={this.onClick} >
                <img
                    className="desktop-capturer-selection-thumbnail"
                    src={this.props.source.thumbnail.toDataURL()}
                />
                <span className="desktop-capturer-selection-name">{this.props.source.name}</span>
            </button>
        );
    }
}

export interface ElectronDesktopCapturerSource {
    display_id: string;
    id: string;
    name: string;
    thumbnail,
    appIcon,
}


export interface DesktopCapturerSourcePickerIProps {
    sources: Array<ElectronDesktopCapturerSource>;
    onFinished(source: ElectronDesktopCapturerSource): void,
}

// TODO: Figure out a way to update sources for live preview

export default class DesktopCapturerSourcePicker extends React.Component<DesktopCapturerSourcePickerIProps> {
    constructor(props) {
        super(props);
    }

    onSelect = (source) => {
        this.props.onFinished(source);
    }

    render() {
        const screens = this.props.sources
            .filter((source) => {
                return source.id.startsWith("screen");
            })
            .map((source) => {
                return <DesktopCapturerSource source={source} onSelect={this.onSelect} key={source.id} />;
            });

        const windows = this.props.sources
            .filter((source) => {
                return source.id.startsWith("window");
            })
            .map((source) => {
                return <DesktopCapturerSource source={source} onSelect={this.onSelect} key={source.id} />;
            });

        return (
            <BaseDialog className="mx_streamSelectorDialog">
                <h1>{_td("Screens")}</h1>
                <div className="desktop-capturer-selection-scroller">
                    { screens }
                </div>
                <h1>{_td("Windows")}</h1>
                <div className="desktop-capturer-selection-scroller">
                    { windows }
                </div>
            </BaseDialog>
        );
    }
}
