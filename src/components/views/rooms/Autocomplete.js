import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import flatMap from 'lodash/flatMap';
import sdk from '../../../index';

import {getCompletions} from '../../../autocomplete/Autocompleter';

export default class Autocomplete extends React.Component {
    constructor(props) {
        super(props);

        this.onConfirm = this.onConfirm.bind(this);

        this.state = {
            // list of completionResults, each containing completions
            completions: [],

            // array of completions, so we can look up current selection by offset quickly
            completionList: [],

            // how far down the completion list we are
            selectionOffset: 0,
        };
    }

    componentWillReceiveProps(props, state) {
        if (props.query === this.props.query) {
            return;
        }

        getCompletions(props.query, props.selection).forEach(completionResult => {
            try {
                completionResult.completions.then(completions => {
                    let i = this.state.completions.findIndex(
                        completion => completion.provider === completionResult.provider
                    );

                    i = i === -1 ? this.state.completions.length : i;
                    let newCompletions = Object.assign([], this.state.completions);
                    completionResult.completions = completions;
                    newCompletions[i] = completionResult;

                    this.setState({
                        completions: newCompletions,
                        completionList: flatMap(newCompletions, provider => provider.completions),
                    });
                }, err => {
                    console.error(err);
                });
            } catch (e) {
                // An error in one provider shouldn't mess up the rest.
                console.error(e);
            }
        });
    }

    countCompletions(): number {
        return this.state.completions.map(completionResult => {
            return completionResult.completions.length;
        }).reduce((l, r) => l + r);
    }

    // called from MessageComposerInput
    onUpArrow(): boolean {
        let completionCount = this.countCompletions(),
            selectionOffset = (completionCount + this.state.selectionOffset - 1) % completionCount;
        if (!completionCount) {
            return false;
        }
        this.setSelection(selectionOffset);
        return true;
    }

    // called from MessageComposerInput
    onDownArrow(): boolean {
        let completionCount = this.countCompletions(),
            selectionOffset = (this.state.selectionOffset + 1) % completionCount;
        if (!completionCount) {
            return false;
        }
        this.setSelection(selectionOffset);
        return true;
    }

    /** called from MessageComposerInput
     * @returns {boolean} whether confirmation was handled
     */
    onConfirm(): boolean {
        if (this.countCompletions() === 0) {
            return false;
        }

        let selectedCompletion = this.state.completionList[this.state.selectionOffset];
        this.props.onConfirm(selectedCompletion.range, selectedCompletion.completion);

        return true;
    }

    setSelection(selectionOffset: number) {
        this.setState({selectionOffset});
    }

    componentDidUpdate() {
        // this is the selected completion, so scroll it into view if needed
        const selectedCompletion = this.refs[`completion${this.state.selectionOffset}`];
        if (selectedCompletion && this.container) {
            const {offsetTop} = ReactDOM.findDOMNode(selectedCompletion);
            if (offsetTop > this.container.scrollTop + this.container.offsetHeight ||
                offsetTop < this.container.scrollTop) {
                this.container.scrollTop = offsetTop - this.container.offsetTop;
            }
        }
    }

    render() {
        const EmojiText = sdk.getComponent('views.elements.EmojiText');

        let position = 0;
        let renderedCompletions = this.state.completions.map((completionResult, i) => {
            let completions = completionResult.completions.map((completion, i) => {

                const className = classNames('mx_Autocomplete_Completion', {
                    'selected': position === this.state.selectionOffset,
                });
                let componentPosition = position;
                position++;

                let onMouseOver = () => this.setSelection(componentPosition);
                let onClick = () => {
                    this.setSelection(componentPosition);
                    this.onConfirm();
                };

                return React.cloneElement(completion.component, {
                    key: i,
                    ref: `completion${i}`,
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
        });

        return (
            <div className="mx_Autocomplete" ref={(e) => this.container = e}>
                {renderedCompletions}
            </div>
        );
    }
}

Autocomplete.propTypes = {
    // the query string for which to show autocomplete suggestions
    query: React.PropTypes.string.isRequired,

    // method invoked with range and text content when completion is confirmed
    onConfirm: React.PropTypes.func.isRequired,
};
