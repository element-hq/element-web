#!/usr/bin/env perl

use warnings;
use strict;

use Net::GitHub;
use DateTime;
use DateTime::Format::ISO8601;
use Term::ReadPassword;

# This version of the script emits the total number of bugs open on a given day,
# split by various tags.
#
# If you want instead the cumulative number of open & closed issues on a given day,
# then look at issues-burndown.pl

my $gh = Net::GitHub->new(
    login => 'ara4n', pass => read_password("github password: "),
);

$gh->set_default_user_repo('vector-im', 'element-web');

#my @issues = $gh->issue->repos_issues({ state => 'all', milestone => 3 });
my @issues = $gh->issue->repos_issues({ state => 'all' });
while ($gh->issue->has_next_page) {
    push @issues, $gh->issue->next_page;
}

# we want:
# day by day:
# split by { open, closed }
# split by { bug, feature, neither }
# each split by { p1, p2, p3, p4, p5, unprioritised }  <- priority
# each split by { minor, major, critical, cosmetic, network, no-severity }  <- severity
# then split (with overlap between the groups) as { total, tag1, tag2, ... }?

# ...and then all over again split by milestone.

my $days = {};
my $schema = {};
my $now = DateTime->now();

foreach my $issue (@issues) {
    next if ($issue->{pull_request});

    use Data::Dumper;
    print STDERR Dumper($issue);

    my @label_list = map { $_->{name} } @{$issue->{labels}};
    my $labels = {};
    $labels->{$_} = 1 foreach (@label_list);
    $labels->{bug}++ if ($labels->{cosmetic} && !$labels->{bug} && !$labels->{feature});

    my $extract_labels = sub {
        my $label = undef;
        foreach (@_) {
            $label ||= $_ if (delete $labels->{$_});
        }
        return $label;
    };

    my $type = &$extract_labels(qw(bug feature)) || "neither";
    my $priority = &$extract_labels(qw(p1 p2 p3 p4 p5)) || "unprioritised";
    my $severity = &$extract_labels(qw(minor major critical cosmetic network)) || "no-severity";

    my $start = DateTime::Format::ISO8601->parse_datetime($issue->{created_at});
    my $end = $issue->{closed_at} ? DateTime::Format::ISO8601->parse_datetime($issue->{closed_at}) : $now;

    do {
        my $ymd = $start->ymd();

        $days->{ $ymd }->{ $type }->{ $priority }->{ $severity }->{ total }++;
        $schema->{ $type }->{ $priority }->{ $severity }->{ total }++;
        foreach (keys %$labels) {
            $days->{ $ymd }->{ $type }->{ $priority }->{ $severity }->{ $_ }++;
            $schema->{ $type }->{ $priority }->{ $severity }->{ $_ }++;
        }

        $start = $start->add(days => 1);
    } while (DateTime->compare($start, $end) < 0);
}

print "day,";
foreach my $type (sort keys %{$schema}) {
    foreach my $priority (sort keys %{$schema->{$type}}) {
        foreach my $severity (sort keys %{$schema->{$type}->{$priority}}) {
            # foreach my $tag (sort keys %{$schema->{$type}->{$priority}->{$severity}}) {
            #     print "\"$type\n$priority\n$severity\n$tag\",";
            # }
            print "\"$type\n$priority\n$severity\",";
        }
    }
}
print "\n";

foreach my $day (sort keys %$days) {
    print "$day,";
    foreach my $type (sort keys %{$schema}) {
        foreach my $priority (sort keys %{$schema->{$type}}) {
            foreach my $severity (sort keys %{$schema->{$type}->{$priority}}) {
                # foreach my $tag (sort keys %{$schema->{$type}->{$priority}->{$severity}}) {
                #     print $days->{$day}->{$type}->{$priority}->{$severity}->{$tag} || 0;
                #     print ",";
                # }
                print $days->{$day}->{$type}->{$priority}->{$severity}->{total} || 0;
                print ",";
            }
        }
    }
    print "\n";
}

