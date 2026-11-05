#!/usr/bin/env python3
"""Build the Monterey County local-race tracker from a saved county results page.

Usage:
    python3 build.py [path-to-saved-results.html] [-o index.html]

The county publishes results as server-rendered HTML at
https://www.countyofmonterey.gov/government/departments-a-h/elections/election-results
There is no JSON feed, so on election night save that page (File > Save Page As,
"Web Page, Complete" or "HTML only") and re-run this script against the saved file.
"""

import argparse
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- exclusions
# Contests dropped from the tracker: statewide offices, statewide judicial
# retention, and statewide propositions. Everything else (county, city,
# school, special district, local measures, and the congressional / Assembly
# districts that sit inside the county) is kept.
# To put one back, delete its rule from this list and re-run the build.
STATEWIDE = [
    r'^Governor$',
    r'^Lieutenant Governor$',
    r'^Secretary of State$',
    r'^Controller$',
    r'^State Treasurer$',
    r'^Attorney General$',
    r'^Insurance Commissioner$',
    r'^State Board of Equalization',
    r'^Superintendent of Public Instruction$',
    r'^Associate Justice',
    r'^Proposition ',
]
STATEWIDE_RE = [re.compile(p, re.I) for p in STATEWIDE]


def is_statewide(name):
    return any(p.search(name) for p in STATEWIDE_RE)


# ----------------------------------------------------------------- scraping
def strip_tags(chunk):
    return html.unescape(re.sub(r'<[^>]+>', '', chunk)).replace(' ', ' ').strip()


def scrape(src):
    s = open(src, encoding='utf-8', errors='replace').read()

    meta = {}
    m = re.search(r'election-content".*?</div>', s, re.S)
    block = m.group(0) if m else ''
    for key, out in [('Election Date', 'date'), ('Report Title', 'title'),
                     ('Report Number', 'report'), ('Report Publish Date', 'published')]:
        mm = re.search(r'<b>' + key + r':</b>(.*?)</span>', block, re.S)
        meta[out] = re.sub(r'\s+', ' ', strip_tags(mm.group(1))) if mm else ''
    m = re.search(r'<b>Total Voters:</b>\s*([\d,]+)\s*/\s*([\d,]+)', s)
    if m:
        meta['countyBallots'] = int(m.group(1).replace(',', ''))
        meta['countyRegistered'] = int(m.group(2).replace(',', ''))
    m = re.search(r'reporting-content".*?<b>Precincts Reported:</b>\s*([^<]+)', s, re.S)
    meta['countyPrecincts'] = strip_tags(m.group(1)) if m else ''

    cand_re = re.compile(
        r'<div class="candidate-table-name-col candidate-table-cell">(.*?)</div>'
        r'<div class="candidate-table-party-col candidate-table-cell">(.*?)</div>'
        r'<div class="candidate-table-count-col candidate-table-cell">([\d,]+) \(([\d.]+)%\)</div>',
        re.S)

    races, parts = [], re.split(r'<div id="contest(\d+)" class="contest-section">', s)
    for i in range(1, len(parts), 2):
        body = parts[i + 1]
        lm = re.search(r'<span class="tab-label"[^>]*>(.*?)</span>', body, re.S)
        if not lm:
            continue
        label = strip_tags(lm.group(1))
        seats, name = 1, label
        sm = re.search(r'\(Vote for (\d+)\)\s*$', label)
        if sm:
            seats, name = int(sm.group(1)), label[:sm.start()].strip()

        def stat(key):
            mm = re.search(r'<b>' + re.escape(key) + r':</b>\s*([^<]*)', body)
            return strip_tags(mm.group(1)) if mm else ''

        def num(key):
            v = stat(key).replace(',', '')
            return int(v) if v.isdigit() else 0

        cands = [{'name': strip_tags(c.group(1)),
                  'party': strip_tags(c.group(2)),
                  'votes': int(c.group(3).replace(',', '')),
                  'pct': float(c.group(4))} for c in cand_re.finditer(body)]
        if not cands:
            continue

        prec = stat('Precincts Reported')
        pm = re.match(r'(\d+)\s*/\s*(\d+)', prec)
        prec_in, prec_of = (int(pm.group(1)), int(pm.group(2))) if pm else (0, 0)

        races.append({
            'name': name,
            'seats': seats,
            'precinctsIn': prec_in,
            'precinctsOf': prec_of,
            'totalVotes': num('Total Votes'),
            'registered': num('Total Registered'),
            'turnout': float(stat('Turnout').replace('%', '') or 0),
            'vbm': num('Vote by Mail (VBM)'),
            'pp': num('Polling Place (PP)'),
            'candidates': cands,
        })
    return meta, races


