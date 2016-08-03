import React from 'react';
import {
    Editor,
    EditorState,
    Modifier,
    ContentState,
    ContentBlock,
    convertFromHTML,
    DefaultDraftBlockRenderMap,
    DefaultDraftInlineStyle,
    CompositeDecorator,
    SelectionState,
    Entity,
} from 'draft-js';
import * as sdk from  './index';
import * as emojione from 'emojione';

const BLOCK_RENDER_MAP = DefaultDraftBlockRenderMap.set('unstyled', {
    element: 'span',
    /*
     draft uses <div> by default which we don't really like, so we're using <span>
     this is probably not a good idea since <span> is not a block level element but
     we're trying to fix things in contentStateToHTML below
     */
});

const STYLES = {
    BOLD: 'strong',
    CODE: 'code',
    ITALIC: 'em',
    STRIKETHROUGH: 's',
    UNDERLINE: 'u',
};

const MARKDOWN_REGEX = {
    LINK: /(?:\[([^\]]+)\]\(([^\)]+)\))|\<(\w+:\/\/[^\>]+)\>/g,
    ITALIC: /([\*_])([\w\s]+?)\1/g,
    BOLD: /([\*_])\1([\w\s]+?)\1\1/g,
};

const USERNAME_REGEX = /@\S+:\S+/g;
const ROOM_REGEX = /#\S+:\S+/g;
const EMOJI_REGEX = new RegExp(emojione.unicodeRegexp, 'g');

export function contentStateToHTML(contentState: ContentState): string {
    return contentState.getBlockMap().map((block) => {
        let elem = BLOCK_RENDER_MAP.get(block.getType()).element;
        let content = [];
        block.findStyleRanges(
            () => true, // always return true => don't filter any ranges out
            (start, end) => {
                // map style names to elements
                let tags = block.getInlineStyleAt(start).map(style => STYLES[style]).filter(style => !!style);
                // combine them to get well-nested HTML
                let open = tags.map(tag => `<${tag}>`).join('');
                let close = tags.map(tag => `</${tag}>`).reverse().join('');
                // and get the HTML representation of this styled range (this .substring() should never fail)
                let text = block.getText().substring(start, end);
                // http://shebang.brandonmintern.com/foolproof-html-escaping-in-javascript/
                let div = document.createElement('div');
                div.appendChild(document.createTextNode(text));
                let safeText = div.innerHTML;
                content.push(`${open}${safeText}${close}`);
            }
        );

        let result = `<${elem}>${content.join('')}</${elem}>`;

        // dirty hack because we don't want block level tags by default, but breaks
        if (elem === 'span')
            result += '<br />';
        return result;
    }).join('');
}

export function HTMLtoContentState(html: string): ContentState {
    return ContentState.createFromBlockArray(convertFromHTML(html));
}

function unicodeToEmojiUri(str) {
    let replaceWith, unicode, alt;
    if ((!emojione.unicodeAlt) || (emojione.sprites)) {
        // if we are using the shortname as the alt tag then we need a reversed array to map unicode code point to shortnames
        let mappedUnicode = emojione.mapUnicodeToShort();
    }

    str = str.replace(emojione.regUnicode, function(unicodeChar) {
        if ( (typeof unicodeChar === 'undefined') || (unicodeChar === '') || (!(unicodeChar in emojione.jsEscapeMap)) ) {
            // if the unicodeChar doesnt exist just return the entire match
            return unicodeChar;
        } else {
            // get the unicode codepoint from the actual char
            unicode = emojione.jsEscapeMap[unicodeChar];
            return emojione.imagePathSVG+unicode+'.svg'+emojione.cacheBustParam;
        }
    });

    return str;
}

