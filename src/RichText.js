import {Editor, ContentState, convertFromHTML, DefaultDraftBlockRenderMap, DefaultDraftInlineStyle, CompositeDecorator} from 'draft-js';
import * as sdk from  './index';

const BLOCK_RENDER_MAP = DefaultDraftBlockRenderMap.set('unstyled', {
    element: 'p' // draft uses <div> by default which we don't really like, so we're using <p>
});

const styles = {
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
        block.findStyleRanges(() => true, (start, end) => {
            const tags = block.getInlineStyleAt(start).map(style => styles[style]);
            const open = tags.map(tag => `<${tag}>`).join('');
            const close = tags.map(tag => `</${tag}>`).reverse().join('');
            content.push(`${open}${block.getText().substring(start, end)}${close}`);
        });

        return (`<${elem}>${content.join('')}</${elem}>`);
    }).join('');
}

export function HTMLtoContentState(html:String): ContentState {
    return ContentState.createFromBlockArray(convertFromHTML(html));
}

const USERNAME_REGEX = /@\S+:\S+/g;
const ROOM_REGEX = /#\S+:\S+/g;

/**
 * Returns a composite decorator which has access to provided scope.
 * 
 * @param scope
 * @returns {*}
 */
export function getScopedDecorator(scope) {
    const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

    const usernameDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(USERNAME_REGEX, contentBlock, callback);
        },
        component: (props) => {
            let member = scope.room.getMember(props.children[0].props.text);
            let name = null;
            if(!!member) {
                name = member.name;
            }
            console.log(member);
            let avatar = member ? <MemberAvatar member={member} width={16} height={16} /> : null;
            return <span className="mx_UserPill">{avatar} {props.children}</span>;
        }
    };
    const roomDecorator = {
        strategy: (contentBlock, callback) => {
            findWithRegex(ROOM_REGEX, contentBlock, callback);
        },
        component: (props) => {
            return <span className="mx_RoomPill">{props.children}</span>;
        }
    };

    return new CompositeDecorator([usernameDecorator, roomDecorator]);
}

function findWithRegex(regex, contentBlock, callback) {
    const text = contentBlock.getText();
    let matchArr, start;
    while ((matchArr = regex.exec(text)) !== null) {
        start = matchArr.index;
        callback(start, start + matchArr[0].length);
    }
}
