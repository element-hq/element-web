/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import { _t } from "../../../languageHandler";
import { Layout } from '../../../resizer/distributors/roomsublist2';
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import { ResizeNotifier } from "../../../utils/ResizeNotifier";
import RoomListStore from "../../../stores/room-list/RoomListStore2";

interface IProps {
    onKeyDown: (ev: React.KeyboardEvent) => void;
    onFocus: (ev: React.FocusEvent) => void;
    onBlur: (ev: React.FocusEvent) => void;
    resizeNotifier: ResizeNotifier;
    collapsed: boolean;
    searchFilter: string;
}

interface IState {
}

// TODO: Actually write stub
export class RoomSublist2 extends React.Component<any, any> {
    public setHeight(size: number) {
    }
}

export default class RoomList2 extends React.Component<IProps, IState> {
    private sublistRefs: { [tagId: string]: React.RefObject<RoomSublist2> } = {};
    private sublistSizes: { [tagId: string]: number } = {};
    private sublistCollapseStates: { [tagId: string]: boolean } = {};
    private unfilteredLayout: Layout;
    private filteredLayout: Layout;

    constructor(props: IProps) {
        super(props);

        this.loadSublistSizes();
        this.prepareLayouts();
    }

    public componentDidMount(): void {
        RoomListStore.instance.addListener(() => {
            console.log(RoomListStore.instance.orderedLists);
        });
    }

    private loadSublistSizes() {
        const sizesJson = window.localStorage.getItem("mx_roomlist_sizes");
        if (sizesJson) this.sublistSizes = JSON.parse(sizesJson);

        const collapsedJson = window.localStorage.getItem("mx_roomlist_collapsed");
        if (collapsedJson) this.sublistCollapseStates = JSON.parse(collapsedJson);
    }

    private saveSublistSizes() {
        window.localStorage.setItem("mx_roomlist_sizes", JSON.stringify(this.sublistSizes));
        window.localStorage.setItem("mx_roomlist_collapsed", JSON.stringify(this.sublistCollapseStates));
    }

    private prepareLayouts() {
        this.unfilteredLayout = new Layout((tagId: string, height: number) => {
            const sublist = this.sublistRefs[tagId];
            if (sublist) sublist.current.setHeight(height);

            // TODO: Check overflow

            // Don't store a height for collapsed sublists
            if (!this.sublistCollapseStates[tagId]) {
                this.sublistSizes[tagId] = height;
                this.saveSublistSizes();
            }
        }, this.sublistSizes, this.sublistCollapseStates, {
            allowWhitespace: false,
            handleHeight: 1,
        });

        this.filteredLayout = new Layout((tagId: string, height: number) => {
            const sublist = this.sublistRefs[tagId];
            if (sublist) sublist.current.setHeight(height);
        }, null, null, {
            allowWhitespace: false,
            handleHeight: 0,
        });
    }

    private collectSublistRef(tagId: string, ref: React.RefObject<RoomSublist2>) {
        if (!ref) {
            delete this.sublistRefs[tagId];
        } else {
            this.sublistRefs[tagId] = ref;
        }
    }

    public render() {
        return (
            <RovingTabIndexProvider handleHomeEnd={true} onKeyDown={this.props.onKeyDown}>
                {({onKeyDownHandler}) => (
                    <div
                        onFocus={this.props.onFocus}
                        onBlur={this.props.onBlur}
                        onKeyDown={onKeyDownHandler}
                        className="mx_RoomList"
                        role="tree"
                        aria-label={_t("Rooms")}
                        // Firefox sometimes makes this element focusable due to
                        // overflow:scroll;, so force it out of tab order.
                        tabIndex={-1}
                    >{_t("TODO")}</div>
                )}
            </RovingTabIndexProvider>
        );
    }
}
