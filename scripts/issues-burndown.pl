#!/usr/bin/env perl

use warnings;
use strict;

use Net::GitHub;
use DateTime;
use DateTime::Format::ISO8601;

my $gh = Net::GitHub->new(
    login => 'ara4n', pass => 'secret'
);

$gh->set_default_user_repo('vector-im', 'riot-web');

my @issues = $gh->issue->repos_issues({ state => 'all', milestone => 3 });
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

    # use Data::Dumper;
    # print STDERR Dumper($issue);

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

    my $state = $issue->{state};
    my $type = &$extract_labels(qw(bug feature)) || "neither";
    my $priority = &$extract_labels(qw(p1 p2 p3 p4 p5)) || "unprioritised";
    my $severity = &$extract_labels(qw(minor major critical cosmetic network)) || "no-severity";

    my $start = DateTime::Format::ISO8601->parse_datetime($issue->{created_at});

    do {
        my $ymd = $start->ymd();

        $days->{ $ymd }->{ 'created' }->{ $type }->{ $priority }->{ $severity }->{ total }++;
        $schema->{ 'created' }->{ $type }->{ $priority }->{ $severity }->{ total }++;
        foreach (keys %$labels) {
            $days->{ $ymd }->{ 'created' }->{ $type }->{ $priority }->{ $severity }->{ $_ }++;
            $schema->{ 'created' }->{ $type }->{ $priority }->{ $severity }->{ $_ }++;
        }

        $start = $start->add(days => 1);
    } while (DateTime->compare($start, $now) < 0);

    if ($state eq 'closed') {
        my $end = DateTime::Format::ISO8601->parse_datetime($issue->{closed_at});
        do {
            my $ymd = $end->ymd();

            $days->{ $ymd }->{ 'resolved' }->{ $type }->{ $priority }->{ $severity }->{ total }++;
            $schema->{ 'resolved' }->{ $type }->{ $priority }->{ $severity }->{ total }++;
            foreach (keys %$labels) {
                $days->{ $ymd }->{ 'resolved' }->{ $type }->{ $priority }->{ $severity }->{ $_ }++;
                $schema->{ 'resolved' }->{ $type }->{ $priority }->{ $severity }->{ $_ }++;
            }

            $end = $end->add(days => 1);
        } while (DateTime->compare($end, $now) < 0);
    }
}

print "day,";
foreach my $state (sort keys %{$schema}) {
    foreach my $type (grep { /^(bug|feature)$/ } sort keys %{$schema->{$state}}) {
        foreach my $priority (grep { /^(p1|p2)$/ } sort keys %{$schema->{$state}->{$type}}) {
            foreach my $severity (sort keys %{$schema->{$state}->{$type}->{$priority}}) {
                # foreach my $tag (sort keys %{$schema->{$state}->{$type}->{$priority}->{$severity}}) {
                #     print "\"$type\n$priority\n$severity\n$tag\",";
                # }
                print "\"$state\n$type\n$priority\n$severity\",";
            }
        }
    }
}
print "\n";

foreach my $day (sort keys %$days) {
    print "$day,";
    foreach my $state (sort keys %{$schema}) {
        foreach my $type (grep { /^(bug|feature)$/ } sort keys %{$schema->{$state}}) {
            foreach my $priority (grep { /^(p1|p2)$/ } sort keys %{$schema->{$state}->{$type}}) {
                foreach my $severity (sort keys %{$schema->{$state}->{$type}->{$priority}}) {
                    # foreach my $tag (sort keys %{$schema->{$state}->{$type}->{$priority}->{$severity}}) {
                    #     print $days->{$day}->{$state}->{$type}->{$priority}->{$severity}->{$tag} || 0;
                    #     print ",";
                    # }
                    print $days->{$day}->{$state}->{$type}->{$priority}->{$severity}->{total} || 0;
                    print ",";
                }
            }
        }
    }
    print "\n";
}

