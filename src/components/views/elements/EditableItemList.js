/*
Copyright 2017 New Vector Ltd.

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
import sdk from '../../../index';
import {_t} from '../../../languageHandler.js';

const EditableItem = React.createClass({
    displayName: 'EditableItem',

    propTypes: {
        initialValue: PropTypes.string,
        index: PropTypes.number,
        placeholder: PropTypes.string,

        onChange: PropTypes.func,
        onRemove: PropTypes.func,
        onAdd: PropTypes.func,

        addOnChange: PropTypes.bool,
    },

    onChange: function(value) {
        this.setState({ value });
        if (this.props.onChange) this.props.onChange(value, this.props.index);
        if (this.props.addOnChange && this.props.onAdd) this.props.onAdd(value);
    },

    onRemove: function() {
        if (this.props.onRemove) this.props.onRemove(this.props.index);
    },

    onAdd: function() {
        if (this.props.onAdd) this.props.onAdd(this.state.value);
    },

    render: function() {
        const EditableText = sdk.getComponent('elements.EditableText');
        return <div className="mx_EditableItem">
            <EditableText
                className="mx_EditableItem_editable"
                placeholderClassName="mx_EditableItem_editablePlaceholder"
                placeholder={this.props.placeholder}
                blurToCancel={false}
                editable={true}
                initialValue={this.props.initialValue}
                onValueChanged={this.onChange} />
            { this.props.onAdd ?
                <div className="mx_EditableItem_addButton">
                    <img className="mx_filterFlipColor"
                        src="img/plus.svg" width="14" height="14"
                        alt={_t("Add")} onClick={this.onAdd} />
                </div>
                :
                <div className="mx_EditableItem_removeButton">
                    <img className="mx_filterFlipColor"
                        src="img/cancel-small.svg" width="14" height="14"
                        alt={_t("Delete")} onClick={this.onRemove} />
                </div>
            }
        </div>;
    },
});

module.exports = React.createClass({
    displayName: 'EditableItemList',

    propTypes: {
        items: PropTypes.arrayOf(PropTypes.string).isRequired,
        onNewItemChanged: PropTypes.func,
        onItemAdded: PropTypes.func,
        onItemEdited: PropTypes.func,
        onItemRemoved: PropTypes.func,

        canEdit: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            onItemAdded: () => {},
            onItemEdited: () => {},
            onItemRemoved: () => {},
            onNewItemChanged: () => {},
        };
    },

    onItemAdded: function(value) {
        this.props.onItemAdded(value);
    },

    onItemEdited: function(value, index) {
        if (value.length === 0) {
            this.onItemRemoved(index);
        } else {
            this.props.onItemEdited(value, index);
        }
    },

    onItemRemoved: function(index) {
        this.props.onItemRemoved(index);
    },

    onNewItemChanged: function(value) {
        this.props.onNewItemChanged(value);
    },

    render: function() {
        const editableItems = this.props.items.map((item, index) => {
            return <EditableItem
                key={index}
                index={index}
                initialValue={item}
                onChange={this.onItemEdited}
                onRemove={this.onItemRemoved}
                placeholder={this.props.placeholder}
            />;
        });

        const label = this.props.items.length > 0 ?
            this.props.itemsLabel : this.props.noItemsLabel;

        return (<div className="mx_EditableItemList">
            <div className="mx_EditableItemList_label">
                { label }
            </div>
            { editableItems }
            { this.props.canEdit ?
                // This is slightly evil; we want a new instance of
                // EditableItem when the list grows. To make sure it's
                // reset to its initial state.
                <EditableItem
                    key={editableItems.length}
                    initialValue={this.props.newItem}
                    onAdd={this.onItemAdded}
                    onChange={this.onNewItemChanged}
                    addOnChange={true}
                    placeholder={this.props.placeholder}
                /> : <div />
            }
        </div>);
    },
});
