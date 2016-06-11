import {
    Editor,
    Modifier,
    ContentState,
    convertFromHTML,
    DefaultDraftBlockRenderMap,
    DefaultDraftInlineStyle,
    CompositeDecorator
} from 'draft-js';
import * as sdk from  './index';

const BLOCK_RENDER_MAP = DefaultDraftBlockRenderMap.set('unstyled', {
    element: 'p' // draft uses <div> by default which we don't really like, so we're using <p>
});

const STYLES = {
    BOLD: 'strong',
    CODE: 'code',
    ITALIC: 'em',
    STRIKETHROUGH: 's',
    UNDERLINE: 'u'
};

export function contentStateToHTML(contentState: ContentState): string {
    return contentState.getBlockMap().map((block) => {
        let elem = BLOCK_RENDER_MAP.get(block.getType()).element;
        let content = [];
        block.findStyleRanges(
            () => true, // always return true => don't filter any ranges out
            (start, end) => {
                // map style names to elements
                let tags = block.getInlineStyleAt(start).map(style => STYLES[style]);
                // combine them to get well-nested HTML
                let open = tags.map(tag => `<${tag}>`).join('');
                let close = tags.map(tag => `</${tag}>`).reverse().join('');
                // and get the HTML representation of this styled range (this .substring() should never fail)
                content.push(`${open}${block.getText().substring(start, end)}${close}`);
            }
        );

        return (`<${elem}>${content.join('')}</${elem}>`);
    }).join('');
}

export function HTMLtoContentState(html: string): ContentState {
    return ContentState.createFromBlockArray(convertFromHTML(html));
}

const USERNAME_REGEX = /@\S+:\S+/g;
const ROOM_REGEX = /#\S+:\S+/g;

/**
 * Returns a composite decorator which has access to provided scope.
 */
export function getScopedDecorator(scope: any): CompositeDecorator {
    let MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

    let usernameDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(USERNAME_REGEX, contentBlock, callback);
        },
        component: (props) => {
            let member = scope.room.getMember(props.children[0].props.text);
            let name = null;
            if (!!member) {
                name = member.name; // unused until we make these decorators immutable (autocomplete needed)
            }
            let avatar = member ? <MemberAvatar member={member} width={16} height={16}/> : null;
            return <span className="mx_UserPill">{avatar} {props.children}</span>;
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

    return new CompositeDecorator([usernameDecorator, roomDecorator]);
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
export function modifyText(contentState: ContentState, rangeToReplace: SelectionState, modifyFn: (text: string) => string, ...rest): ContentState {
    let startKey = rangeToReplace.getStartKey(),
        endKey = contentState.getKeyAfter(rangeToReplace.getEndKey()),
        text = "";

    for(let currentKey = startKey; currentKey && currentKey !== endKey; currentKey = contentState.getKeyAfter(currentKey)) {
        let currentBlock = contentState.getBlockForKey(currentKey);
        text += currentBlock.getText();
    }

    return Modifier.replaceText(contentState, rangeToReplace, modifyFn(text), ...rest);
}