// Workaround for https://github.com/facebook/draft-js/issues/414
let emojiDecorator = {
    strategy: (contentBlock, callback) => {
        findWithRegex(EMOJI_REGEX, contentBlock, callback);
    },
    component: (props) => {
        let uri = unicodeToEmojiUri(props.children[0].props.text);
        let shortname = emojione.toShort(props.children[0].props.text);
        let style = {
            display: 'inline-block',
            width: '1em',
            maxHeight: '1em',
            background: `url(${uri})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center center',
            overflow: 'hidden',
        };
        return (<span title={shortname} style={style}><span style={{opacity: 0}}>{props.children}</span></span>);
    },
};

/**
 * Returns a composite decorator which has access to provided scope.
 */
export function getScopedRTDecorators(scope: any): CompositeDecorator {
    let MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

    let usernameDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(USERNAME_REGEX, contentBlock, callback);
        },
        component: (props) => {
            let member = scope.room.getMember(props.children[0].props.text);
            // unused until we make these decorators immutable (autocomplete needed)
            let name = member ? member.name : null;
            let avatar = member ? <MemberAvatar member={member} width={16} height={16}/> : null;
            return <span className="mx_UserPill">{avatar}{props.children}</span>;
        }
    };
    
    let roomDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(ROOM_REGEX, contentBlock, callback);
        },
        component: (props) => {
            return <span className="mx_RoomPill">{props.children}</span>;
        }
    };

    return [usernameDecorator, roomDecorator, emojiDecorator];
}

export function getScopedMDDecorators(scope: any): CompositeDecorator {
    let markdownDecorators = ['BOLD', 'ITALIC'].map(
        (style) => ({
            strategy: (contentBlock, callback) => {
                return findWithRegex(MARKDOWN_REGEX[style], contentBlock, callback);
            },
            component: (props) => (
                <span className={"mx_MarkdownElement mx_Markdown_" + style}>
                    {props.children}
                </span>
            )
        }));

    markdownDecorators.push({
        strategy: (contentBlock, callback) => {
            return findWithRegex(MARKDOWN_REGEX.LINK, contentBlock, callback);
        },
        component: (props) => (
            <a href="#" className="mx_MarkdownElement mx_Markdown_LINK">
                {props.children}
            </a>
        )
    });
    markdownDecorators.push(emojiDecorator);

    return markdownDecorators;
}

/**
 * Utility function that looks for regex matches within a ContentBlock and invokes {callback} with (start, end)
 * From https://facebook.github.io/draft-js/docs/advanced-topics-decorators.html
 */
function findWithRegex(regex, contentBlock: ContentBlock, callback: (start: number, end: number) => any) {
    const text = contentBlock.getText();
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
        start = matchArr.index;
        callback(start, start + matchArr[0].length);
    }
}

/**
 * Passes rangeToReplace to modifyFn and replaces it in contentState with the result.
 */
export function modifyText(contentState: ContentState, rangeToReplace: SelectionState,
                           modifyFn: (text: string) => string, inlineStyle, entityKey): ContentState {
    let getText = (key) => contentState.getBlockForKey(key).getText(),
        startKey = rangeToReplace.getStartKey(),
        startOffset = rangeToReplace.getStartOffset(),
        endKey = rangeToReplace.getEndKey(),
        endOffset = rangeToReplace.getEndOffset(),
        text = "";


    for (let currentKey = startKey;
            currentKey && currentKey !== endKey;
            currentKey = contentState.getKeyAfter(currentKey)) {
        let blockText = getText(currentKey);
        text += blockText.substring(startOffset, blockText.length);

        // from now on, we'll take whole blocks
        startOffset = 0;
    }

    // add remaining part of last block
    text += getText(endKey).substring(startOffset, endOffset);

    return Modifier.replaceText(contentState, rangeToReplace, modifyFn(text), inlineStyle, entityKey);
}

/**
 * Computes the plaintext offsets of the given SelectionState.
 * Note that this inherently means we make assumptions about what that means (no separator between ContentBlocks, etc)
 * Used by autocomplete to show completions when the current selection lies within, or at the edges of a command.
 */
export function selectionStateToTextOffsets(selectionState: SelectionState,
                                            contentBlocks: Array<ContentBlock>): {start: number, end: number} {
    let offset = 0, start = 0, end = 0;
    for (let block of contentBlocks) {
        if (selectionState.getStartKey() === block.getKey()) {
            start = offset + selectionState.getStartOffset();
        }
        if (selectionState.getEndKey() === block.getKey()) {
            end = offset + selectionState.getEndOffset();
            break;
        }
        offset += block.getLength();
    }

    return {
        start,
        end,
    };
}

export function textOffsetsToSelectionState({start, end}: {start: number, end: number},
                                            contentBlocks: Array<ContentBlock>): SelectionState {
    let selectionState = SelectionState.createEmpty();

    for (let block of contentBlocks) {
        let blockLength = block.getLength();

        if (start !== -1 && start < blockLength) {
            selectionState = selectionState.merge({
                anchorKey: block.getKey(),
                anchorOffset: start,
            });
            start = -1;
        } else {
            start -= blockLength;
        }

        if (end !== -1 && end <= blockLength) {
            selectionState = selectionState.merge({
                focusKey: block.getKey(),
                focusOffset: end,
            });
            end = -1;
        } else {
            end -= blockLength;
        }
    }

    return selectionState;
}

// modified version of https://github.com/draft-js-plugins/draft-js-plugins/blob/master/draft-js-emoji-plugin/src/modifiers/attachImmutableEntitiesToEmojis.js
export function attachImmutableEntitiesToEmoji(editorState: EditorState): EditorState {
    const contentState = editorState.getCurrentContent();
    const blocks = contentState.getBlockMap();
    let newContentState = contentState;

    blocks.forEach((block) => {
        const plainText = block.getText();

        const addEntityToEmoji = (start, end) => {
            const existingEntityKey = block.getEntityAt(start);
            if (existingEntityKey) {
                // avoid manipulation in case the emoji already has an entity
                const entity = Entity.get(existingEntityKey);
                if (entity && entity.get('type') === 'emoji') {
                    return;
                }
            }

            const selection = SelectionState.createEmpty(block.getKey())
                .set('anchorOffset', start)
                .set('focusOffset', end);
            const emojiText = plainText.substring(start, end);
            const entityKey = Entity.create('emoji', 'IMMUTABLE', { emojiUnicode: emojiText });
            newContentState = Modifier.replaceText(
                newContentState,
                selection,
                emojiText,
                null,
                entityKey,
            );
        };

        findWithRegex(EMOJI_REGEX, block, addEntityToEmoji);
    });

    if (!newContentState.equals(contentState)) {
        return EditorState.push(
            editorState,
            newContentState,
            'convert-to-immutable-emojis',
        );
    }

    return editorState;
}
