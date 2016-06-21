import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

import {getCompletions} from '../../../autocomplete/Autocompleter';

export default class Autocomplete extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            completions: [],

            // how far down the completion list we are
            selectionOffset: 0
        };
    }

    componentWillReceiveProps(props, state) {
        if(props.query == this.props.query) return;

        getCompletions(props.query, props.selection).map(completionResult => {
            try {
                completionResult.completions.then(completions => {
                    let i = this.state.completions.findIndex(
                        completion => completion.provider === completionResult.provider
                    );

                    i = i == -1 ? this.state.completions.length : i;
                    let newCompletions = Object.assign([], this.state.completions);
                    completionResult.completions = completions;
                    newCompletions[i] = completionResult;
                    this.setState({
                        completions: newCompletions
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

    render() {
        let renderedCompletions = this.state.completions.map((completionResult, i) => {
            let completions = completionResult.completions.map((completion, i) => {
                let Component = completion.component;
                if(Component) {
                    return Component;
                }
                
                return (
                    <div key={i} className="mx_Autocomplete_Completion" tabIndex={0}>
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
                    <ReactCSSTransitionGroup component="div" transitionName="autocomplete" transitionEnterTimeout={300} transitionLeaveTimeout={300}>
                        {completions}
                    </ReactCSSTransitionGroup>
                </div>
            ) : null;
        });

        return (
            <div className="mx_Autocomplete">
                <ReactCSSTransitionGroup component="div" transitionName="autocomplete" transitionEnterTimeout={300} transitionLeaveTimeout={300}>
                    {renderedCompletions}
                </ReactCSSTransitionGroup>
            </div>
        );
    }
}

Autocomplete.propTypes = {
    // the query string for which to show autocomplete suggestions
    query: React.PropTypes.string.isRequired
};