# ------------------------------------------------------- naming / grouping
SCHOOL = re.compile(r'School District|Unified|Community College|Board of Education|'
                    r'High School District|Union School', re.I)


def split_name(name):
    """Return (where, what, group) for display."""
    n = name

    m = re.match(r'^Measure ([^:]+): (.+)$', n)
    if m:
        return m.group(2).strip(), 'Measure ' + m.group(1).strip(), 'measures'

    m = re.match(r'^(City of .+?) (Mayor|Member, City Council.*)$', n)
    if m:
        what = m.group(2)
        what = re.sub(r'^Member, City Council District (\d+)', r'City Council, District \1', what)
        what = re.sub(r'^Member, City Council, (\d+) Year$', r'City Council (\1-year seat)', what)
        what = re.sub(r'^Member, City Council$', 'City Council', what)
        what = re.sub(r'^City Council, District (\d+), (\d+) Year$', r'City Council, District \1 (\2-year seat)', what)
        return m.group(1), what, 'cities'

    m = re.match(r'^United States Representative District (\d+)$', n)
    if m:
        return 'Monterey County', 'U.S. House, District ' + m.group(1), 'federal'

    m = re.match(r'^Member of the State Assembly District (\d+)$', n)
    if m:
        return 'Monterey County', 'State Assembly, District ' + m.group(1), 'federal'

    m = re.match(r'^(.+?) (Governing Board Member|Director|Board Member)(.*)$', n)
    if m:
        where, role, tail = m.group(1).strip(), m.group(2), m.group(3).strip()
        tail = re.sub(r'^Trustee Area (\d+)', r'Trustee Area \1', tail)
        tail = re.sub(r'^Zone (\d+)', r'Zone \1', tail)
        tail = tail.lstrip(', ').strip()
        if role == 'Governing Board Member':
            what = 'Governing Board' + (', ' + tail if tail else '')
        else:
            what = role + (', ' + tail if tail else '')
        what = re.sub(r', (\d+) Year$', r' (\1-year seat)', what)
        group = 'schools' if SCHOOL.search(where) else 'special'
        return where, what, group

    return 'Monterey County', n, 'schools' if SCHOOL.search(n) else 'special'


def is_measure(race):
    names = {c['name'].upper() for c in race['candidates']}
    return names <= {'YES', 'NO'} and len(names) > 1


# -------------------------------------------------------------------- build
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', nargs='?',
                    default=os.path.join(HERE, 'source', 'results.html'),
                    help='saved copy of the county election-results page')
    ap.add_argument('-o', '--out', default=os.path.join(HERE, 'index.html'))
    ap.add_argument('-t', '--template', default=os.path.join(HERE, 'template.html'))
    args = ap.parse_args()

    if not os.path.exists(args.source):
        sys.exit('No results file at %s — save the county page there first.' % args.source)

    meta, races = scrape(args.source)
    kept, dropped = [], []
    for r in races:
        (dropped if is_statewide(r['name']) else kept).append(r)

    out = []
    for r in kept:
        where, what, group = split_name(r['name'])
        measure = is_measure(r)
        cands = sorted(r['candidates'], key=lambda c: -c['votes'])
        out.append({
            'name': r['name'], 'where': where, 'what': what,
            'group': 'measures' if measure else group,
            'measure': measure,
            'seats': r['seats'],
            'precinctsIn': r['precinctsIn'],
            'precinctsOf': r['precinctsOf'],
            'registered': r['registered'],
            'turnout': r['turnout'],
            'totalVotes': r['totalVotes'],
            'vbm': r['vbm'], 'pp': r['pp'],
            'c': [[c['name'], c['votes'], c['party'] if c['party'] not in ('N/A', '') else '']
                  for c in cands],
        })

    payload = {'meta': meta, 'races': out}
    tpl = open(args.template, encoding='utf-8').read()
    doc = tpl.replace('/*__DATA__*/null',
                      json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    open(args.out, 'w', encoding='utf-8').write(doc)

    print('source   %s' % args.source)
    print('report   %s (%s)' % (meta.get('title', '?'), meta.get('published', '?')))
    print('kept     %d local contests' % len(kept))
    print('dropped  %d statewide contests' % len(dropped))
    print('wrote    %s (%.0f KB)' % (args.out, os.path.getsize(args.out) / 1024))


if __name__ == '__main__':
    main()
