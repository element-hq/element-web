/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd

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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import {Key} from "../../../Keyboard";

export default class EditableText extends React.Component {
    static propTypes = {
        onValueChanged: PropTypes.func,
        initialValue: PropTypes.string,
        label: PropTypes.string,
        placeholder: PropTypes.string,
        className: PropTypes.string,
        labelClassName: PropTypes.string,
        placeholderClassName: PropTypes.string,
        // Overrides blurToSubmit if true
        blurToCancel: PropTypes.bool,
        // Will cause onValueChanged(value, true) to fire on blur
        blurToSubmit: PropTypes.bool,
        editable: PropTypes.bool,
    };

    static Phases = {
        Display: "display",
        Edit: "edit",
    };

    static defaultProps = {
        onValueChanged() {},
        initialValue: '',
        label: '',
        placeholder: '',
        editable: true,
        className: "mx_EditableText",
        placeholderClassName: "mx_EditableText_placeholder",
        blurToSubmit: false,
    };

    constructor(props) {
        super(props);

        // we track value as an JS object field rather than in React state
        // as React doesn't play nice with contentEditable.
        this.value = '';
        this.placeholder = false;

        this._editable_div = createRef();
    }

    state = {
        phase: EditableText.Phases.Display,
    };

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line camelcase
    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.initialValue !== this.props.initialValue) {
            this.value = nextProps.initialValue;
            if (this._editable_div.current) {
                this.showPlaceholder(!this.value);
            }
        }
    }

    componentDidMount() {
        this.value = this.props.initialValue;
        if (this._editable_div.current) {
            this.showPlaceholder(!this.value);
        }
    }

    showPlaceholder = show => {
        if (show) {
            this._editable_div.current.textContent = this.props.placeholder;
            this._editable_div.current.setAttribute("class", this.props.className
                + " " + this.props.placeholderClassName);
            this.placeholder = true;
            this.value = '';
        } else {
            this._editable_div.current.textContent = this.value;
            this._editable_div.current.setAttribute("class", this.props.className);
            this.placeholder = false;
        }
    };

    getValue = () => this.value;

    setValue = value => {
        this.value = value;
        this.showPlaceholder(!this.value);
    };

    edit = () => {
        this.setState({
            phase: EditableText.Phases.Edit,
        });
    };

    cancelEdit = () => {
        this.setState({
            phase: EditableText.Phases.Display,
        });
        this.value = this.props.initialValue;
        this.showPlaceholder(!this.value);
        this.onValueChanged(false);
        this._editable_div.current.blur();
    };

    onValueChanged = shouldSubmit => {
        this.props.onValueChanged(this.value, shouldSubmit);
    };

    onKeyDown = ev => {
        // console.log("keyDown: textContent=" + ev.target.textContent + ", value=" + this.value + ", placeholder=" + this.placeholder);

        if (this.placeholder) {
            this.showPlaceholder(false);
        }

        if (ev.key === Key.ENTER) {
            ev.stopPropagation();
            ev.preventDefault();
        }

        // console.log("keyDown: textContent=" + ev.target.textContent + ", value=" + this.value + ", placeholder=" + this.placeholder);
    };

    onKeyUp = ev => {
        // console.log("keyUp: textContent=" + ev.target.textContent + ", value=" + this.value + ", placeholder=" + this.placeholder);

        if (!ev.target.textContent) {
            this.showPlaceholder(true);
        } else if (!this.placeholder) {
            this.value = ev.target.textContent;
        }

        if (ev.key === Key.ENTER) {
            this.onFinish(ev);
        } else if (ev.key === Key.ESCAPE) {
            this.cancelEdit();
        }

        // console.log("keyUp: textContent=" + ev.target.textContent + ", value=" + this.value + ", placeholder=" + this.placeholder);
    };

    onClickDiv = ev => {
        if (!this.props.editable) return;

        this.setState({
            phase: EditableText.Phases.Edit,
        });
    };

    onFocus = ev => {
        //ev.target.setSelectionRange(0, ev.target.textContent.length);

        const node = ev.target.childNodes[0];
        if (node) {
            const range = document.createRange();
            range.setStart(node, 0);
            range.setEnd(node, node.length);

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    };

    onFinish = (ev, shouldSubmit) => {
        const self = this;
        const submit = (ev.key === Key.ENTER) || shouldSubmit;
        this.setState({
            phase: EditableText.Phases.Display,
        }, () => {
            if (this.value !== this.props.initialValue) {
                self.onValueChanged(submit);
            }
        });
    };

    onBlur = ev => {
        const sel = window.getSelection();
        sel.removeAllRanges();

        if (this.props.blurToCancel) {
            this.cancelEdit();
        } else {
            this.onFinish(ev, this.props.blurToSubmit);
        }

        this.showPlaceholder(!this.value);
    };

    render() {
        const {className, editable, initialValue, label, labelClassName} = this.props;
        let editableEl;

        if (!editable || (this.state.phase === EditableText.Phases.Display &&
            (label || labelClassName) && !this.value)
        ) {
            // show the label
            editableEl = <div className={className + " " + labelClassName} onClick={this.onClickDiv}>
                { label || initialValue }
            </div>;
        } else {
            // show the content editable div, but manually manage its contents as react and contentEditable don't play nice together
            editableEl = <div ref={this._editable_div}
                              contentEditable={true}
                              className={className}
                              onKeyDown={this.onKeyDown}
                              onKeyUp={this.onKeyUp}
                              onFocus={this.onFocus}
                              onBlur={this.onBlur} />;
        }

        return editableEl;
    }
}
