import React from "react";
import ReactDom from "react-dom";
import PropTypes from 'prop-types';

/**
 * The NodeAnimator contains components and animates transitions.
 * It will only pick up direct changes to properties ('left', currently), and so
 * will not work for animating positional changes where the position is implicit
 * from DOM order. This makes it a lot simpler and lighter: if you need fully
 * automatic positional animation, look at react-shuffle or similar libraries.
 */
export default class NodeAnimator extends React.Component {
    static propTypes = {
        // either a list of child nodes, or a single child.
        children: PropTypes.any,

        // optional transition information for changing existing children
        transition: PropTypes.object,

        // a list of state objects to apply to each child node in turn
        startStyles: PropTypes.array,
    };

    static defaultProps = {
        startStyles: [],
    };

    constructor(props) {
        super(props);

        this.nodes = {};
        this._updateChildren(this.props.children);
    }

    componentDidUpdate() {
        this._updateChildren(this.props.children);
    }

    /**
     *
     * @param {HTMLElement} node element to apply styles to
     * @param {object} styles a key/value pair of CSS properties
     * @returns {void}
     */
    _applyStyles(node, styles) {
        Object.entries(styles).forEach(([property, value]) => {
            node.style[property] = value;
        });
    }

    _updateChildren(newChildren) {
        const oldChildren = this.children || {};
        this.children = {};
        React.Children.toArray(newChildren).forEach((c) => {
            if (oldChildren[c.key]) {
                const old = oldChildren[c.key];
                const oldNode = ReactDom.findDOMNode(this.nodes[old.key]);

                if (oldNode && oldNode.style.left !== c.props.style.left) {
                    this._applyStyles(oldNode, { left: c.props.style.left });
                    // console.log("translation: "+oldNode.style.left+" -> "+c.props.style.left);
                }
                // clone the old element with the props (and children) of the new element
                // so prop updates are still received by the children.
                this.children[c.key] = React.cloneElement(old, c.props, c.props.children);
            } else {
                // new element. If we have a startStyle, use that as the style and go through
                // the enter animations
                const newProps = {};
                const restingStyle = c.props.style;

                const startStyles = this.props.startStyles;
                if (startStyles.length > 0) {
                    const startStyle = startStyles[0];
                    newProps.style = startStyle;
                    // console.log("mounted@startstyle0: "+JSON.stringify(startStyle));
                }

                newProps.ref = ((n) => this._collectNode(
                    c.key, n, restingStyle,
                ));

                this.children[c.key] = React.cloneElement(c, newProps);
            }
        });
    }

    _collectNode(k, node, restingStyle) {
        if (
            node &&
            this.nodes[k] === undefined &&
            this.props.startStyles.length > 0
        ) {
            const startStyles = this.props.startStyles;
            const domNode = ReactDom.findDOMNode(node);
            // start from startStyle 1: 0 is the one we gave it
            // to start with, so now we animate 1 etc.
            for (let i = 1; i < startStyles.length; ++i) {
                this._applyStyles(domNode, startStyles[i]);
                // console.log("start:"
                //             JSON.stringify(startStyles[i]),
                //             );
            }

            // and then we animate to the resting state
            setTimeout(() => {
                this._applyStyles(domNode, restingStyle);
            }, 0);

            // console.log("enter:",
            //             JSON.stringify(restingStyle));
        }
        this.nodes[k] = node;
    }

    render() {
        return (
            <>{ Object.values(this.children) }</>
        );
    }
}
