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

import React from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import BaseDialog from "..//dialogs/BaseDialog";
import DialogButtons from "./DialogButtons";
import AccessibleButton from "./AccessibleButton";
import TabbedView, { Tab, TabLocation } from "../../structures/TabbedView";
import PlatformPeg from "../../../PlatformPeg";
import { NonEmptyArray } from "../../../@types/common";

export function getDesktopCapturerSources(): Promise<Array<DesktopCapturerSource>> {
    const options: GetSourcesOptions = {
        thumbnailSize: {
            height: 176,
            width: 312,
        },
        types: ["screen", "window"],
    };
    const plaf = PlatformPeg.get();
    return plaf ? plaf?.getDesktopCapturerSources(options) : Promise.resolve<DesktopCapturerSource[]>([]);
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
    public constructor(props: ExistingSourceIProps) {
        super(props);
    }

    private onClick = (): void => {
        this.props.onSelect(this.props.source);
    };

    public render(): React.ReactNode {
        const thumbnailClasses = classNames({
            mx_desktopCapturerSourcePicker_source_thumbnail: true,
            mx_desktopCapturerSourcePicker_source_thumbnail_selected: this.props.selected,
        });

        return (
            <AccessibleButton
                className="mx_desktopCapturerSourcePicker_source"
                title={this.props.source.name}
                onClick={this.onClick}
            >
                <img alt={this.props.source.name} className={thumbnailClasses} src={this.props.source.thumbnailURL} />
                <span className="mx_desktopCapturerSourcePicker_source_name">{this.props.source.name}</span>
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
    onFinished(sourceId?: string): void;
}

type TabId = "screen" | "window";

export default class DesktopCapturerSourcePicker extends React.Component<PickerIProps, PickerIState> {
    public interval?: number;

    public constructor(props: PickerIProps) {
        super(props);

        this.state = {
            selectedTab: Tabs.Screens,
            sources: [],
            selectedSource: null,
        };
    }

    public async componentDidMount(): Promise<void> {
        // window.setInterval() first waits and then executes, therefore
        // we call getDesktopCapturerSources() here without any delay.
        // Otherwise the dialog would be left empty for some time.
        this.setState({
            sources: await getDesktopCapturerSources(),
        });

        // We update the sources every 500ms to get newer thumbnails
        this.interval = window.setInterval(async (): Promise<void> => {
            this.setState({
                sources: await getDesktopCapturerSources(),
            });
        }, 500);
    }

    public componentWillUnmount(): void {
        clearInterval(this.interval);
    }

    private onSelect = (source: DesktopCapturerSource): void => {
        this.setState({ selectedSource: source });
    };

    private onShare = (): void => {
        this.props.onFinished(this.state.selectedSource?.id);
    };

    private onTabChange = (): void => {
        this.setState({ selectedSource: null });
    };

    private onCloseClick = (): void => {
        this.props.onFinished();
    };

    private getTab(type: TabId, label: string): Tab<TabId> {
        const sources = this.state.sources
            .filter((source) => source.id.startsWith(type))
            .map((source) => {
                return (
                    <ExistingSource
                        selected={this.state.selectedSource?.id === source.id}
                        source={source}
                        onSelect={this.onSelect}
                        key={source.id}
                    />
                );
            });

        return new Tab(type, label, null, <div className="mx_desktopCapturerSourcePicker_tab">{sources}</div>);
    }

    public render(): React.ReactNode {
        const tabs: NonEmptyArray<Tab<TabId>> = [
            this.getTab("screen", _t("Share entire screen")),
            this.getTab("window", _t("Application window")),
        ];

        return (
            <BaseDialog
                className="mx_desktopCapturerSourcePicker"
                onFinished={this.onCloseClick}
                title={_t("Share content")}
            >
                <TabbedView tabs={tabs} tabLocation={TabLocation.TOP} onChange={this.onTabChange} />
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
