import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

import {getCompletions} from '../../../autocomplete/Autocompleter';

export default class Autocomplete extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            completions: []
        };
    }

    componentWillReceiveProps(props, state) {
        if(props.query == this.props.query) return;

        getCompletions(props.query).map(completionResult => {
            try {
                console.log(`${completionResult.provider.getName()}: ${JSON.stringify(completionResult.completions)}`);
                completionResult.completions.then(completions => {
                    let i = this.state.completions.findIndex(
                        completion => completion.provider === completionResult.provider
                    );

                    i = i == -1 ? this.state.completions.length : i;
                    console.log(completionResult);
                    let newCompletions = Object.assign([], this.state.completions);
                    completionResult.completions = completions;
                    newCompletions[i] = completionResult;
                    // console.log(newCompletions);
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
        const pinElement = document.querySelector(this.props.pinSelector);
        if(!pinElement) return null;

        const position = pinElement.getBoundingClientRect();



        const renderedCompletions = this.state.completions.map((completionResult, i) => {
            // console.log(completionResult);
            let completions = completionResult.completions.map((completion, i) => {
                let Component = completion.component;
                if(Component) {
                    return Component;
                }
                
                return (
                    <div key={i} className="mx_Autocomplete_Completion">
                        <span>{completion.title}</span>
                        <em>{completion.subtitle}</em>
                        <span style={{color: 'gray', float: 'right'}}>{completion.description}</span>
                    </div>
                );
            });


            return completions.length > 0 ? (
                <div key={i} className="mx_Autocomplete_ProviderSection">
                    <span className="mx_Autocomplete_provider_name">{completionResult.provider.getName()}</span>
                    <ReactCSSTransitionGroup transitionName="autocomplete" transitionEnterTimeout={300} transitionLeaveTimeout={300}>
                        {completions}
                    </ReactCSSTransitionGroup>
                </div>
            ) : null;
        });

        return (
            <div className="mx_Autocomplete">
                <ReactCSSTransitionGroup transitionName="autocomplete" transitionEnterTimeout={300} transitionLeaveTimeout={300}>
                    {renderedCompletions}
                </ReactCSSTransitionGroup>
            </div>
        );
    }
}

Autocomplete.propTypes = {
    // the query string for which to show autocomplete suggestions
    query: React.PropTypes.string.isRequired,
    
    // CSS selector indicating which element to pin the autocomplete to
    pinSelector: React.PropTypes.string.isRequired,

    // attributes on which the autocomplete should match the pinElement
    pinTo: React.PropTypes.array.isRequired
};
