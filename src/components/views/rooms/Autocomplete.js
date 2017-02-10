import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';
import sdk from '../../../index';
import type {Completion, SelectionRange} from '../../../autocomplete/Autocompleter';
import Q from 'q';

import {getCompletions} from '../../../autocomplete/Autocompleter';

const COMPOSER_SELECTED = 0;

export default class Autocomplete extends React.Component {

    constructor(props) {
        super(props);

        this.completionPromise = null;
        this.hide = this.hide.bind(this);
        this.onCompletionClicked = this.onCompletionClicked.bind(this);

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

    async componentWillReceiveProps(props, state) {
        if (props.query === this.props.query) {
            return null;
        }

        return await this.complete(props.query, props.selection);
    }

    async complete(query, selection) {
        let forceComplete = this.state.forceComplete;
        const completionPromise = getCompletions(query, selection, forceComplete);
        this.completionPromise = completionPromise;
        const completions = await this.completionPromise;

        // There's a newer completion request, so ignore results.
        if (completionPromise !== this.completionPromise) {
            return;
        }

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

        // If no completions were returned, we should turn off force completion.
        forceComplete = false;

        let hide = this.state.hide;
        // These are lists of booleans that indicate whether whether the corresponding provider had a matching pattern
        const oldMatches = this.state.completions.map((completion) => !!completion.command.command),
            newMatches = completions.map((completion) => !!completion.command.command);

        // So, essentially, we re-show autocomplete if any provider finds a new pattern or stops finding an old one
        if (!isEqual(oldMatches, newMatches)) {
            hide = false;
        }

        this.setState({
            completions,
            completionList,
            selectionOffset,
            hide,
            forceComplete,
        });
    }

    countCompletions(): number {
        return this.state.completionList.length;
    }

    // called from MessageComposerInput
    onUpArrow(): ?Completion {
        const completionCount = this.countCompletions();
        // completionCount + 1, since 0 means composer is selected
        const selectionOffset = (completionCount + 1 + this.state.selectionOffset - 1)
            % (completionCount + 1);
        if (!completionCount) {
            return null;
        }
        this.setSelection(selectionOffset);
        return selectionOffset === COMPOSER_SELECTED ? null : this.state.completionList[selectionOffset - 1];
    }

    // called from MessageComposerInput
    onDownArrow(): ?Completion {
        const completionCount = this.countCompletions();
        // completionCount + 1, since 0 means composer is selected
        const selectionOffset = (this.state.selectionOffset + 1) % (completionCount + 1);
        if (!completionCount) {
            return null;
        }
        this.setSelection(selectionOffset);
        return selectionOffset === COMPOSER_SELECTED ? null : this.state.completionList[selectionOffset - 1];
    }

    onEscape(e): boolean {
        const completionCount = this.countCompletions();
        if (completionCount === 0) {
            // autocomplete is already empty, so don't preventDefault
            return;
        }

        e.preventDefault();

        // selectionOffset = 0, so we don't end up completing when autocomplete is hidden
        this.hide();
    }

    hide() {
        this.setState({hide: true, selectionOffset: 0});
    }

    forceComplete() {
        const done = Q.defer();
        this.setState({
            forceComplete: true,
            hide: false,
        }, () => {
            this.complete(this.props.query, this.props.selection).then(() => {
                done.resolve();
            });
        });
        return done.promise;
    }

    onCompletionClicked(): boolean {
        if (this.countCompletions() === 0 || this.state.selectionOffset === COMPOSER_SELECTED) {
            return false;
        }

        this.props.onConfirm(this.state.completionList[this.state.selectionOffset - 1]);
        this.hide();

        return true;
    }

    setSelection(selectionOffset: number) {
        this.setState({selectionOffset, hide: false});
    }

    componentDidUpdate() {
        // this is the selected completion, so scroll it into view if needed
        const selectedCompletion = this.refs[`completion${this.state.selectionOffset}`];
        if (selectedCompletion && this.container) {
            const domNode = ReactDOM.findDOMNode(selectedCompletion);
            const offsetTop = domNode && domNode.offsetTop;
            if (offsetTop > this.container.scrollTop + this.container.offsetHeight ||
                offsetTop < this.container.scrollTop) {
                this.container.scrollTop = offsetTop - this.container.offsetTop;
            }
        }
    }

    setState(state, func) {
        super.setState(state, func);
        console.log(state);
    }

    render() {
        const EmojiText = sdk.getComponent('views.elements.EmojiText');

        let position = 1;
        const renderedCompletions = this.state.completions.map((completionResult, i) => {
            const completions = completionResult.completions.map((completion, i) => {
                const className = classNames('mx_Autocomplete_Completion', {
                    'selected': position === this.state.selectionOffset,
                });
                const componentPosition = position;
                position++;

                const onMouseOver = () => this.setSelection(componentPosition);
                const onClick = () => {
                    this.setSelection(componentPosition);
                    this.onCompletionClicked();
                };

                return React.cloneElement(completion.component, {
                    key: i,
                    ref: `completion${position - 1}`,
                    className,
                    onMouseOver,
                    onClick,
                });
            });


            return completions.length > 0 ? (
                <div key={i} className="mx_Autocomplete_ProviderSection">
                    <EmojiText element="div" className="mx_Autocomplete_provider_name">{completionResult.provider.getName()}</EmojiText>
                    {completionResult.provider.renderCompletions(completions)}
                </div>
            ) : null;
        }).filter((completion) => !!completion);

        return !this.state.hide && renderedCompletions.length > 0 ? (
            <div className="mx_Autocomplete" ref={(e) => this.container = e}>
                {renderedCompletions}
            </div>
        ) : null;
    }
}

Autocomplete.propTypes = {
    // the query string for which to show autocomplete suggestions
    query: React.PropTypes.string.isRequired,

    // method invoked with range and text content when completion is confirmed
    onConfirm: React.PropTypes.func.isRequired,
};
