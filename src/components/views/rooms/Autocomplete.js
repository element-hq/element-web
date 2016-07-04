import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import classNames from 'classnames';
import flatMap from 'lodash/flatMap';

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
        this.setSelection(selectionOffset);
        return true;
    }

    // called from MessageComposerInput
    onDownArrow(): boolean {
        let completionCount = this.countCompletions(),
            selectionOffset = (this.state.selectionOffset + 1) % completionCount;
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

    render() {
        let position = 0;
        let renderedCompletions = this.state.completions.map((completionResult, i) => {
            let completions = completionResult.completions.map((completion, i) => {
                let className = classNames('mx_Autocomplete_Completion', {
                    'selected': position === this.state.selectionOffset,
                });
                let componentPosition = position;
                position++;

                let onMouseOver = () => this.setSelection(componentPosition);
                let onClick = () => {
                    this.setSelection(componentPosition);
                    this.onConfirm();
                };

                return (
                    <div key={i}
                         className={className}
                         onMouseOver={onMouseOver}
                         onClick={onClick}>
                        {completion.component}
                    </div>
                );
            });


            return completions.length > 0 ? (
                <div key={i} className="mx_Autocomplete_ProviderSection">
                    <span className="mx_Autocomplete_provider_name">{completionResult.provider.getName()}</span>
                    <ReactCSSTransitionGroup
                        component="div"
                        transitionName="autocomplete"
                        transitionEnterTimeout={300}
                        transitionLeaveTimeout={300}>
                        {completions}
                    </ReactCSSTransitionGroup>
                </div>
            ) : null;
        });

        return (
            <div className="mx_Autocomplete">
                <ReactCSSTransitionGroup
                    component="div"
                    transitionName="autocomplete"
                    transitionEnterTimeout={300}
                    transitionLeaveTimeout={300}>
                    {renderedCompletions}
                </ReactCSSTransitionGroup>
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
