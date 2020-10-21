/**
 * Checks a message if it contains one of the provided emojis
 * @param  {Object} content The message
 * @param  {Array<string>} emojis The list of emojis to check for
 */
export const containsEmoji = (content: { msgtype: string, body: string }, emojis: Array<string>): boolean => {
    return emojis.some((emoji) => content.body.includes(emoji));
}
