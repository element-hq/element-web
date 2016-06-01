import React from 'react';

import {getCompletions} from '../../../autocomplete/Autocompleter';

export default class Autocomplete extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            completions: []
        };
    }

    componentWillReceiveProps(props, state) {
        getCompletions(props.query)[0].then(completions => {
            console.log(completions);
            this.setState({
                completions
            });
        });
    }

    render() {
        const pinElement = document.querySelector(this.props.pinSelector);
        if(!pinElement) return null;

        const position = pinElement.getBoundingClientRect();

        const style = {
            position: 'fixed',
            border: '1px solid gray',
            background: 'white',
            borderRadius: '4px'
        };

        this.props.pinTo.forEach(direction => {
            console.log(`${direction} = ${position[direction]}`);
            style[direction] = position[direction];
        });

        const renderedCompletions = this.state.completions.map((completion, i) => {
            return (
                <div key={i} class="mx_Autocomplete_Completion">
                    <strong>{completion.title}</strong>
                    <em>{completion.subtitle}</em>
                    <span style={{color: 'gray', float: 'right'}}>{completion.description}</span>
                </div>
            );
        });

        return (
            <div className="mx_Autocomplete" style={style}>
                {renderedCompletions}
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
