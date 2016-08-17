import React from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

/* These were earlier stateless functional components but had to be converted
since we need to use refs/findDOMNode to access the underlying DOM node to focus the correct completion,
something that is not entirely possible with stateless functional components. One could
presumably wrap them in a <div> before rendering but I think this is the better way to do it.
 */

export class TextualCompletion extends React.Component {
    render() {
        const {
            title,
            subtitle,
            description,
            className,
            ...restProps,
        } = this.props;
        return (
            <div className={classNames('mx_Autocomplete_Completion_block', className)} {...restProps}>
                <span>{title}</span>
                <em style={{flex: 1}}>{subtitle}</em>
                <span style={{color: 'gray', float: 'right'}}>{description}</span>
            </div>
        );
    }
}
TextualCompletion.propTypes = {
    title: React.PropTypes.string,
    subtitle: React.PropTypes.string,
    description: React.PropTypes.string,
    className: React.PropTypes.string,
};

export class PillCompletion extends React.Component {
    render() {
        const {
            title,
            subtitle,
            description,
            initialComponent,
            className,
            ...restProps,
        } = this.props;
        return (
            <div className={classNames('mx_Autocomplete_Completion_pill', className)} {...restProps}>
                {initialComponent}
                <span>{title}</span>
                <em>{subtitle}</em>
                <span style={{color: 'gray'}}>{description}</span>
            </div>
        );
    }
}
PillCompletion.propTypes = {
    title: React.PropTypes.string,
    subtitle: React.PropTypes.string,
    description: React.PropTypes.string,
    initialComponent: React.PropTypes.element,
    className: React.PropTypes.string,
};
