import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import classNames from 'classnames';

import {getCompletions} from '../../../autocomplete/Autocompleter';

export default class Autocomplete extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            completions: [],

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
        this.setState({selectionOffset});
        return true;
    }

    // called from MessageComposerInput
    onDownArrow(): boolean {
        let completionCount = this.countCompletions(),
            selectionOffset = (this.state.selectionOffset + 1) % completionCount;
        this.setState({selectionOffset});
        return true;
    }

    render() {
        let position = 0;
        let renderedCompletions = this.state.completions.map((completionResult, i) => {
            let completions = completionResult.completions.map((completion, i) => {
                let Component = completion.component;
                let className = classNames('mx_Autocomplete_Completion', {
                    'selected': position === this.state.selectionOffset,
                });
                let componentPosition = position;
                position++;
                if (Component) {
                    return Component;
                }

                let onMouseOver = () => this.setState({selectionOffset: componentPosition});
                
                return (
                    <div key={i}
                         className={className}
                         onMouseOver={onMouseOver}>
                        <span style={{fontWeight: 600}}>{completion.title}</span>
                        <span>{completion.subtitle}</span>
                        <span style={{flex: 1}} />
                        <span style={{color: 'gray'}}>{completion.description}</span>
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
};
