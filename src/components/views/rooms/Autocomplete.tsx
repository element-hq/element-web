/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 New Vector Ltd

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

import React, {createRef, KeyboardEvent} from 'react';
import classNames from 'classnames';
import flatMap from 'lodash/flatMap';
import {ICompletion, ISelectionRange, IProviderCompletions} from '../../../autocomplete/Autocompleter';
import {Room} from 'matrix-js-sdk/src/models/room';

import SettingsStore from "../../../settings/SettingsStore";
import Autocompleter from '../../../autocomplete/Autocompleter';

const COMPOSER_SELECTED = 0;

export const generateCompletionDomId = (number) => `mx_Autocomplete_Completion_${number}`;

interface IProps {
    // the query string for which to show autocomplete suggestions
    query: string;
    // method invoked with range and text content when completion is confirmed
    onConfirm: (ICompletion) => void;
    // method invoked when selected (if any) completion changes
    onSelectionChange?: (ICompletion, number) => void;
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
    autocompleter: Autocompleter;
    queryRequested: string;
    debounceCompletionsRequest: NodeJS.Timeout;
    private containerRef = createRef<HTMLDivElement>();

    constructor(props) {
        super(props);

        this.autocompleter = new Autocompleter(props.room);

        this.state = {
            // list of completionResults, each containing completions
            completions: [],

            // array of completions, so we can look up current selection by offset quickly
            completionList: [],

            // how far down the completion list we are (THIS IS 1-INDEXED!)
            selectionOffset: COMPOSER_SELECTED,

            // whether we should show completions if they're available
            shouldShowCompletions: true,

            hide: false,

            forceComplete: false,
        };
    }

    componentDidMount() {
        this.applyNewProps();
    }

    private applyNewProps(oldQuery?: string, oldRoom?: Room) {
        if (oldRoom && this.props.room.roomId !== oldRoom.roomId) {
            this.autocompleter.destroy();
            this.autocompleter = new Autocompleter(this.props.room);
        }

        // Query hasn't changed so don't try to complete it
        if (oldQuery === this.props.query) {
            return;
        }

        this.complete(this.props.query, this.props.selection);
    }

    componentWillUnmount() {
        this.autocompleter.destroy();
    }

