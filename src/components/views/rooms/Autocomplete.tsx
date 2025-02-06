/*
Copyright 2017-2024 New Vector Ltd.
Copyright 2016 Aviral Dasgupta

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type RefObject } from "react";
import classNames from "classnames";
import { flatMap } from "lodash";
import { type Room } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import Autocompleter, {
    type ICompletion,
    type ISelectionRange,
    type IProviderCompletions,
} from "../../../autocomplete/Autocompleter";
import SettingsStore from "../../../settings/SettingsStore";
import RoomContext from "../../../contexts/RoomContext";

const MAX_PROVIDER_MATCHES = 20;

export const generateCompletionDomId = (n: number): string => `mx_Autocomplete_Completion_${n}`;

interface IProps {
    // the query string for which to show autocomplete suggestions
    query: string;
    // method invoked with range and text content when completion is confirmed
    onConfirm: (completion: ICompletion) => void;
    // method invoked when selected (if any) completion changes
    onSelectionChange?: (partIndex: number) => void;
    selection: ISelectionRange;
    // The room in which we're autocompleting
    room: Room;
}

interface IState {
    completions: IProviderCompletions[];
    completionList: ICompletion[];
    selectionOffset: number;
    shouldShowCompletions: boolean;
    hide: boolean;
    forceComplete: boolean;
}

export default class Autocomplete extends React.PureComponent<IProps, IState> {
    public autocompleter?: Autocompleter;
    public queryRequested?: string;
    public debounceCompletionsRequest?: number;
    private containerRef = createRef<HTMLDivElement>();
    private completionRefs: Record<string, RefObject<HTMLElement>> = {};

    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        this.state = {
            // list of completionResults, each containing completions
            completions: [],

            // array of completions, so we can look up current selection by offset quickly
            completionList: [],

            // how far down the completion list we are (THIS IS 1-INDEXED!)
            selectionOffset: 1,

            // whether we should show completions if they're available
            shouldShowCompletions: true,

            hide: false,

            forceComplete: false,
        };
    }

    public componentDidMount(): void {
        this.autocompleter = new Autocompleter(this.props.room, this.context.timelineRenderingType);
        this.applyNewProps();
    }

    private applyNewProps(oldQuery?: string, oldRoom?: Room): void {
        if (oldRoom && this.props.room.roomId !== oldRoom.roomId) {
            this.autocompleter?.destroy();
            this.autocompleter = new Autocompleter(this.props.room);
        }

        // Query hasn't changed so don't try to complete it
        if (oldQuery === this.props.query) {
            return;
        }

        this.complete(this.props.query, this.props.selection);
    }

    public componentWillUnmount(): void {
        this.autocompleter?.destroy();
    }

    private complete(query: string, selection: ISelectionRange): Promise<void> {
        this.queryRequested = query;
        if (this.debounceCompletionsRequest) {
            clearTimeout(this.debounceCompletionsRequest);
        }
        if (query === "") {
            this.setState({
                // Clear displayed completions
                completions: [],
                completionList: [],
                // Reset selected completion
                selectionOffset: 1,
                // Hide the autocomplete box
                hide: true,
            });
            return Promise.resolve();
        }
        let autocompleteDelay = SettingsStore.getValue("autocompleteDelay");

        // Don't debounce if we are already showing completions
        if (this.state.completions.length > 0 || this.state.forceComplete) {
            autocompleteDelay = 0;
        }

        return new Promise((resolve) => {
            this.debounceCompletionsRequest = window.setTimeout(() => {
                resolve(this.processQuery(query, selection));
            }, autocompleteDelay);
        });
    }

    private async processQuery(query: string, selection: ISelectionRange): Promise<void> {
        if (!this.autocompleter) return;
        const completions = await this.autocompleter.getCompletions(
            query,
            selection,
            this.state.forceComplete,
            MAX_PROVIDER_MATCHES,
        );
        // Only ever process the completions for the most recent query being processed
        if (query !== this.queryRequested) {
            return;
        }
        await this.processCompletions(completions);
    }

    private async processCompletions(completions: IProviderCompletions[]): Promise<void> {
        const completionList = flatMap(completions, (provider) => provider.completions);

        // Reset selection when completion list becomes empty.
        let selectionOffset = 1;
        if (completionList.length > 0) {
            /* If the currently selected completion is still in the completion list,
             try to find it and jump to it. If not, select composer.
             */
            const currentSelection =
                this.state.selectionOffset <= 1
                    ? null
                    : this.state.completionList[this.state.selectionOffset - 1].completion;
            selectionOffset = completionList.findIndex((completion) => completion.completion === currentSelection);
            if (selectionOffset === -1) {
                selectionOffset = 1;
            } else {
                selectionOffset++; // selectionOffset is 1-indexed!
            }
        }

        let hide = true;
        // If `completion.command.command` is truthy, then a provider has matched with the query
        const anyMatches = completions.some((completion) => !!completion.command.command);
        if (anyMatches) {
            hide = false;
            if (this.props.onSelectionChange) {
                this.props.onSelectionChange(selectionOffset - 1);
            }
        }

        const deferred = defer<void>();
        this.setState(
            {
                completions,
                completionList,
                selectionOffset,
                hide,
                // Force complete is turned off each time since we can't edit the query in that case
                forceComplete: false,
            },
            deferred.resolve,
        );
        await deferred.promise;
    }

    public hasSelection(): boolean {
        return this.countCompletions() > 0 && this.state.selectionOffset !== 0;
    }

    public countCompletions(): number {
        return this.state.completionList.length;
    }

    // called from MessageComposerInput
    public moveSelection(delta: number): void {
        const completionCount = this.countCompletions();
        if (completionCount === 0) return; // there are no items to move the selection through

        // Note: selectionOffset 0 represents the unsubstituted text, while 1 means first pill selected
        const index = (this.state.selectionOffset + delta + completionCount - 1) % completionCount;
        this.setSelection(1 + index);
    }

    public onEscape(e: KeyboardEvent | React.KeyboardEvent): boolean | undefined {
        const completionCount = this.countCompletions();
        if (completionCount === 0) {
            // autocomplete is already empty, so don't preventDefault
            return;
        }

        e.preventDefault();

        // selectionOffset = 0, so we don't end up completing when autocomplete is hidden
        this.hide();
    }

    private hide = (): void => {
        this.setState({
            hide: true,
            selectionOffset: 1,
            completions: [],
            completionList: [],
        });
    };

    public forceComplete(): Promise<number> {
        return new Promise((resolve) => {
            this.setState(
                {
                    forceComplete: true,
                    hide: false,
                },
                () => {
                    this.complete(this.props.query, this.props.selection).then(() => {
                        resolve(this.countCompletions());
                    });
                },
            );
        });
    }

    public onConfirmCompletion = (): void => {
        this.onCompletionClicked(this.state.selectionOffset);
    };

    private onCompletionClicked = (selectionOffset: number): boolean => {
        const count = this.countCompletions();
        if (count === 0 || selectionOffset < 1 || selectionOffset > count) {
            return false;
        }

        this.props.onConfirm(this.state.completionList[selectionOffset - 1]);
        this.hide();

        return true;
    };

    private setSelection(selectionOffset: number): void {
        this.setState({ selectionOffset, hide: false });
        if (this.props.onSelectionChange) {
            this.props.onSelectionChange(selectionOffset - 1);
        }
    }

    public componentDidUpdate(prevProps: IProps): void {
        this.applyNewProps(prevProps.query, prevProps.room);
        // this is the selected completion, so scroll it into view if needed
        const selectedCompletion = this.completionRefs[`completion${this.state.selectionOffset}`]?.current;

        if (selectedCompletion) {
            selectedCompletion.scrollIntoView({
                behavior: "auto",
                block: "nearest",
            });
        } else if (this.containerRef.current) {
            this.containerRef.current.scrollTo({ top: 0 });
        }
    }

    public render(): React.ReactNode {
        let position = 1;
        const renderedCompletions = this.state.completions
            .map((completionResult, i) => {
                const completions = completionResult.completions.map((completion, j) => {
                    const selected = position === this.state.selectionOffset;
                    const className = classNames("mx_Autocomplete_Completion", { selected });
                    const componentPosition = position;
                    position++;

                    const onClick = (): void => {
                        this.onCompletionClicked(componentPosition);
                    };

                    const refId = `completion${componentPosition}`;
                    if (!this.completionRefs[refId]) {
                        this.completionRefs[refId] = createRef();
                    }
                    return React.cloneElement(completion.component, {
                        "key": j,
                        "ref": this.completionRefs[refId],
                        "id": generateCompletionDomId(componentPosition - 1), // 0 index the completion IDs
                        className,
                        onClick,
                        "aria-selected": selected,
                    });
                });

                return completions.length > 0 ? (
                    <div key={i} className="mx_Autocomplete_ProviderSection" role="presentation">
                        <div className="mx_Autocomplete_provider_name">{completionResult.provider.getName()}</div>
                        {completionResult.provider.renderCompletions(completions)}
                    </div>
                ) : null;
            })
            .filter((completion) => !!completion);

        return !this.state.hide && renderedCompletions.length > 0 ? (
            <div id="mx_Autocomplete" className="mx_Autocomplete" ref={this.containerRef} role="listbox">
                {renderedCompletions}
            </div>
        ) : null;
    }
}
