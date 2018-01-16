/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

import React from 'react';
import PropTypes from 'prop-types';
import {highlightBlock} from 'highlight.js';

export default class Highlight extends React.Component {
    static propTypes = {
        className: PropTypes.string,
        children: PropTypes.node,
    };

    constructor(props, context) {
        super(props, context);

        this._ref = this._ref.bind(this);
    }

    componentDidUpdate() {
        if (this._el) highlightBlock(this._el);
    }

    _ref(el) {
        this._el = el;
        this.componentDidUpdate();
    }

    render() {
        const { className, children } = this.props;

        return <pre className={`${className} mx_Highlight`} ref={this._ref}>
            <code>{ children }</code>
        </pre>;
    }
}