    complete(query: string, selection: ISelectionRange) {
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
                selectionOffset: COMPOSER_SELECTED,
                // Hide the autocomplete box
                hide: true,
            });
            return Promise.resolve(null);
        }
        let autocompleteDelay = SettingsStore.getValue("autocompleteDelay");

        // Don't debounce if we are already showing completions
        if (this.state.completions.length > 0 || this.state.forceComplete) {
            autocompleteDelay = 0;
        }

        return new Promise((resolve) => {
            this.debounceCompletionsRequest = setTimeout(() => {
                resolve(this.processQuery(query, selection));
            }, autocompleteDelay);
        });
    }

    processQuery(query: string, selection: ISelectionRange) {
        return this.autocompleter.getCompletions(
            query, selection, this.state.forceComplete,
        ).then((completions) => {
            // Only ever process the completions for the most recent query being processed
            if (query !== this.queryRequested) {
                return;
            }
            this.processCompletions(completions);
        });
    }

    processCompletions(completions: IProviderCompletions[]) {
        const completionList = flatMap(completions, (provider) => provider.completions);

        // Reset selection when completion list becomes empty.
        let selectionOffset = COMPOSER_SELECTED;
        if (completionList.length > 0) {
            /* If the currently selected completion is still in the completion list,
             try to find it and jump to it. If not, select composer.
             */
            const currentSelection = this.state.selectionOffset === 0 ? null :
                this.state.completionList[this.state.selectionOffset - 1].completion;
            selectionOffset = completionList.findIndex(
                (completion) => completion.completion === currentSelection);
            if (selectionOffset === -1) {
                selectionOffset = COMPOSER_SELECTED;
            } else {
                selectionOffset++; // selectionOffset is 1-indexed!
            }
        }

        let hide = this.state.hide;
        // If `completion.command.command` is truthy, then a provider has matched with the query
        const anyMatches = completions.some((completion) => !!completion.command.command);
        hide = !anyMatches;

        this.setState({
            completions,
            completionList,
            selectionOffset,
            hide,
            // Force complete is turned off each time since we can't edit the query in that case
            forceComplete: false,
        });
    }

    hasSelection(): boolean {
        return this.countCompletions() > 0 && this.state.selectionOffset !== 0;
    }

    countCompletions(): number {
        return this.state.completionList.length;
    }

    // called from MessageComposerInput
    moveSelection(delta: number) {
        const completionCount = this.countCompletions();
        if (completionCount === 0) return; // there are no items to move the selection through

        // Note: selectionOffset 0 represents the unsubstituted text, while 1 means first pill selected
        const index = (this.state.selectionOffset + delta + completionCount + 1) % (completionCount + 1);
        this.setSelection(index);
    }

    onEscape(e: KeyboardEvent): boolean {
        const completionCount = this.countCompletions();
        if (completionCount === 0) {
            // autocomplete is already empty, so don't preventDefault
            return;
        }

        e.preventDefault();

        // selectionOffset = 0, so we don't end up completing when autocomplete is hidden
        this.hide();
    }

    hide = () => {
        this.setState({
            hide: true,
            selectionOffset: 0,
            completions: [],
            completionList: [],
        });
    };

    forceComplete() {
        return new Promise((resolve) => {
            this.setState({
                forceComplete: true,
                hide: false,
            }, () => {
                this.complete(this.props.query, this.props.selection).then(() => {
                    resolve(this.countCompletions());
                });
            });
        });
    }

    onCompletionClicked = (selectionOffset: number): boolean => {
        if (this.countCompletions() === 0 || selectionOffset === COMPOSER_SELECTED) {
            return false;
        }

        this.props.onConfirm(this.state.completionList[selectionOffset - 1]);
        this.hide();

        return true;
    };

    setSelection(selectionOffset: number) {
        this.setState({selectionOffset, hide: false});
        if (this.props.onSelectionChange) {
            this.props.onSelectionChange(this.state.completionList[selectionOffset - 1], selectionOffset - 1);
        }
    }

    componentDidUpdate(prevProps: IProps) {
        this.applyNewProps(prevProps.query, prevProps.room);
        // this is the selected completion, so scroll it into view if needed
        const selectedCompletion = this.refs[`completion${this.state.selectionOffset}`] as HTMLElement;

        if (selectedCompletion) {
            selectedCompletion.scrollIntoView({
                behavior: "auto",
                block: "nearest",
            });
        } else if (this.containerRef.current) {
            this.containerRef.current.scrollTo({ top: 0 });
        }
    }

    render() {
        let position = 1;
        const renderedCompletions = this.state.completions.map((completionResult, i) => {
            const completions = completionResult.completions.map((completion, j) => {
                const selected = position === this.state.selectionOffset;
                const className = classNames('mx_Autocomplete_Completion', {selected});
                const componentPosition = position;
                position++;

                const onClick = () => {
                    this.onCompletionClicked(componentPosition);
                };

                return React.cloneElement(completion.component, {
                    "key": j,
                    "ref": `completion${componentPosition}`,
                    "id": generateCompletionDomId(componentPosition - 1), // 0 index the completion IDs
                    className,
                    onClick,
                    "aria-selected": selected,
                });
            });


            return completions.length > 0 ? (
                <div key={i} className="mx_Autocomplete_ProviderSection">
                    <div className="mx_Autocomplete_provider_name">{ completionResult.provider.getName() }</div>
                    { completionResult.provider.renderCompletions(completions) }
                </div>
            ) : null;
        }).filter((completion) => !!completion);

        return !this.state.hide && renderedCompletions.length > 0 ? (
            <div className="mx_Autocomplete" ref={this.containerRef}>
                { renderedCompletions }
            </div>
        ) : null;
    }
}
