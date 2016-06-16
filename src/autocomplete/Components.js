export function TextualCompletion(props: {
    title: ?string,
    subtitle: ?string,
    description: ?string
}) {
    return (
        <div className="mx_Autocomplete_Completion">
            <span>{completion.title}</span>
            <em>{completion.subtitle}</em>
            <span style={{color: 'gray', float: 'right'}}>{completion.description}</span>
        </div>
    );
}
