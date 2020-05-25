/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>

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
import classNames from "classnames";

import {_t} from "../../../languageHandler";
import {Key} from "../../../Keyboard";

class Header extends React.PureComponent {
    static propTypes = {
        categories: PropTypes.arrayOf(PropTypes.object).isRequired,
        onAnchorClick: PropTypes.func.isRequired,
    };

    findNearestEnabled(index, delta) {
        index += this.props.categories.length;
        const cats = [...this.props.categories, ...this.props.categories, ...this.props.categories];

        while (index < cats.length && index >= 0) {
            if (cats[index].enabled) return index % this.props.categories.length;
            index += delta > 0 ? 1 : -1;
        }
    }

    changeCategoryRelative(delta) {
        const current = this.props.categories.findIndex(c => c.visible);
        this.changeCategoryAbsolute(current + delta, delta);
    }

    changeCategoryAbsolute(index, delta=1) {
        const category = this.props.categories[this.findNearestEnabled(index, delta)];
        if (category) {
            this.props.onAnchorClick(category.id);
            category.ref.current.focus();
        }
    }

    // Implements ARIA Tabs with Automatic Activation pattern
    // https://www.w3.org/TR/wai-aria-practices/examples/tabs/tabs-1/tabs.html
    onKeyDown = (ev) => {
        let handled = true;
        switch (ev.key) {
            case Key.ARROW_LEFT:
                this.changeCategoryRelative(-1);
                break;
            case Key.ARROW_RIGHT:
                this.changeCategoryRelative(1);
                break;

            case Key.HOME:
                this.changeCategoryAbsolute(0);
                break;
            case Key.END:
                this.changeCategoryAbsolute(this.props.categories.length - 1, -1);
                break;
            default:
                handled = false;
        }

        if (handled) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    };

    render() {
        return (
            <nav className="mx_EmojiPicker_header" role="tablist" aria-label={_t("Categories")} onKeyDown={this.onKeyDown}>
                {this.props.categories.map(category => {
                    const classes = classNames(`mx_EmojiPicker_anchor mx_EmojiPicker_anchor_${category.id}`, {
                        mx_EmojiPicker_anchor_visible: category.visible,
                    });
                    // Properties of this button are also modified by EmojiPicker's updateVisibility in DOM.
                    return <button
                        disabled={!category.enabled}
                        key={category.id}
                        ref={category.ref}
                        className={classes}
                        onClick={() => this.props.onAnchorClick(category.id)}
                        title={category.name}
                        role="tab"
                        tabIndex={category.visible ? 0 : -1} // roving
                        aria-selected={category.visible}
                        aria-controls={`mx_EmojiPicker_category_${category.id}`}
                    />;
                })}
            </nav>
        );
    }
}

export default Header;
